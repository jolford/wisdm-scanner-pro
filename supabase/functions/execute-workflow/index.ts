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

async function evaluateCondition(node: any, context: any, supabaseClient: any): Promise<boolean> {
  // Node structure from database: { type: 'condition', value: 'confidence_threshold', config: { threshold: 90 } }
  const conditionType = node.value;
  const config = node.config || {};
  
  console.log(`Evaluating ${conditionType} condition with config:`, config);

  if (!conditionType) {
    console.warn('Missing condition type');
    return false;
  }

  switch (conditionType) {
    case 'confidence_threshold': {
      // Check if document confidence meets threshold
      if (!context.documentId) return false;
      
      const { data: doc } = await supabaseClient
        .from('documents')
        .select('confidence_score')
        .eq('id', context.documentId)
        .single();

      if (!doc) return false;

      const threshold = parseFloat(config.threshold || '0');
      const confidence = (doc.confidence_score || 0) * 100; // Convert to percentage
      
      console.log(`Confidence check: ${confidence}% >= ${threshold}%`);
      return confidence >= threshold;
    }

    case 'document_type': {
      // Check if document type matches
      if (!context.documentId) return false;
      
      const { data: doc } = await supabaseClient
        .from('documents')
        .select('document_type')
        .eq('id', context.documentId)
        .single();

      if (!doc) return false;

      const expectedType = config.docType;
      console.log(`Document type check: ${doc.document_type} === ${expectedType}`);
      return doc.document_type === expectedType;
    }

    case 'field_value': {
      // Check if a field value contains/matches expected value
      if (!context.documentId) return false;
      
      const { data: doc } = await supabaseClient
        .from('documents')
        .select('extracted_metadata')
        .eq('id', context.documentId)
        .single();

      if (!doc || !doc.extracted_metadata) return false;

      const fieldName = config.field;
      const expectedValue = config.value || '';
      const fieldValue = doc.extracted_metadata[fieldName];

      if (!fieldValue) {
        console.log(`Field ${fieldName} not found in metadata`);
        return false;
      }

      const matches = String(fieldValue).toLowerCase().includes(String(expectedValue).toLowerCase());
      console.log(`Field value check: ${fieldName} = "${fieldValue}" contains "${expectedValue}" = ${matches}`);
      return matches;
    }

    default:
      console.warn(`Unknown condition type: ${conditionType}`);
      return false;
  }
}

async function executeAction(node: any, context: any, supabaseClient: any) {
  // Node structure from database: { type: 'action', value: 'auto_validate', config: { queue: 'export' } }
  const actionType = node.value;
  const config = node.config || {};

  console.log(`Executing ${actionType} action with config:`, config);

  if (!actionType) {
    console.warn('Missing action type');
    return;
  }

  switch (actionType) {
    case 'auto_validate':
      if (context.documentId) {
        // Get document to check critical fields before auto-validating
        const { data: doc } = await supabaseClient
          .from('documents')
          .select('extracted_metadata')
          .eq('id', context.documentId)
          .single();

        // Helper: Check if critical invoice fields have values
        const hasCriticalFieldData = (meta: any): boolean => {
          if (!meta || typeof meta !== 'object') return false;
          
          const criticalFields = ['Invoice Number', 'Invoice Date', 'Invoice Total', 'PO Number', 'Vendor Name'];
          
          for (const field of criticalFields) {
            const value = meta[field];
            
            // Check if field is missing, null, or empty
            if (!value) return false;
            
            // Check if value is an object with empty/null value property (e.g., {value: null})
            if (typeof value === 'object' && (!value.value || value.value === '')) return false;
            
            // Check if value is an empty string
            if (typeof value === 'string' && value.trim() === '') return false;
          }
          
          return true;
        };

        const hasCriticalData = hasCriticalFieldData(doc?.extracted_metadata);

        if (!hasCriticalData) {
          console.log(`Workflow: Skipping auto-validate for document ${context.documentId} - missing critical field data`);
          // Do not auto-validate documents with incomplete data
          return;
        }

        // Get workflow creator as the "validated_by" user
        const { data: workflowData } = await supabaseClient
          .from('workflows')
          .select('created_by')
          .eq('project_id', context.projectId)
          .limit(1)
          .single();

        const validatedBy = workflowData?.created_by || null;

        // Update document with validation status and timestamps
        const { data: updatedDoc, error: updateError } = await supabaseClient
          .from('documents')
          .update({ 
            validation_status: 'validated',
            validated_at: new Date().toISOString(),
            validated_by: validatedBy
          })
          .eq('id', context.documentId)
          .select(`
            *,
            batch:batches!inner(batch_name),
            project:projects!inner(name, customer_id)
          `)
          .single();
        
        if (updateError) {
          console.error('Failed to auto-validate document:', updateError);
        } else {
          console.log(`Auto-validated document ${context.documentId}`);

          // Trigger webhook notification for auto-validated document
          try {
            const targetCustomerId = updatedDoc?.project?.customer_id;
            
            await supabaseClient.functions.invoke('send-webhook', {
              body: {
                customer_id: targetCustomerId,
                event_type: 'document.validated',
                payload: {
                  document_id: context.documentId,
                  document_name: updatedDoc?.file_name,
                  batch_id: updatedDoc?.batch_id,
                  batch_name: updatedDoc?.batch?.batch_name,
                  project_name: updatedDoc?.project?.name,
                  validated_by: validatedBy,
                  validated_at: new Date().toISOString(),
                  metadata: updatedDoc?.extracted_metadata,
                  auto_validated: true
                }
              }
            });
            console.log(`Webhook triggered for auto-validated document ${context.documentId}`);
          } catch (webhookError) {
            console.error('Webhook notification failed:', webhookError);
            // Don't fail validation if webhook fails
          }
        }
      }
      break;

    case 'route_to_queue':
      if (context.documentId && config.queue) {
        // Map queue to validation status
        const statusMap: Record<string, string> = {
          'validation': 'pending',
          'export': 'validated',
          'review': 'needs_review',
          'scan': 'pending'
        };
        const status = statusMap[config.queue] || 'pending';
        
        await supabaseClient
          .from('documents')
          .update({ validation_status: status })
          .eq('id', context.documentId);
        console.log(`Routed document ${context.documentId} to ${config.queue} queue (status: ${status})`);
      }
      break;

    case 'set_priority':
      if (context.batchId && config.priority !== undefined) {
        await supabaseClient
          .from('batches')
          .update({ priority: parseInt(config.priority) })
          .eq('id', context.batchId);
        console.log(`Set batch ${context.batchId} priority to: ${config.priority}`);
      } else if (context.documentId && config.priority !== undefined) {
        await supabaseClient
          .from('documents')
          .update({ processing_priority: parseInt(config.priority) })
          .eq('id', context.documentId);
        console.log(`Set document ${context.documentId} priority to: ${config.priority}`);
      }
      break;

    case 'send_notification':
      if (config.message) {
        console.log(`Notification: ${config.message}`);
        // TODO: Could be extended to trigger webhooks
      }
      break;

    default:
      console.warn(`Unknown action type: ${actionType}`);
  }
}
