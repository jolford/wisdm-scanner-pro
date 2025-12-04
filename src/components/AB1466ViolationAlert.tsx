import { AlertTriangle, FileWarning, Shield } from 'lucide-react';
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

  return (
    <Alert className="border-amber-500/50 bg-amber-500/10 mb-4">
      <AlertTriangle className="h-5 w-5 text-amber-600" />
      <AlertTitle className="text-amber-700 flex items-center gap-2">
        California AB 1466 Compliance Alert
        <Badge variant="outline" className="bg-amber-500/20 text-amber-700 border-amber-500/30 text-xs">
          {violationCount} Violation{violationCount !== 1 ? 's' : ''} Detected
        </Badge>
        {redactionApplied && (
          <Badge variant="outline" className="bg-green-500/20 text-green-700 border-green-500/30 text-xs">
            <Shield className="h-3 w-3 mr-1" />
            Auto-Redacted
          </Badge>
        )}
      </AlertTitle>
      <AlertDescription className="text-amber-700/90 mt-2">
        <p className="mb-3">
          This document contains unlawfully restrictive covenant language that must be redacted 
          per California Assembly Bill 1466 before recording.
        </p>
        
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
                      <code 
                        key={`${v.term}-${idx}`}
                        className="text-xs bg-red-500/10 text-red-700 px-2 py-1 rounded border border-red-500/20"
                      >
                        "{v.text}"
                      </code>
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
