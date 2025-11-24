import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WorkflowNode {
  id: string;
  type: 'trigger' | 'condition' | 'action';
  data: any;
  position: { x: number; y: number };
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { eventType, projectId, documentId, batchId, metadata } = await req.json();

    console.log(`Workflow execution triggered: ${eventType} for project ${projectId}`);

    // Find active workflows for this project with matching trigger
    const { data: workflows, error: workflowError } = await supabaseClient
      .from('workflows')
      .select('*')
      .eq('project_id', projectId)
      .eq('is_active', true)
      .contains('trigger_events', [eventType]);

    if (workflowError) {
      console.error('Error fetching workflows:', workflowError);
      throw workflowError;
    }

    if (!workflows || workflows.length === 0) {
      console.log('No active workflows found for this event');
      return new Response(
        JSON.stringify({ success: true, message: 'No workflows to execute' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${workflows.length} active workflow(s)`);

    // Execute each workflow
    const results = [];
    for (const workflow of workflows) {
      try {
        const result = await executeWorkflow(
          workflow,
          { eventType, projectId, documentId, batchId, metadata },
          supabaseClient
        );
        results.push({ workflowId: workflow.id, workflowName: workflow.name, ...result });
      } catch (error) {
        console.error(`Error executing workflow ${workflow.id}:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.push({ 
          workflowId: workflow.id, 
          workflowName: workflow.name,
          success: false, 
          error: errorMessage
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in execute-workflow:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function executeWorkflow(workflow: any, context: any, supabaseClient: any) {
  const nodes = Array.isArray(workflow.workflow_nodes) 
    ? workflow.workflow_nodes 
    : JSON.parse(workflow.workflow_nodes || '[]');
  
  const edges = workflow.workflow_edges 
    ? (Array.isArray(workflow.workflow_edges) ? workflow.workflow_edges : JSON.parse(workflow.workflow_edges))
    : [];

  console.log(`Executing workflow: ${workflow.name} with ${nodes.length} nodes`);

  // Find trigger node
  const triggerNode = nodes.find((n: WorkflowNode) => n.type === 'trigger');
  if (!triggerNode) {
    throw new Error('No trigger node found in workflow');
  }

  // Start execution from trigger
  return await executeNode(triggerNode, nodes, edges, context, supabaseClient);
}

async function executeNode(
  currentNode: WorkflowNode,
  allNodes: WorkflowNode[],
  edges: WorkflowEdge[],
  context: any,
  supabaseClient: any
): Promise<any> {
  console.log(`Executing node: ${currentNode.id} (${currentNode.type})`);

  switch (currentNode.type) {
    case 'trigger':
      // Trigger always passes, move to next node
      return await executeNextNodes(currentNode, allNodes, edges, context, supabaseClient);

    case 'condition':
      // Evaluate condition
      const conditionMet = await evaluateCondition(currentNode, context, supabaseClient);
      console.log(`Condition result: ${conditionMet}`);
      
      // Find the appropriate next node based on condition result
      const nextEdge = edges.find(e => 
        e.source === currentNode.id && 
        (conditionMet ? e.label === 'true' || !e.label : e.label === 'false')
      );
      
      if (nextEdge) {
        const nextNode = allNodes.find(n => n.id === nextEdge.target);
        if (nextNode) {
          return await executeNode(nextNode, allNodes, edges, context, supabaseClient);
        }
      }
      
      return { success: true, conditionMet };

    case 'action':
      // Execute action
      await executeAction(currentNode, context, supabaseClient);
      return await executeNextNodes(currentNode, allNodes, edges, context, supabaseClient);

    default:
      console.warn(`Unknown node type: ${currentNode.type}`);
      return { success: true };
  }
}

async function executeNextNodes(
  currentNode: WorkflowNode,
  allNodes: WorkflowNode[],
  edges: WorkflowEdge[],
  context: any,
  supabaseClient: any
) {
  const outgoingEdges = edges.filter(e => e.source === currentNode.id);
  
  for (const edge of outgoingEdges) {
    const nextNode = allNodes.find(n => n.id === edge.target);
    if (nextNode) {
      await executeNode(nextNode, allNodes, edges, context, supabaseClient);
    }
  }
  
  return { success: true };
}

async function evaluateCondition(node: WorkflowNode, context: any, supabaseClient: any): Promise<boolean> {
  const { conditionType, field, operator, value } = node.data || {};

  console.log(`Evaluating condition: ${field} ${operator} ${value}`);

  let actualValue;

  // Get the actual value to compare
  if (conditionType === 'confidence') {
    // Get document confidence
    if (!context.documentId) return false;
    
    const { data: doc } = await supabaseClient
      .from('documents')
      .select('confidence_score, field_confidence')
      .eq('id', context.documentId)
      .single();

    if (!doc) return false;

    if (field === 'overall') {
      actualValue = doc.confidence_score || 0;
    } else {
      const fieldConfidence = doc.field_confidence || {};
      actualValue = fieldConfidence[field] || 0;
    }
  } else if (conditionType === 'documentType') {
    // Get document type
    if (!context.documentId) return false;
    
    const { data: doc } = await supabaseClient
      .from('documents')
      .select('document_type, extracted_metadata')
      .eq('id', context.documentId)
      .single();

    if (!doc) return false;
    actualValue = doc.document_type || context.metadata?.documentType;
  } else if (conditionType === 'field') {
    // Get field value from metadata
    actualValue = context.metadata?.[field];
  } else {
    console.warn(`Unknown condition type: ${conditionType}`);
    return false;
  }

  // Evaluate operator
  switch (operator) {
    case '>':
      return Number(actualValue) > Number(value);
    case '<':
      return Number(actualValue) < Number(value);
    case '>=':
      return Number(actualValue) >= Number(value);
    case '<=':
      return Number(actualValue) <= Number(value);
    case '==':
    case '===':
      return actualValue == value;
    case '!=':
    case '!==':
      return actualValue != value;
    case 'contains':
      return String(actualValue).toLowerCase().includes(String(value).toLowerCase());
    default:
      console.warn(`Unknown operator: ${operator}`);
      return false;
  }
}

async function executeAction(node: WorkflowNode, context: any, supabaseClient: any) {
  const { actionType, status, assignTo, priority, notification } = node.data || {};

  console.log(`Executing action: ${actionType}`);

  switch (actionType) {
    case 'setStatus':
      if (context.documentId && status) {
        await supabaseClient
          .from('documents')
          .update({ validation_status: status })
          .eq('id', context.documentId);
        console.log(`Set document ${context.documentId} status to: ${status}`);
      }
      break;

    case 'assignBatch':
      if (context.batchId && assignTo) {
        await supabaseClient
          .from('batches')
          .update({ assigned_to: assignTo })
          .eq('id', context.batchId);
        console.log(`Assigned batch ${context.batchId} to: ${assignTo}`);
      }
      break;

    case 'setPriority':
      if (context.documentId && priority !== undefined) {
        await supabaseClient
          .from('documents')
          .update({ processing_priority: priority })
          .eq('id', context.documentId);
        console.log(`Set document ${context.documentId} priority to: ${priority}`);
      } else if (context.batchId && priority !== undefined) {
        await supabaseClient
          .from('batches')
          .update({ priority })
          .eq('id', context.batchId);
        console.log(`Set batch ${context.batchId} priority to: ${priority}`);
      }
      break;

    case 'sendNotification':
      if (notification) {
        // Log notification (could be extended to send via webhook/email)
        console.log(`Notification: ${notification}`);
      }
      break;

    default:
      console.warn(`Unknown action type: ${actionType}`);
  }
}
