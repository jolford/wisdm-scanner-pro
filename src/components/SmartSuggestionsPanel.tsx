import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, TrendingUp, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface SmartSuggestion {
  fieldName: string;
  suggestedValue: string;
  confidence: number;
  source: 'history' | 'pattern' | 'vendor';
  lastUsed?: string;
}

interface SmartSuggestionsPanelProps {
  documentId: string;
  projectFields: Array<{ name: string; description?: string }>;
  currentMetadata: Record<string, any>;
  onApplySuggestion: (fieldName: string, value: string) => void;
}

export const SmartSuggestionsPanel = ({
  documentId,
  projectFields,
  currentMetadata,
  onApplySuggestion
}: SmartSuggestionsPanelProps) => {
  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSmartSuggestions();
  }, [documentId]);

  const loadSmartSuggestions = async () => {
    setLoading(true);
    try {
      // Get current document
      const { data: currentDoc } = await supabase
        .from('documents')
        .select('extracted_metadata, project_id, batch_id')
        .eq('id', documentId)
        .single();

      if (!currentDoc) return;

      const vendorName = currentDoc.extracted_metadata?.['Vendor Name'] || 
                        currentDoc.extracted_metadata?.['vendor_name'];

      // Find similar documents from same vendor
      const { data: similarDocs } = await supabase
        .from('documents')
        .select('extracted_metadata, validation_status')
        .eq('project_id', currentDoc.project_id)
        .eq('validation_status', 'validated')
        .limit(10)
        .order('validated_at', { ascending: false });

      if (!similarDocs || similarDocs.length === 0) {
        setSuggestions([]);
        setLoading(false);
        return;
      }

      // Analyze patterns
      const suggestions: SmartSuggestion[] = [];
      const fieldFrequency: Record<string, Record<string, number>> = {};

      similarDocs.forEach(doc => {
        const metadata = doc.extracted_metadata as Record<string, any> || {};
        Object.entries(metadata).forEach(([field, value]) => {
          if (!fieldFrequency[field]) fieldFrequency[field] = {};
          const strValue = String(value || '');
          fieldFrequency[field][strValue] = (fieldFrequency[field][strValue] || 0) + 1;
        });
      });

      // Generate suggestions for fields that are empty or have low confidence
      projectFields.forEach(field => {
        const currentValue = currentMetadata[field.name];
        const hasValue = currentValue && currentValue !== '';

        if (!hasValue && fieldFrequency[field.name]) {
          // Find most common value
          const values = Object.entries(fieldFrequency[field.name])
            .sort(([, a], [, b]) => b - a);
          
          if (values.length > 0) {
            const [suggestedValue, count] = values[0];
            const confidence = Math.round((count / similarDocs.length) * 100);
            
            if (confidence >= 50 && suggestedValue) {
              suggestions.push({
                fieldName: field.name,
                suggestedValue,
                confidence,
                source: vendorName ? 'vendor' : 'history',
              });
            }
          }
        }
      });

      setSuggestions(suggestions);
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-sm text-muted-foreground">
            Loading smart suggestions...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (suggestions.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-sm text-muted-foreground">
            No suggestions available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          Smart Suggestions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {suggestions.map((suggestion, index) => (
          <div
            key={index}
            className="p-3 rounded-lg border bg-muted/30 space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{suggestion.fieldName}</span>
                <Badge variant="secondary" className="text-xs">
                  {suggestion.confidence}% match
                </Badge>
              </div>
              <Badge variant="outline" className="text-xs">
                {suggestion.source === 'vendor' ? (
                  <><TrendingUp className="h-3 w-3 mr-1" />Vendor History</>
                ) : (
                  <><Clock className="h-3 w-3 mr-1" />Recent</>
                )}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground truncate flex-1">
                {suggestion.suggestedValue}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onApplySuggestion(suggestion.fieldName, suggestion.suggestedValue)}
              >
                Apply
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};