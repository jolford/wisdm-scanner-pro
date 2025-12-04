import { AlertTriangle, FileWarning, Shield, RefreshCw, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useState } from 'react';

interface AB1466Violation {
  term: string;
  category: string;
  text: string;
  confidence?: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface AB1466ViolationAlertProps {
  violationsDetected: boolean;
  violationCount: number;
  detectedTerms?: AB1466Violation[];
  redactionApplied?: boolean;
  onViewRedacted?: () => void;
  onRescan?: () => Promise<void>;
  isRescanning?: boolean;
}

const categoryLabels: Record<string, string> = {
  race: 'Race-Based',
  religion: 'Religious',
  national_origin: 'National Origin',
  restrictive_covenant: 'Restrictive Covenant',
  familial_status: 'Familial Status',
  disability: 'Disability',
};

const categoryColors: Record<string, string> = {
  race: 'bg-red-500/20 text-red-700 border-red-500/30',
  religion: 'bg-orange-500/20 text-orange-700 border-orange-500/30',
  national_origin: 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30',
  restrictive_covenant: 'bg-purple-500/20 text-purple-700 border-purple-500/30',
  familial_status: 'bg-blue-500/20 text-blue-700 border-blue-500/30',
  disability: 'bg-teal-500/20 text-teal-700 border-teal-500/30',
};

export function AB1466ViolationAlert({
  violationsDetected,
  violationCount,
  detectedTerms = [],
  redactionApplied,
  onViewRedacted,
  onRescan,
  isRescanning = false,
}: AB1466ViolationAlertProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!violationsDetected) {
    return null;
  }

  // Group violations by category
  const violationsByCategory = detectedTerms.reduce((acc, v) => {
    const cat = v.category || 'restrictive_covenant';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(v);
    return acc;
  }, {} as Record<string, AB1466Violation[]>);

  // Check if any violations are missing bounding boxes (need re-scan)
  const violationsWithoutBoxes = detectedTerms.filter(v => !v.boundingBox);
  const hasViolationsWithoutBoxes = violationsWithoutBoxes.length > 0;
  const violationsWithBoxes = detectedTerms.filter(v => v.boundingBox);

  return (
    <Alert className="border-amber-500/50 bg-amber-500/10 mb-4">
      <AlertTriangle className="h-5 w-5 text-amber-600" />
      <AlertTitle className="text-amber-700 flex items-center gap-2 flex-wrap">
        California AB 1466 Compliance Alert
        <Badge variant="outline" className="bg-amber-500/20 text-amber-700 border-amber-500/30 text-xs">
          {violationCount} Violation{violationCount !== 1 ? 's' : ''} Detected
        </Badge>
        {violationsWithBoxes.length > 0 && (
          <Badge variant="outline" className="bg-green-500/20 text-green-700 border-green-500/30 text-xs">
            <Shield className="h-3 w-3 mr-1" />
            {violationsWithBoxes.length} Redacted
          </Badge>
        )}
        {hasViolationsWithoutBoxes && (
          <Badge variant="outline" className="bg-orange-500/20 text-orange-700 border-orange-500/30 text-xs">
            {violationsWithoutBoxes.length} Need Location
          </Badge>
        )}
      </AlertTitle>
      <AlertDescription className="text-amber-700/90 mt-2">
        <p className="mb-3">
          This document contains unlawfully restrictive covenant language that must be redacted 
          per California Assembly Bill 1466 before recording.
        </p>
        
        {hasViolationsWithoutBoxes && onRescan && (
          <div className="mb-3 p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
            <p className="text-sm mb-2 text-orange-700">
              <strong>{violationsWithoutBoxes.length}</strong> violation{violationsWithoutBoxes.length !== 1 ? 's' : ''} detected but could not be visually located. 
              Re-scan to identify exact positions for redaction.
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onRescan}
              disabled={isRescanning}
              className="bg-orange-500/10 border-orange-500/30 hover:bg-orange-500/20 text-orange-700"
            >
              {isRescanning ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {isRescanning ? 'Scanning...' : 'Re-scan for Locations'}
            </Button>
          </div>
        )}
        
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="mb-2 bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20">
              <FileWarning className="h-4 w-4 mr-2" />
              {isOpen ? 'Hide' : 'View'} Detected Terms
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-3 mt-3 p-3 bg-background/50 rounded-lg border border-amber-500/20">
              {Object.entries(violationsByCategory).map(([category, violations]) => (
                <div key={category}>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${categoryColors[category] || 'bg-gray-500/20 text-gray-700'}`}
                    >
                      {categoryLabels[category] || category}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      ({violations.length} occurrence{violations.length !== 1 ? 's' : ''})
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {violations.map((v, idx) => (
                      <div key={`${v.term}-${idx}`} className="flex items-center gap-1">
                        <code 
                          className={`text-xs px-2 py-1 rounded border ${
                            v.boundingBox 
                              ? 'bg-green-500/10 text-green-700 border-green-500/20' 
                              : 'bg-red-500/10 text-red-700 border-red-500/20'
                          }`}
                        >
                          "{v.text.length > 50 ? v.text.substring(0, 50) + '...' : v.text}"
                        </code>
                        {v.boundingBox ? (
                          <span title="Redacted"><Shield className="h-3 w-3 text-green-600" /></span>
                        ) : (
                          <span title="Location unknown"><AlertTriangle className="h-3 w-3 text-orange-600" /></span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {redactionApplied && onViewRedacted && (
          <div className="mt-3">
            <Button 
              variant="default" 
              size="sm" 
              onClick={onViewRedacted}
              className="bg-green-600 hover:bg-green-700"
            >
              <Shield className="h-4 w-4 mr-2" />
              View Redacted Version
            </Button>
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}
