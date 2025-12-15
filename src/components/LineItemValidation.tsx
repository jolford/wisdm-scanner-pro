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
import { useAuth } from '@/hooks/use-auth';
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
  projectId?: string;
  authenticateSignatures?: boolean;
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
      signatureStatus?: {
        present: boolean;
        value: string;
      };
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

export const LineItemValidation = ({
  lineItems,
  lookupConfig,
  keyField,
  documentId,
  projectId,
  authenticateSignatures,
  precomputedResults,
}: LineItemValidationProps) => {
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [autoValidatedAt, setAutoValidatedAt] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [referenceSignatures, setReferenceSignatures] = useState<Map<string, ReferenceSignature>>(new Map());
  const [loadingSignatures, setLoadingSignatures] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('valid');
  const { toast } = useToast();
  const { user } = useAuth();
  const [operatorProfile, setOperatorProfile] = useState<{ full_name?: string; email?: string } | null>(null);

  // Fetch operator profile for name display
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', user.id)
        .single();
      if (data) {
        setOperatorProfile(data);
      }
    };
    fetchProfile();
  }, [user?.id]);

  const isServerVoterRegistryMode =
    lookupConfig.system === 'csv' && !lookupConfig.excelFileUrl && !!documentId && !!projectId;

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
    // Petition / voter registry mode: re-run server-side validation
    if (isServerVoterRegistryMode) {
      if (!documentId || !projectId) return;

      setIsValidating(true);
      try {
        const { data, error } = await supabase.functions.invoke('validate-line-items', {
          body: {
            documentId,
            projectId,
            lineItems,
            authenticateSignatures: authenticateSignatures ?? true,
          },
        });

        if (error) {
          console.error('Server validation error:', error);
          toast({
            title: 'Validation failed',
            description: error.message || 'An error occurred while validating signatures',
            variant: 'destructive',
          });
          return;
        }

        if (!data?.results) {
          console.warn('No validation results returned from validate-line-items');
          return;
        }

        console.log('Reloaded validation results from server:', data.results.length, 'items');

        const converted: ValidationResult[] = data.results.map((r: any) => {
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
            keyValue:
              r.lineItem[keyField] ||
              r.lineItem[keyField.toLowerCase()] ||
              r.lineItem.Printed_Name ||
              r.lineItem.printed_name ||
              `Row ${r.lineIndex + 1}`,
            found: r.found,
            partialMatch: isPartialMatch,
            mismatchReason: r.mismatchReason,
            allMatch: isFullMatch,
            matchScore: r.matchScore,
            validationResults:
              r.fieldResults?.map((fr: any) => ({
                field: fr.field,
                excelValue: fr.lookupValue || '',
                wisdmValue: fr.extractedValue || '',
                matches: fr.matches,
                suggestion: fr.suggestion,
                score: fr.score,
              })) || [],
            message,
            signatureStatus:
              r.signatureStatus || {
                present:
                  (r.lineItem?.Signature_Present || r.lineItem?.signature_present || '')
                    .toString()
                    .toLowerCase() === 'yes',
                value: r.lineItem?.Signature_Present || r.lineItem?.signature_present || 'unknown',
              },
            overrideApproved: r.overrideApproved || false,
            rejected: r.rejected || false,
            overrideAt: r.overrideAt,
            signatureAuthentication: r.signatureAuthentication,
          };
        });

        setValidationResults(converted);
        setAutoValidatedAt(new Date().toISOString());

        const matchedNames = converted
          .filter((r) => r.found || r.partialMatch)
          .map((r) => r.keyValue)
          .filter((name) => name && name !== '(empty)');

        if (matchedNames.length > 0) {
          fetchReferenceSignatures(matchedNames);
        }

        toast({
          title: 'Signatures re-validated',
          description: 'Voter registry results have been refreshed.',
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

      return;
    }

    // Generic CSV/Excel lookup mode (non-petition projects)
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
      const keyColumn =
        lookupConfig.excelKeyColumn ||
        lookupConfig.lookupFields?.find(
          (f) => f.wisdmField.toLowerCase() === keyField.toLowerCase()
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
          .filter((f) => f.enabled !== false && f.lookupEnabled !== false)
          .map((f) => ({
            ...f,
            wisdmValue: lineItems[i][f.wisdmField] || lineItems[i][f.wisdmField.toLowerCase()] || '',
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

      const foundCount = results.filter((r) => r.found).length;
      const matchCount = results.filter((r) => r.allMatch).length;

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

    // Get operator name
    const operatorName = operatorProfile?.full_name || operatorProfile?.email || user?.email || 'Unknown Operator';

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
              overrideAt: updatedResult.overrideAt,
              operatorUserId: updatedResult.overrideApproved || updatedResult.rejected ? user?.id : r.operatorUserId,
              operatorName: updatedResult.overrideApproved || updatedResult.rejected ? operatorName : r.operatorName
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
    const operatorName = operatorProfile?.full_name || operatorProfile?.email || user?.email || 'Unknown Operator';
    const updatedResults = validationResults.map(r => 
      r.index === index 
        ? { 
            ...r, 
            overrideApproved: true, 
            rejected: false, 
            overrideAt: new Date().toISOString(),
            overrideBy: operatorName
          }
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
    const operatorName = operatorProfile?.full_name || operatorProfile?.email || user?.email || 'Unknown Operator';
    const updatedResults = validationResults.map(r => 
      r.index === index 
        ? { 
            ...r, 
            rejected: true, 
            overrideApproved: false,
            overrideAt: new Date().toISOString(),
            overrideBy: operatorName
          }
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
    <Card className="p-0 overflow-hidden h-full flex flex-col">
      {/* Compact Summary Header */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-2 border-b flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold">Signatures</span>
            <Badge variant="outline" className="text-[10px] h-4 px-1">{totalSignatures}</Badge>
          </div>
          <Button
            onClick={validateAllLineItems}
            disabled={isValidating || (!isServerVoterRegistryMode && !lookupConfig.excelFileUrl)}
            size="sm"
            variant="outline"
            className="h-6 text-[10px] px-2"
          >
            {isValidating ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Validating...
              </>
            ) : validationResults.length > 0 ? (
              <>
                <RefreshCw className="h-3 w-3 mr-1" />
                Re-validate
              </>
            ) : (
              <>
                <FileCheck className="h-3 w-3 mr-1" />
                Validate
              </>
            )}
          </Button>
        </div>

        {/* Compact Statistics */}
        <div className="flex flex-wrap gap-1 mt-1.5">
          <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-[10px] h-4 px-1">
            <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
            {validCount}
          </Badge>
          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-[10px] h-4 px-1">
            <AlertCircle className="h-2.5 w-2.5 mr-0.5" />
            {forReviewCount}
          </Badge>
          {rejectedCount > 0 && (
            <Badge variant="outline" className="bg-muted text-muted-foreground text-[10px] h-4 px-1">
              <Ban className="h-2.5 w-2.5 mr-0.5" />
              {rejectedCount}
            </Badge>
          )}
        </div>
      </div>

      {validationResults.length > 0 && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
          <div className="border-b px-1 bg-muted/30 flex-shrink-0">
            <TabsList className="grid w-full grid-cols-4 h-7">
              <TabsTrigger value="valid" className="text-[10px] h-6 px-1">
                <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                Valid ({validCount})
              </TabsTrigger>
              <TabsTrigger value="review" className="text-[10px] h-6 px-1">
                <ClipboardCheck className="h-2.5 w-2.5 mr-0.5" />
                Review ({forReviewCount})
              </TabsTrigger>
              <TabsTrigger value="rejected" className="text-[10px] h-6 px-1">
                <Ban className="h-2.5 w-2.5 mr-0.5" />
                Rejected ({rejectedCount})
              </TabsTrigger>
              <TabsTrigger value="all" className="text-[10px] h-6 px-1">
                <Users className="h-2.5 w-2.5 mr-0.5" />
                All ({validationResults.length})
              </TabsTrigger>
            </TabsList>
          </div>
          
          {/* Valid Signatures Tab */}
          <TabsContent value="valid" className="flex-1 overflow-auto m-0">
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
                showActions={true}
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
          <TabsContent value="review" className="flex-1 overflow-auto m-0">
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
          <TabsContent value="rejected" className="flex-1 overflow-auto m-0">
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
          <TabsContent value="all" className="flex-1 overflow-auto m-0">
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
