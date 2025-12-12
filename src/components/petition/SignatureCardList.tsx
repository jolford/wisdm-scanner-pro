import { SignatureCard } from './SignatureCard';

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

interface SignatureCardListProps {
  results: ValidationResult[];
  lineItems: Array<Record<string, any>>;
  expandedRows: Set<number>;
  toggleRow: (index: number) => void;
  referenceSignatures: Map<string, ReferenceSignature>;
  loadingSignatures: boolean;
  onApprove: (index: number) => void;
  onReject: (index: number) => void;
  showActions: boolean;
}

export const SignatureCardList = ({
  results,
  lineItems,
  expandedRows,
  toggleRow,
  referenceSignatures,
  loadingSignatures,
  onApprove,
  onReject,
  showActions,
}: SignatureCardListProps) => {
  if (results.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No signatures to display
      </div>
    );
  }

  return (
    <div className="space-y-1.5 p-2">
      {results.map((result) => {
        const lineItem = lineItems[result.index] || {};
        const refSig = referenceSignatures.get(result.keyValue.toLowerCase());
        
        return (
          <SignatureCard
            key={result.index}
            result={result}
            lineItem={lineItem}
            isExpanded={expandedRows.has(result.index)}
            onToggle={() => toggleRow(result.index)}
            referenceSignature={refSig}
            loadingSignatures={loadingSignatures}
            onApprove={() => onApprove(result.index)}
            onReject={() => onReject(result.index)}
            showActions={showActions}
          />
        );
      })}
    </div>
  );
};
