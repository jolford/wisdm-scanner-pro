import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, XCircle, AlertCircle, Loader2, RefreshCw, Clock, 
  Users, FileCheck, FileX, ChevronDown, ChevronUp, ClipboardCheck, Ban
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getSignedUrl } from '@/hooks/use-signed-url';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { SignatureCardList } from '@/components/petition/SignatureCardList';

interface LineItemValidationProps {
  lineItems: Array<Record<string, any>>;
  lookupConfig: {
    system: string;
    excelFileUrl?: string;
    excelKeyColumn?: string;
    lookupFields?: Array<{
      wisdmField: string;
      ecmField: string;
      enabled?: boolean;
      lookupEnabled?: boolean;
    }>;
  };
  keyField: string;
  documentId?: string;
  precomputedResults?: {
    validated: boolean;
    validatedAt?: string;
    totalItems: number;
    validCount: number;
    invalidCount: number;
    results: Array<{
      lineIndex: number;
      lineItem: Record<string, any>;
      found: boolean;
      matchScore: number;
      overrideApproved?: boolean;
      rejected?: boolean;
      overrideAt?: string;
      fieldResults: Array<{
        field: string;
        extractedValue: string;
        lookupValue: string | null;
        matches: boolean;
        score: number;
        suggestion: string | null;
      }>;
      bestMatch: Record<string, any> | null;
    }>;
  };
}

interface ValidationResult {
  index: number;
  keyValue: string;
  found: boolean;
  partialMatch?: boolean;
  mismatchReason?: string;
  allMatch: boolean;
  matchScore?: number;
  validationResults?: Array<{
    field: string;
    excelValue: string;
    wisdmValue: string;
    matches: boolean;
    suggestion: string | null;
    score?: number;
  }>;
  message?: string;
  signatureStatus?: {
    present: boolean;
    value: string;
  };
  overrideApproved?: boolean;
  rejected?: boolean;
  overrideBy?: string;
  overrideAt?: string;
}

interface ReferenceSignature {
  name: string;
  imageUrl: string;
  signedUrl?: string;
}

export const LineItemValidation = ({ lineItems, lookupConfig, keyField, documentId, precomputedResults }: LineItemValidationProps) => {
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [autoValidatedAt, setAutoValidatedAt] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [referenceSignatures, setReferenceSignatures] = useState<Map<string, ReferenceSignature>>(new Map());
  const [loadingSignatures, setLoadingSignatures] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('valid');
  const { toast } = useToast();

  // Fetch reference signatures for valid entries
  const fetchReferenceSignatures = async (names: string[]) => {
    if (names.length === 0) return;
    
    setLoadingSignatures(true);
    try {
      // Fetch matching signatures from signature_references table
      const { data, error } = await supabase
        .from('signature_references')
        .select('entity_name, signature_image_url')
        .in('entity_name', names)
        .eq('is_active', true);

      if (error) {
        console.error('Error fetching reference signatures:', error);
        return;
      }

      if (data && data.length > 0) {
        const sigMap = new Map<string, ReferenceSignature>();
        
        // Get signed URLs for each signature image
        for (const sig of data) {
          const signedUrl = await getSignedUrl(sig.signature_image_url);
          sigMap.set(sig.entity_name.toLowerCase(), {
            name: sig.entity_name,
            imageUrl: sig.signature_image_url,
            signedUrl: signedUrl
          });
        }
        
        setReferenceSignatures(sigMap);
      }
    } catch (error) {
      console.error('Error fetching reference signatures:', error);
    } finally {
      setLoadingSignatures(false);
    }
  };

  // Load precomputed results if available
  useEffect(() => {
    // Check if we have results - don't require 'validated' flag
    if (precomputedResults?.results?.length > 0) {
      console.log('Loading precomputed validation results:', precomputedResults.results.length, 'items');
      const converted: ValidationResult[] = precomputedResults.results.map((r: any) => {
        // Handle partial match (name found but address mismatch)
        const isPartialMatch = r.partialMatch === true;
        const isFullMatch = r.found && r.matchScore >= 0.9;
        
        let message = 'Not found in voter registry';
        if (r.found) {
          message = `Match score: ${Math.round(r.matchScore * 100)}%`;
        } else if (isPartialMatch) {
          message = r.mismatchReason === 'address_mismatch' 
            ? 'Name found - Address mismatch' 
            : 'Partial match found';
        }
        
        return {
          index: r.lineIndex,
          keyValue: r.lineItem[keyField] || r.lineItem[keyField.toLowerCase()] || r.lineItem.Printed_Name || r.lineItem.printed_name || `Row ${r.lineIndex + 1}`,
          found: r.found,
          partialMatch: isPartialMatch,
          mismatchReason: r.mismatchReason,
          allMatch: isFullMatch,
          matchScore: r.matchScore,
          validationResults: r.fieldResults?.map((fr: any) => ({
            field: fr.field,
            excelValue: fr.lookupValue || '',
            wisdmValue: fr.extractedValue || '',
            matches: fr.matches,
            suggestion: fr.suggestion,
            score: fr.score,
          })) || [],
          message,
          signatureStatus: r.signatureStatus || {
            present: (r.lineItem?.Signature_Present || r.lineItem?.signature_present || '').toString().toLowerCase() === 'yes',
            value: r.lineItem?.Signature_Present || r.lineItem?.signature_present || 'unknown'
          },
          // Load operator action flags from precomputed results
          overrideApproved: r.overrideApproved || false,
          rejected: r.rejected || false,
          overrideAt: r.overrideAt
        };
      });
      
      setValidationResults(converted);
      setAutoValidatedAt(precomputedResults.validatedAt || new Date().toISOString());
      
      // Fetch reference signatures for all registry matches (found or partial match)
      const matchedNames = converted
        .filter(r => r.found || r.partialMatch)
        .map(r => r.keyValue)
        .filter(name => name && name !== '(empty)');
      
      if (matchedNames.length > 0) {
        fetchReferenceSignatures(matchedNames);
      }
    }
  }, [precomputedResults, keyField]);

  const validateAllLineItems = async () => {
    if (!lookupConfig.excelFileUrl) {
      toast({
        title: 'Configuration incomplete',
        description: 'Please configure CSV/Excel validation in project settings',
        variant: 'destructive',
      });
      return;
    }

    setIsValidating(true);
    const results: ValidationResult[] = [];

    try {
      const keyColumn = lookupConfig.excelKeyColumn || 
        lookupConfig.lookupFields?.find(f => 
          f.wisdmField.toLowerCase() === keyField.toLowerCase()
        )?.ecmField;

      for (let i = 0; i < lineItems.length; i++) {
        const lineItem = lineItems[i];
        const keyValue = lineItem[keyField] || lineItem[keyField.toLowerCase()] || '';

        if (!keyValue) {
          results.push({
            index: i,
            keyValue: '(empty)',
            found: false,
            allMatch: false,
            message: `No value for ${keyField}`,
          });
          continue;
        }

        const lookupFields = (lookupConfig.lookupFields || [])
          .filter(f => f.enabled !== false && f.lookupEnabled !== false)
          .map(f => ({
            ...f,
            wisdmValue: lineItem[f.wisdmField] || lineItem[f.wisdmField.toLowerCase()] || '',
          }));

        const signedUrl = await getSignedUrl(lookupConfig.excelFileUrl);
        const { data, error } = await supabase.functions.invoke('validate-excel-lookup', {
          body: {
            fileUrl: signedUrl,
            keyColumn: keyColumn || keyField,
            keyValue: keyValue,
            lookupFields: lookupFields,
          },
        });

        if (error) {
          console.error(`Validation error for row ${i}:`, error);
          results.push({
            index: i,
            keyValue: String(keyValue),
            found: false,
            allMatch: false,
            message: error.message || 'Validation failed',
          });
          continue;
        }

        results.push({
          index: i,
          keyValue: String(keyValue),
          found: data.found,
          allMatch: data.allMatch,
          validationResults: data.validationResults,
          message: data.message,
        });
      }

      setValidationResults(results);
      setAutoValidatedAt(null);

      const foundCount = results.filter(r => r.found).length;
      const matchCount = results.filter(r => r.allMatch).length;

      toast({
        title: 'Line item validation complete',
        description: `${foundCount}/${results.length} found in registry, ${matchCount}/${foundCount} fully matched`,
      });
    } catch (error: any) {
      console.error('Line item validation error:', error);
      toast({
        title: 'Validation failed',
        description: error.message || 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsValidating(false);
    }
  };

  const toggleRow = (index: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedRows(newExpanded);
  };

  // Persist operator action to database
  const persistOperatorAction = async (updatedResults: ValidationResult[]) => {
    if (!documentId || !precomputedResults) return;

    try {
      // Merge operator actions back into precomputed results
      const updatedPrecomputed = {
        ...precomputedResults,
        results: precomputedResults.results.map((r: any) => {
          const updatedResult = updatedResults.find(ur => ur.index === r.lineIndex);
          if (updatedResult) {
            return {
              ...r,
              overrideApproved: updatedResult.overrideApproved || false,
              rejected: updatedResult.rejected || false,
              overrideAt: updatedResult.overrideAt
            };
          }
          return r;
        })
      };

      // Update document validation_suggestions with operator actions
      const { error } = await supabase
        .from('documents')
        .update({
          validation_suggestions: {
            lookupValidation: updatedPrecomputed
          }
        })
        .eq('id', documentId);

      if (error) {
        console.error('Failed to persist operator action:', error);
      }
    } catch (err) {
      console.error('Error persisting operator action:', err);
    }
  };

  // Override/Approve a flagged item
  const handleOverrideApprove = async (index: number) => {
    const updatedResults = validationResults.map(r => 
      r.index === index 
        ? { ...r, overrideApproved: true, rejected: false, overrideAt: new Date().toISOString() }
        : r
    );
    setValidationResults(updatedResults);
    
    // Persist to database
    await persistOperatorAction(updatedResults);
    
    toast({
      title: 'Signature Approved',
      description: 'Item has been manually approved and saved.',
    });
  };

  // Reject a signature - removes from counts/exports
  const handleReject = async (index: number) => {
    const updatedResults = validationResults.map(r => 
      r.index === index 
        ? { ...r, rejected: true, overrideApproved: false }
        : r
    );
    setValidationResults(updatedResults);
    
    // Persist to database
    await persistOperatorAction(updatedResults);
    
    toast({
      title: 'Signature Rejected',
      description: 'Item has been rejected and saved.',
    });
  };

  // Calculate statistics (exclude rejected)
  const totalSignatures = lineItems.length;
  const activeResults = validationResults.filter(r => !r.rejected);
  const rejectedCount = validationResults.filter(r => r.rejected).length;
  const validSignatures = activeResults.filter(r => r.allMatch || r.overrideApproved);
  const invalidSignatures = activeResults.filter(r => !r.allMatch && !r.overrideApproved);
  const validCount = validSignatures.length;
  const partialMatchCount = activeResults.filter(r => r.partialMatch && !r.overrideApproved).length;
  const notFoundCount = activeResults.filter(r => !r.found && !r.partialMatch && !r.overrideApproved).length;
  const signaturesPresent = activeResults.filter(r => r.signatureStatus?.present).length;
  const validPercentage = activeResults.length > 0 
    ? Math.round((validCount / activeResults.length) * 100) 
    : 0;

  // Items needing review: address mismatch, not found, or missing signature (not yet overridden, not rejected)
  const forReviewItems = validationResults.filter(r => 
    !r.overrideApproved && !r.rejected && (
      r.partialMatch || 
      (!r.found && !r.partialMatch) || 
      (r.signatureStatus && !r.signatureStatus.present)
    )
  );
  const forReviewCount = forReviewItems.length;

  return (
    <Card className="p-0 overflow-hidden">
      {/* Summary Header */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-lg">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Petition Signature Validation</h3>
              <p className="text-xs text-muted-foreground">
                {validationResults.length > 0 ? (
                  <>
                    Compared against voter registry
                    {autoValidatedAt && (
                      <span className="ml-2 inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Auto-validated
                      </span>
                    )}
                  </>
                ) : (
                  `${totalSignatures} signature(s) extracted`
                )}
              </p>
            </div>
          </div>
          <Button
            onClick={validateAllLineItems}
            disabled={isValidating || !lookupConfig.excelFileUrl}
            size="sm"
          >
            {isValidating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Validating...
              </>
            ) : validationResults.length > 0 ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Re-validate
              </>
            ) : (
              <>
                <FileCheck className="h-4 w-4 mr-2" />
                Validate All
              </>
            )}
          </Button>
        </div>

        {/* Compact Statistics */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="bg-background">
            {totalSignatures} Total
          </Badge>
          <Badge variant="outline" className="bg-success/10 text-success border-success/30">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            {validCount} Valid
          </Badge>
          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
            <AlertCircle className="h-3 w-3 mr-1" />
            {forReviewCount} Review
          </Badge>
          {rejectedCount > 0 && (
            <Badge variant="outline" className="bg-muted text-muted-foreground">
              <Ban className="h-3 w-3 mr-1" />
              {rejectedCount} Rejected
            </Badge>
          )}
          <Badge variant="outline" className="ml-auto">
            {validPercentage}% Valid Rate
          </Badge>
        </div>
      </div>

      {/* Tabbed Card List */}
      {validationResults.length > 0 && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col">
          <div className="border-b px-4 pt-2 bg-muted/30">
            <TabsList className="grid w-full max-w-lg grid-cols-4">
              <TabsTrigger value="valid" className="text-xs">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Valid ({validCount})
              </TabsTrigger>
              <TabsTrigger value="review" className="text-xs">
                <ClipboardCheck className="h-3 w-3 mr-1" />
                Review ({forReviewCount})
              </TabsTrigger>
              <TabsTrigger value="rejected" className="text-xs">
                <Ban className="h-3 w-3 mr-1" />
                Rejected ({rejectedCount})
              </TabsTrigger>
              <TabsTrigger value="all" className="text-xs">
                <Users className="h-3 w-3 mr-1" />
                All ({validationResults.length})
              </TabsTrigger>
            </TabsList>
          </div>
          
          {/* Valid Signatures Tab */}
          <TabsContent value="valid" className="flex-1 overflow-auto m-0 max-h-[400px]">
            {validCount > 0 ? (
              <SignatureCardList 
                results={validSignatures}
                lineItems={lineItems}
                expandedRows={expandedRows}
                toggleRow={toggleRow}
                referenceSignatures={referenceSignatures}
                loadingSignatures={loadingSignatures}
                onApprove={handleOverrideApprove}
                onReject={handleReject}
                showActions={false}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-3" />
                <h3 className="text-lg font-semibold text-muted-foreground mb-1">No Valid Signatures</h3>
                <p className="text-sm text-muted-foreground">Approve signatures from the Review tab</p>
              </div>
            )}
          </TabsContent>
          
          {/* For Review Tab */}
          <TabsContent value="review" className="flex-1 overflow-auto m-0 max-h-[400px]">
            {forReviewCount > 0 ? (
              <SignatureCardList 
                results={forReviewItems}
                lineItems={lineItems}
                expandedRows={expandedRows}
                toggleRow={toggleRow}
                referenceSignatures={referenceSignatures}
                loadingSignatures={loadingSignatures}
                onApprove={handleOverrideApprove}
                onReject={handleReject}
                showActions={true}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle2 className="h-12 w-12 text-success mb-3" />
                <h3 className="text-lg font-semibold text-success mb-1">All Clear!</h3>
                <p className="text-sm text-muted-foreground">No items require manual review</p>
              </div>
            )}
          </TabsContent>
          
          {/* Rejected Tab */}
          <TabsContent value="rejected" className="flex-1 overflow-auto m-0 max-h-[400px]">
            {rejectedCount > 0 ? (
              <SignatureCardList 
                results={validationResults.filter(r => r.rejected)}
                lineItems={lineItems}
                expandedRows={expandedRows}
                toggleRow={toggleRow}
                referenceSignatures={referenceSignatures}
                loadingSignatures={loadingSignatures}
                onApprove={handleOverrideApprove}
                onReject={handleReject}
                showActions={false}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle2 className="h-12 w-12 text-muted-foreground mb-3" />
                <h3 className="text-lg font-semibold text-muted-foreground mb-1">No Rejected Signatures</h3>
                <p className="text-sm text-muted-foreground">Rejected items will appear here</p>
              </div>
            )}
          </TabsContent>
          
          {/* All Signatures Tab */}
          <TabsContent value="all" className="flex-1 overflow-auto m-0 max-h-[400px]">
            <SignatureCardList 
              results={validationResults}
              lineItems={lineItems}
              expandedRows={expandedRows}
              toggleRow={toggleRow}
              referenceSignatures={referenceSignatures}
              loadingSignatures={loadingSignatures}
              onApprove={handleOverrideApprove}
              onReject={handleReject}
              showActions={false}
            />
          </TabsContent>
        </Tabs>
      )}
      
      {/* Empty State */}
      {validationResults.length === 0 && !isValidating && (
        <div className="text-center py-12 text-muted-foreground">
          <FileX className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium mb-1">Not yet validated</p>
          <p className="text-sm">Click "Validate All" to check signatures against the voter registry</p>
        </div>
      )}
    </Card>
  );
};
