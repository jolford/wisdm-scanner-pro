import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, XCircle, AlertCircle, Loader2, ChevronDown, ChevronUp, 
  PenTool, ThumbsUp 
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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

interface SignatureTableProps {
  results: ValidationResult[];
  lineItems: Array<Record<string, any>>;
  expandedRows: Set<number>;
  toggleRow: (index: number) => void;
  referenceSignatures: Map<string, ReferenceSignature>;
  loadingSignatures: boolean;
  onOverride: (index: number) => void;
  showOverrideButton: boolean;
}

export const SignatureTable = ({
  results,
  lineItems,
  expandedRows,
  toggleRow,
  referenceSignatures,
  loadingSignatures,
  onOverride,
  showOverrideButton,
}: SignatureTableProps) => {
  return (
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
          {showOverrideButton && <TableHead className="w-28 text-center">Action</TableHead>}
          <TableHead className="w-12"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {results.map((result, idx) => {
          const lineItem = lineItems[result.index] || {};
          const isExpanded = expandedRows.has(result.index);
          const isApproved = result.overrideApproved || result.allMatch;
          
          return (
            <Collapsible key={result.index} open={isExpanded} onOpenChange={() => toggleRow(result.index)} asChild>
              <>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TableRow 
                        className={`cursor-pointer hover:bg-muted/50 ${
                          isApproved ? 'bg-success/5' : 
                          result.found ? 'bg-warning/5' : 'bg-destructive/5'
                        }`}
                        onClick={() => toggleRow(result.index)}
                      >
                        <TableCell className="font-mono text-muted-foreground">{result.index + 1}</TableCell>
                        <TableCell className="font-medium">
                          {result.keyValue}
                          {result.overrideApproved && (
                            <Badge variant="outline" className="ml-2 text-xs bg-success/10 text-success border-success/30">
                              Approved
                            </Badge>
                          )}
                        </TableCell>
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
                          {isApproved ? (
                            <Badge className="bg-success text-success-foreground">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              {result.overrideApproved ? 'Approved' : 'Valid'}
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
                        {showOverrideButton && (
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            {!result.overrideApproved ? (
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="bg-success/10 border-success/30 text-success hover:bg-success hover:text-success-foreground"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOverride(result.index);
                                }}
                              >
                                <ThumbsUp className="h-3 w-3 mr-1" />
                                Approve
                              </Button>
                            ) : (
                              <Badge className="bg-success text-success-foreground">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Done
                              </Badge>
                            )}
                          </TableCell>
                        )}
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
                        if (isApproved) {
                          return (
                            <div className="flex items-center gap-2 text-success">
                              <CheckCircle2 className="h-4 w-4" />
                              <span>{result.overrideApproved ? 'Manually approved by operator' : 'All fields match voter registry'}</span>
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
                    <TableCell colSpan={showOverrideButton ? 10 : 9} className="p-4">
                      <div className="flex gap-4">
                        {/* Reference Signature for valid entries */}
                        {isApproved && (() => {
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
                          ) : isApproved && !loadingSignatures ? (
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
  );
};
