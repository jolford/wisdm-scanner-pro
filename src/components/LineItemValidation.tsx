import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle2, XCircle, AlertCircle, Loader2, RefreshCw, Clock, 
  Users, FileCheck, FileX, ChevronDown, ChevronUp, PenTool, Info, GripHorizontal,
  ThumbsUp, Eye, ClipboardCheck
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getSignedUrl } from '@/hooks/use-signed-url';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import { SignatureTable } from '@/components/petition/SignatureTable';

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
  overrideBy?: string;
  overrideAt?: string;
}

interface ReferenceSignature {
  name: string;
  imageUrl: string;
  signedUrl?: string;
}

export const LineItemValidation = ({ lineItems, lookupConfig, keyField, precomputedResults }: LineItemValidationProps) => {
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
          }
        };
      });
      
      setValidationResults(converted);
      setAutoValidatedAt(precomputedResults.validatedAt || new Date().toISOString());
      
      // Fetch reference signatures for valid entries
      const validNames = converted
        .filter(r => r.allMatch)
        .map(r => r.keyValue)
        .filter(name => name && name !== '(empty)');
      
      if (validNames.length > 0) {
        fetchReferenceSignatures(validNames);
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

  // Override/Approve a flagged item
  const handleOverrideApprove = (index: number) => {
    setValidationResults(prev => prev.map(r => 
      r.index === index 
        ? { ...r, overrideApproved: true, overrideAt: new Date().toISOString() }
        : r
    ));
    toast({
      title: 'Signature Approved',
      description: 'Item has been manually approved and moved to valid signatures.',
    });
  };

  // Calculate statistics
  const totalSignatures = lineItems.length;
  const validSignatures = validationResults.filter(r => r.allMatch || r.overrideApproved);
  const invalidSignatures = validationResults.filter(r => !r.allMatch && !r.overrideApproved);
  const validCount = validSignatures.length;
  const mismatchCount = validationResults.filter(r => r.found && !r.allMatch && !r.overrideApproved).length;
  const partialMatchCount = validationResults.filter(r => r.partialMatch && !r.overrideApproved).length;
  const notFoundCount = validationResults.filter(r => !r.found && !r.partialMatch && !r.overrideApproved).length;
  const signaturesPresent = validationResults.filter(r => r.signatureStatus?.present).length;
  const signaturesMissing = validationResults.filter(r => r.signatureStatus && !r.signatureStatus.present && !r.overrideApproved).length;
  const validPercentage = validationResults.length > 0 
    ? Math.round((validCount / totalSignatures) * 100) 
    : 0;
  const invalidCount = invalidSignatures.length;

  // Items needing review: address mismatch, not found, or missing signature (not yet overridden)
  const forReviewItems = validationResults.filter(r => 
    !r.overrideApproved && (
      r.partialMatch || 
      (!r.found && !r.partialMatch) || 
      (r.signatureStatus && !r.signatureStatus.present)
    )
  );
  const forReviewCount = forReviewItems.length;

  // State for expanded follow-up sections
  const [showValidList, setShowValidList] = useState(false);
  const [showInvalidList, setShowInvalidList] = useState(true); // Default open for follow-up

  return (
    <Card className="p-0 overflow-hidden">
      {/* Summary Header */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-6 border-b">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-lg">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Petition Signature Validation</h3>
              <p className="text-sm text-muted-foreground">
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
                  `${totalSignatures} signature(s) extracted from document`
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={validateAllLineItems}
              disabled={isValidating || !lookupConfig.excelFileUrl}
              size="lg"
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
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-6 gap-3">
          <div className="bg-background/80 backdrop-blur rounded-lg p-3 text-center border">
            <div className="text-2xl font-bold text-foreground">{totalSignatures}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide mt-1">Total Signatures</div>
          </div>
          <div className="bg-primary/10 rounded-lg p-3 text-center border border-primary/20">
            <div className="text-2xl font-bold text-primary">{signaturesPresent}</div>
            <div className="text-xs text-primary uppercase tracking-wide mt-1">Signed</div>
          </div>
          <div className="bg-success/10 rounded-lg p-3 text-center border border-success/20">
            <div className="text-2xl font-bold text-success">{validCount}</div>
            <div className="text-xs text-success uppercase tracking-wide mt-1">Registry Match</div>
          </div>
          <div className="bg-warning/10 rounded-lg p-3 text-center border border-warning/20">
            <div className="text-2xl font-bold text-warning">{partialMatchCount}</div>
            <div className="text-xs text-warning uppercase tracking-wide mt-1">Addr. Mismatch</div>
          </div>
          <div className="bg-destructive/10 rounded-lg p-3 text-center border border-destructive/20">
            <div className="text-2xl font-bold text-destructive">{notFoundCount}</div>
            <div className="text-xs text-destructive uppercase tracking-wide mt-1">Not Found</div>
          </div>
          <div className="bg-amber-500/10 rounded-lg p-3 text-center border border-amber-500/20">
            <div className="text-2xl font-bold text-amber-600">{forReviewCount}</div>
            <div className="text-xs text-amber-600 uppercase tracking-wide mt-1">For Review</div>
          </div>
        </div>

        {/* Progress Bar */}
        {validationResults.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Validation Rate</span>
              <span className="font-semibold">{validPercentage}% Valid</span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden flex">
              <div 
                className="bg-success transition-all duration-500"
                style={{ width: `${(validCount / totalSignatures) * 100}%` }}
              />
              <div 
                className="bg-warning transition-all duration-500"
                style={{ width: `${(mismatchCount / totalSignatures) * 100}%` }}
              />
              <div 
                className="bg-destructive transition-all duration-500"
                style={{ width: `${(notFoundCount / totalSignatures) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Resizable Summary and Table Sections */}
      {validationResults.length > 0 && (
        <ResizablePanelGroup direction="vertical" className="min-h-[400px]">
          {/* Follow-up Summary Lists - Resizable */}
          <ResizablePanel defaultSize={35} minSize={15} maxSize={60}>
            <div className="p-4 bg-muted/30 h-full overflow-y-auto">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                📋 Signature Verification Summary
                <span className="text-xs text-muted-foreground font-normal ml-auto flex items-center gap-1">
                  <GripHorizontal className="h-3 w-3" />
                  Drag to resize
                </span>
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Valid Signatures */}
                <Collapsible open={showValidList} onOpenChange={setShowValidList}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full justify-between bg-success/10 border-success/30 hover:bg-success/20">
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-success" />
                        <span className="font-semibold text-success">Valid Signatures</span>
                        <Badge className="bg-success text-success-foreground ml-2">{validCount}</Badge>
                      </span>
                      {showValidList ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    <div className="bg-success/5 border border-success/20 rounded-lg p-3 max-h-full overflow-y-auto">
                      {validSignatures.length > 0 ? (
                        <ul className="space-y-1">
                          {validSignatures.map((sig, idx) => {
                            const lineItem = lineItems[sig.index] || {};
                            return (
                              <li key={idx} className="flex items-center gap-2 text-sm">
                                <CheckCircle2 className="h-3 w-3 text-success flex-shrink-0" />
                                <span className="font-medium">{sig.keyValue}</span>
                                <span className="text-muted-foreground">
                                  - {lineItem.City || lineItem.city || ''} {lineItem.Zip || lineItem.zip || ''}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">No valid signatures found</p>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* Invalid Signatures - For Follow-up */}
                <Collapsible open={showInvalidList} onOpenChange={setShowInvalidList}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full justify-between bg-destructive/10 border-destructive/30 hover:bg-destructive/20">
                      <span className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-destructive" />
                        <span className="font-semibold text-destructive">Invalid - Follow Up Required</span>
                        <Badge variant="destructive" className="ml-2">{invalidCount}</Badge>
                      </span>
                      {showInvalidList ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 max-h-full overflow-y-auto">
                      {invalidSignatures.length > 0 ? (
                        <ul className="space-y-2">
                          {invalidSignatures.map((sig, idx) => {
                            const lineItem = lineItems[sig.index] || {};
                            const isPartialMatch = sig.partialMatch;
                            const reason = isPartialMatch 
                              ? (sig.mismatchReason === 'address_mismatch' ? 'Address mismatch' : 'Partial match')
                              : (sig.found ? 'Mismatch' : 'Not in registry');
                            const iconColor = isPartialMatch ? 'text-warning' : 'text-destructive';
                            const badgeVariant = isPartialMatch ? 'secondary' : 'outline';
                            const badgeClass = isPartialMatch ? 'bg-warning/20 text-warning border-warning/30' : '';
                            return (
                              <li key={idx} className="flex items-start gap-2 text-sm border-b border-destructive/10 pb-2 last:border-0 last:pb-0">
                                {isPartialMatch ? (
                                  <AlertCircle className={`h-3 w-3 ${iconColor} flex-shrink-0 mt-0.5`} />
                                ) : (
                                  <XCircle className={`h-3 w-3 ${iconColor} flex-shrink-0 mt-0.5`} />
                                )}
                                <div>
                                  <span className="font-medium">{sig.keyValue}</span>
                                  <div className="text-muted-foreground text-xs">
                                    {lineItem.Address || lineItem.address || ''}, {lineItem.City || lineItem.city || ''} {lineItem.Zip || lineItem.zip || ''}
                                  </div>
                                  <Badge variant={badgeVariant} className={`mt-1 text-xs ${badgeClass}`}>{reason}</Badge>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="text-sm text-success italic flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          All signatures are valid!
                        </p>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </div>
          </ResizablePanel>
          
          <ResizableHandle withHandle className="bg-border hover:bg-primary/20 transition-colors" />
          
          {/* Signatures Table with Tabs - Resizable */}
          <ResizablePanel defaultSize={65} minSize={30}>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              <div className="border-b px-4 pt-2">
                <TabsList className="grid w-full max-w-md grid-cols-3">
                  <TabsTrigger value="all" className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    All ({validationResults.length})
                  </TabsTrigger>
                  <TabsTrigger value="review" className="flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4" />
                    For Review ({forReviewCount})
                  </TabsTrigger>
                  <TabsTrigger value="valid" className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Valid ({validCount})
                  </TabsTrigger>
                </TabsList>
              </div>
              
              {/* All Signatures Tab */}
              <TabsContent value="all" className="flex-1 overflow-auto m-0">
                <SignatureTable 
                  results={validationResults}
                  lineItems={lineItems}
                  expandedRows={expandedRows}
                  toggleRow={toggleRow}
                  referenceSignatures={referenceSignatures}
                  loadingSignatures={loadingSignatures}
                  onOverride={handleOverrideApprove}
                  showOverrideButton={false}
                />
              </TabsContent>
              
              {/* For Review Tab */}
              <TabsContent value="review" className="flex-1 overflow-auto m-0">
                {forReviewCount > 0 ? (
                  <SignatureTable 
                    results={forReviewItems}
                    lineItems={lineItems}
                    expandedRows={expandedRows}
                    toggleRow={toggleRow}
                    referenceSignatures={referenceSignatures}
                    loadingSignatures={loadingSignatures}
                    onOverride={handleOverrideApprove}
                    showOverrideButton={true}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                    <CheckCircle2 className="h-16 w-16 text-success mb-4" />
                    <h3 className="text-xl font-semibold text-success mb-2">All Clear!</h3>
                    <p className="text-muted-foreground">No items require manual review.</p>
                  </div>
                )}
              </TabsContent>
              
              {/* Valid Signatures Tab */}
              <TabsContent value="valid" className="flex-1 overflow-auto m-0">
                {validCount > 0 ? (
                  <SignatureTable 
                    results={validSignatures}
                    lineItems={lineItems}
                    expandedRows={expandedRows}
                    toggleRow={toggleRow}
                    referenceSignatures={referenceSignatures}
                    loadingSignatures={loadingSignatures}
                    onOverride={handleOverrideApprove}
                    showOverrideButton={false}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                    <AlertCircle className="h-16 w-16 text-muted-foreground mb-4" />
                    <h3 className="text-xl font-semibold text-muted-foreground mb-2">No Valid Signatures</h3>
                    <p className="text-muted-foreground">No signatures have been validated yet.</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </ResizablePanel>
        </ResizablePanelGroup>
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
