import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SmartRoutingRule {
  id: string;
  condition: {
    field: string;
    operator: 'equals' | 'contains' | 'greaterThan' | 'lessThan';
    value: string | number;
  };
  action: {
    type: 'assign_user' | 'set_priority' | 'add_tag' | 'move_to_project';
    value: string;
  };
}

/**
 * Smart batch routing hook for automatic document assignment
 */
export function useSmartRouting() {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const applyRouting = useCallback(async (batchId: string, rules: SmartRoutingRule[]) => {
    setIsProcessing(true);

    try {
      // Get batch documents
      const { data: documents, error: docsError } = await supabase
        .from('documents')
        .select('id, extracted_metadata, document_type, confidence_score')
        .eq('batch_id', batchId);

      if (docsError) throw docsError;

      const updates: { id: string; updates: any }[] = [];

      // Apply rules to each document
      for (const doc of documents || []) {
        for (const rule of rules) {
          const metadata = doc.extracted_metadata as Record<string, any> || {};
          const fieldValue = metadata[rule.condition.field] ?? doc[rule.condition.field as keyof typeof doc];

          let matches = false;

          switch (rule.condition.operator) {
            case 'equals':
              matches = fieldValue == rule.condition.value;
              break;
            case 'contains':
              matches = String(fieldValue).toLowerCase().includes(String(rule.condition.value).toLowerCase());
              break;
            case 'greaterThan':
              matches = Number(fieldValue) > Number(rule.condition.value);
              break;
            case 'lessThan':
              matches = Number(fieldValue) < Number(rule.condition.value);
              break;
          }

          if (matches) {
            const update: any = {};
            switch (rule.action.type) {
              case 'set_priority':
                update.processing_priority = parseInt(rule.action.value);
                break;
            }

            if (Object.keys(update).length > 0) {
              updates.push({ id: doc.id, updates: update });
            }
          }
        }
      }

      // Apply updates
      for (const { id, updates: docUpdates } of updates) {
        await supabase.from('documents').update(docUpdates).eq('id', id);
      }

      toast({
        title: 'Routing Applied',
        description: `Updated ${updates.length} documents based on routing rules.`,
      });

      return updates.length;
    } catch (error) {
      console.error('Smart routing failed:', error);
      toast({
        title: 'Routing Failed',
        description: 'Could not apply routing rules.',
        variant: 'destructive',
      });
      return 0;
    } finally {
      setIsProcessing(false);
    }
  }, [toast]);

  return {
    applyRouting,
    isProcessing,
  };
}
