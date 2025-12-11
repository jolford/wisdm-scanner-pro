import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle2, XCircle, AlertCircle, Loader2, RefreshCw, Clock, 
  Users, FileCheck, FileX, ChevronDown, ChevronUp, PenTool, Info, GripHorizontal
} from 'lucide-react';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

  // Calculate statistics
  const totalSignatures = lineItems.length;
  const validSignatures = validationResults.filter(r => r.allMatch);
  const invalidSignatures = validationResults.filter(r => !r.allMatch);
  const validCount = validSignatures.length;
  const mismatchCount = validationResults.filter(r => r.found && !r.allMatch).length;
  const partialMatchCount = validationResults.filter(r => r.partialMatch).length;
  const notFoundCount = validationResults.filter(r => !r.found && !r.partialMatch).length;
  const signaturesPresent = validationResults.filter(r => r.signatureStatus?.present).length;
  const signaturesMissing = validationResults.filter(r => r.signatureStatus && !r.signatureStatus.present).length;
  const validPercentage = validationResults.length > 0 
    ? Math.round((validCount / totalSignatures) * 100) 
    : 0;
  const invalidCount = invalidSignatures.length;

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
        <div className="grid grid-cols-5 gap-3">
          <div className="bg-background/80 backdrop-blur rounded-lg p-3 text-center border">
            <div className="text-2xl font-bold text-foreground">{totalSignatures}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide mt-1">Total</div>
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
          
          {/* Signatures Table - Resizable */}
          <ResizablePanel defaultSize={65} minSize={30}>
            <div className="overflow-auto h-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Zip</TableHead>
                <TableHead className="w-24 text-center">Signature</TableHead>
                <TableHead className="w-24 text-center">Registry</TableHead>
                <TableHead className="w-20 text-center">Match</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {validationResults.map((result, idx) => {
                const lineItem = lineItems[result.index] || {};
                const isExpanded = expandedRows.has(idx);
                
                return (
                  <Collapsible key={idx} open={isExpanded} onOpenChange={() => toggleRow(idx)} asChild>
                    <>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <TableRow 
                              className={`cursor-pointer hover:bg-muted/50 ${
                                result.allMatch ? 'bg-success/5' : 
                                result.found ? 'bg-warning/5' : 'bg-destructive/5'
                              }`}
                              onClick={() => toggleRow(idx)}
                            >
                              <TableCell className="font-mono text-muted-foreground">{result.index + 1}</TableCell>
                              <TableCell className="font-medium">{result.keyValue}</TableCell>
                              <TableCell className="text-sm">{lineItem.Address || lineItem.address || '-'}</TableCell>
                              <TableCell className="text-sm">{lineItem.City || lineItem.city || '-'}</TableCell>
                              <TableCell className="text-sm font-mono">{lineItem.Zip || lineItem.zip || '-'}</TableCell>
                              <TableCell className="text-center">
                                {result.signatureStatus?.present ? (
                                  <Badge className="bg-success text-success-foreground">
                                    <PenTool className="h-3 w-3 mr-1" />
                                    Signed
                                  </Badge>
                                ) : (
                                  <Badge variant="destructive">
                                    <XCircle className="h-3 w-3 mr-1" />
                                    Missing
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {result.allMatch ? (
                                  <Badge className="bg-success text-success-foreground">
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    Valid
                                  </Badge>
                                ) : result.partialMatch ? (
                                  <Badge variant="secondary" className="bg-warning text-warning-foreground">
                                    <AlertCircle className="h-3 w-3 mr-1" />
                                    Addr. Mismatch
                                  </Badge>
                                ) : result.found ? (
                                  <Badge variant="secondary" className="bg-warning text-warning-foreground">
                                    <AlertCircle className="h-3 w-3 mr-1" />
                                    Mismatch
                                  </Badge>
                                ) : (
                                  <Badge variant="destructive">
                                    <XCircle className="h-3 w-3 mr-1" />
                                    Not Found
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {result.matchScore !== undefined && result.found ? (
                                  <span className={`font-mono text-sm ${
                                    result.matchScore >= 0.9 ? 'text-success' :
                                    result.matchScore >= 0.7 ? 'text-warning' : 'text-destructive'
                                  }`}>
                                    {Math.round(result.matchScore * 100)}%
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <CollapsibleTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    {isExpanded ? (
                                      <ChevronUp className="h-4 w-4" />
                                    ) : (
                                      <ChevronDown className="h-4 w-4" />
                                    )}
                                  </Button>
                                </CollapsibleTrigger>
                              </TableCell>
                            </TableRow>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-sm p-3">
                            {(() => {
                              // Build rejection reason tooltip
                              if (result.allMatch) {
                                return (
                                  <div className="flex items-center gap-2 text-success">
                                    <CheckCircle2 className="h-4 w-4" />
                                    <span>All fields match voter registry</span>
                                  </div>
                                );
                              }
                              
                              if (!result.found) {
                                return (
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-destructive font-medium">
                                      <XCircle className="h-4 w-4" />
                                      <span>Not found in voter registry</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                      No matching record found for "{result.keyValue}"
                                    </p>
                                  </div>
                                );
                              }
                              
                              // Found but mismatch - show which fields don't match
                              const mismatches = (result.validationResults || []).filter(fr => !fr.matches);
                              return (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 text-warning font-medium">
                                    <AlertCircle className="h-4 w-4" />
                                    <span>Field mismatch detected</span>
                                  </div>
                                  {mismatches.length > 0 ? (
                                    <ul className="text-xs space-y-1">
                                      {mismatches.map((m, i) => (
                                        <li key={i} className="flex flex-col">
                                          <span className="font-medium text-foreground">{m.field}:</span>
                                          <span className="text-muted-foreground">
                                            Document: "{m.wisdmValue || '(empty)'}" → Registry: "{m.excelValue || '(empty)'}"
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <p className="text-xs text-muted-foreground">Click to see details</p>
                                  )}
                                </div>
                              );
                            })()}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <CollapsibleContent asChild>
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={9} className="p-4">
                            <div className="flex gap-4">
                              {/* Reference Signature for valid entries */}
                              {result.allMatch && (() => {
                                const refSig = referenceSignatures.get(result.keyValue.toLowerCase());
                                return refSig?.signedUrl ? (
                                  <div className="flex-shrink-0 w-48">
                                    <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                                      <PenTool className="h-3 w-3" />
                                      Reference Signature
                                    </div>
                                    <div className="border rounded-lg p-2 bg-background">
                                      <img 
                                        src={refSig.signedUrl} 
                                        alt={`Reference signature for ${result.keyValue}`}
                                        className="w-full h-auto max-h-24 object-contain"
                                      />
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1 text-center">{refSig.name}</p>
                                  </div>
                                ) : result.allMatch && !loadingSignatures ? (
                                  <div className="flex-shrink-0 w-48">
                                    <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                                      <PenTool className="h-3 w-3" />
                                      Reference Signature
                                    </div>
                                    <div className="border rounded-lg p-4 bg-muted/50 text-center">
                                      <p className="text-xs text-muted-foreground">No reference on file</p>
                                    </div>
                                  </div>
                                ) : loadingSignatures ? (
                                  <div className="flex-shrink-0 w-48">
                                    <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                                      <PenTool className="h-3 w-3" />
                                      Reference Signature
                                    </div>
                                    <div className="border rounded-lg p-4 bg-muted/50 text-center">
                                      <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                                    </div>
                                  </div>
                                ) : null;
                              })()}
                              
                              {/* Field validation results */}
                              <div className="flex-1">
                                {result.validationResults && result.validationResults.length > 0 ? (
                                  <div className="grid grid-cols-2 gap-3">
                                    {result.validationResults.map((fieldResult, fieldIdx) => (
                                      <div
                                        key={fieldIdx}
                                        className={`p-3 rounded-lg border ${
                                          fieldResult.matches
                                            ? 'bg-success/10 border-success/20'
                                            : 'bg-warning/10 border-warning/20'
                                        }`}
                                      >
                                        <div className="flex items-center justify-between mb-2">
                                          <span className="font-semibold text-sm">{fieldResult.field}</span>
                                          {fieldResult.matches ? (
                                            <CheckCircle2 className="h-4 w-4 text-success" />
                                          ) : (
                                            <AlertCircle className="h-4 w-4 text-warning" />
                                          )}
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                          <div>
                                            <span className="text-muted-foreground">Document:</span>
                                            <div className="font-medium">{fieldResult.wisdmValue || '(empty)'}</div>
                                          </div>
                                          <div>
                                            <span className="text-muted-foreground">Registry:</span>
                                            <div className="font-medium">{fieldResult.excelValue || '(empty)'}</div>
                                          </div>
                                        </div>
                                        {!fieldResult.matches && fieldResult.suggestion && (
                                          <div className="mt-2 pt-2 border-t border-border/30 text-xs">
                                            <span className="text-muted-foreground">Suggestion: </span>
                                            <span className="font-medium">{fieldResult.suggestion}</span>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-muted-foreground">{result.message || 'No detailed results available'}</p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                );
              })}
            </TableBody>
          </Table>
            </div>
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
