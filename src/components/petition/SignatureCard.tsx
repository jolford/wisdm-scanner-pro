import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { 
  CheckCircle2, XCircle, AlertCircle, Loader2, 
  PenTool, ThumbsUp, ThumbsDown, ChevronDown, ChevronUp, User
} from 'lucide-react';
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
  rejected?: boolean;
  overrideBy?: string;
  overrideAt?: string;
}

interface ReferenceSignature {
  name: string;
  imageUrl: string;
  signedUrl?: string;
}

interface SignatureCardProps {
  result: ValidationResult;
  lineItem: Record<string, any>;
  isExpanded: boolean;
  onToggle: () => void;
  referenceSignature?: ReferenceSignature;
  loadingSignatures: boolean;
  onApprove?: () => void;
  onReject?: () => void;
  showActions: boolean;
}

export const SignatureCard = ({
  result,
  lineItem,
  isExpanded,
  onToggle,
  referenceSignature,
  loadingSignatures,
  onApprove,
  onReject,
  showActions,
}: SignatureCardProps) => {
  const isApproved = result.overrideApproved || result.allMatch;
  const isRejected = result.rejected;
  
  // Determine card border color
  const borderClass = isRejected 
    ? 'border-muted-foreground/30 opacity-60' 
    : isApproved 
      ? 'border-success/40' 
      : result.partialMatch 
        ? 'border-warning/40' 
        : !result.found 
          ? 'border-destructive/40' 
          : 'border-border';

  // Determine background
  const bgClass = isRejected
    ? 'bg-muted/30'
    : isApproved
      ? 'bg-success/5'
      : result.partialMatch
        ? 'bg-warning/5'
        : !result.found
          ? 'bg-destructive/5'
          : 'bg-card';

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <Card className={`${borderClass} ${bgClass} overflow-hidden transition-all`}>
        <div className="p-4">
          {/* Main row - compact */}
          <div className="flex items-center gap-4">
            {/* Index */}
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-mono text-muted-foreground">
              {result.index + 1}
            </div>
            
            {/* Name and status badges */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-foreground truncate">
                  {result.keyValue}
                </span>
                
                {/* Status badges - compact */}
                {isRejected ? (
                  <Badge variant="outline" className="text-xs bg-muted text-muted-foreground">
                    Rejected
                  </Badge>
                ) : result.overrideApproved ? (
                  <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/30">
                    Approved
                  </Badge>
                ) : null}
              </div>
              
              {/* Location - secondary info */}
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {lineItem.City || lineItem.city || ''}{lineItem.Zip ? `, ${lineItem.Zip}` : lineItem.zip ? `, ${lineItem.zip}` : ''}
              </p>
            </div>
            
            {/* Signature status */}
            <div className="flex-shrink-0">
              {result.signatureStatus?.present ? (
                <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-xs">
                  <PenTool className="h-3 w-3 mr-1" />
                  Signed
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-xs">
                  <XCircle className="h-3 w-3 mr-1" />
                  No Sig
                </Badge>
              )}
            </div>
            
            {/* Registry status */}
            <div className="flex-shrink-0">
              {isApproved ? (
                <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-xs">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Valid
                </Badge>
              ) : result.partialMatch ? (
                <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-xs">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Addr
                </Badge>
              ) : !result.found ? (
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-xs">
                  <XCircle className="h-3 w-3 mr-1" />
                  Not Found
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs">
                  Pending
                </Badge>
              )}
            </div>
            
            {/* Action buttons */}
            {showActions && !isRejected && !result.overrideApproved && (
              <div className="flex-shrink-0 flex gap-1">
                <Button 
                  size="sm" 
                  variant="outline"
                  className="h-8 bg-success/10 border-success/30 text-success hover:bg-success hover:text-success-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    onApprove?.();
                  }}
                >
                  <ThumbsUp className="h-3 w-3" />
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  className="h-8 bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReject?.();
                  }}
                >
                  <ThumbsDown className="h-3 w-3" />
                </Button>
              </div>
            )}
            
            {/* Expand toggle */}
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 flex-shrink-0">
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>
        
        {/* Expanded details */}
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-2 border-t border-border/50">
            <div className="flex gap-4">
              {/* Reference Signature */}
              {isApproved && (
                <div className="flex-shrink-0 w-40">
                  <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                    <PenTool className="h-3 w-3" />
                    Reference
                  </div>
                  {referenceSignature?.signedUrl ? (
                    <div className="border rounded-lg p-2 bg-background">
                      <img 
                        src={referenceSignature.signedUrl} 
                        alt={`Reference for ${result.keyValue}`}
                        className="w-full h-auto max-h-16 object-contain"
                      />
                    </div>
                  ) : loadingSignatures ? (
                    <div className="border rounded-lg p-3 bg-muted/50 text-center">
                      <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                    </div>
                  ) : (
                    <div className="border rounded-lg p-3 bg-muted/50 text-center">
                      <p className="text-xs text-muted-foreground">None on file</p>
                    </div>
                  )}
                </div>
              )}
              
              {/* Full address and details */}
              <div className="flex-1 space-y-3">
                <div>
                  <div className="text-xs font-semibold text-muted-foreground mb-1">Full Address</div>
                  <p className="text-sm">
                    {lineItem.Address || lineItem.address || '-'}, {lineItem.City || lineItem.city || '-'} {lineItem.Zip || lineItem.zip || '-'}
                  </p>
                </div>
                
                {/* Field validation details */}
                {result.validationResults && result.validationResults.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-2">Field Comparison</div>
                    <div className="grid grid-cols-2 gap-2">
                      {result.validationResults.map((fieldResult, idx) => (
                        <div
                          key={idx}
                          className={`p-2 rounded border text-xs ${
                            fieldResult.matches
                              ? 'bg-success/5 border-success/20'
                              : 'bg-warning/5 border-warning/20'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">{fieldResult.field}</span>
                            {fieldResult.matches ? (
                              <CheckCircle2 className="h-3 w-3 text-success" />
                            ) : (
                              <AlertCircle className="h-3 w-3 text-warning" />
                            )}
                          </div>
                          {!fieldResult.matches && (
                            <div className="text-muted-foreground">
                              "{fieldResult.wisdmValue}" → "{fieldResult.excelValue}"
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {!result.found && !result.partialMatch && (
                  <p className="text-sm text-destructive">
                    No matching record found in voter registry for "{result.keyValue}"
                  </p>
                )}
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
