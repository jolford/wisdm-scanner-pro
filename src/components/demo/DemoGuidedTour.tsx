import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { cn } from '@/lib/utils';

export function DemoGuidedTour() {
  const { 
    isTourActive, 
    currentStep, 
    totalSteps, 
    nextStep, 
    prevStep, 
    endTour,
    demoSteps 
  } = useDemoMode();
  
  const [position, setPosition] = useState({ top: '50%', left: '50%' });
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);

  const currentStepData = demoSteps[currentStep];
  const progress = ((currentStep + 1) / totalSteps) * 100;

  useEffect(() => {
    if (!isTourActive || !currentStepData) return;

    const targetElement = document.querySelector(currentStepData.targetSelector);
    
    if (targetElement) {
      const rect = targetElement.getBoundingClientRect();
      setHighlightRect(rect);
      
      // Calculate tooltip position based on target element and preferred position
      const padding = 20;
      let top = '50%';
      let left = '50%';
      
      switch (currentStepData.position) {
        case 'top':
          top = `${rect.top - padding}px`;
          left = `${rect.left + rect.width / 2}px`;
          break;
        case 'bottom':
          top = `${rect.bottom + padding}px`;
          left = `${rect.left + rect.width / 2}px`;
          break;
        case 'left':
          top = `${rect.top + rect.height / 2}px`;
          left = `${rect.left - padding}px`;
          break;
        case 'right':
          top = `${rect.top + rect.height / 2}px`;
          left = `${rect.right + padding}px`;
          break;
      }
      
      setPosition({ top, left });
    } else {
      setHighlightRect(null);
      setPosition({ top: '50%', left: '50%' });
    }
  }, [isTourActive, currentStep, currentStepData]);

  if (!isTourActive) return null;

  return (
    <>
      {/* Backdrop overlay */}
      <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm transition-opacity duration-300" />
      
      {/* Spotlight highlight */}
      {highlightRect && (
        <div
          className="fixed z-[101] rounded-lg ring-4 ring-primary/50 ring-offset-4 ring-offset-transparent transition-all duration-300 pointer-events-none"
          style={{
            top: highlightRect.top - 8,
            left: highlightRect.left - 8,
            width: highlightRect.width + 16,
            height: highlightRect.height + 16,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6), 0 0 40px 8px rgba(139, 92, 246, 0.3)',
          }}
        />
      )}

      {/* Tour card */}
      <Card
        className={cn(
          "fixed z-[102] w-[400px] shadow-2xl border-2 border-primary/20 bg-gradient-to-br from-background to-muted/50 transition-all duration-300",
          currentStepData?.position === 'top' && '-translate-x-1/2 -translate-y-full',
          currentStepData?.position === 'bottom' && '-translate-x-1/2',
          currentStepData?.position === 'left' && '-translate-x-full -translate-y-1/2',
          currentStepData?.position === 'right' && '-translate-y-1/2',
          !highlightRect && '-translate-x-1/2 -translate-y-1/2'
        )}
        style={{ top: position.top, left: position.left }}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-full bg-gradient-to-r from-violet-500 to-purple-600">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <CardTitle className="text-lg">{currentStepData?.title}</CardTitle>
            </div>
            <Button variant="ghost" size="icon" onClick={endTour} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Progress value={progress} className="h-1.5 mt-2" />
        </CardHeader>
        
        <CardContent className="pb-4">
          <p className="text-muted-foreground leading-relaxed">
            {currentStepData?.description}
          </p>
        </CardContent>
        
        <CardFooter className="flex items-center justify-between border-t pt-4">
          <span className="text-sm text-muted-foreground font-medium">
            Step {currentStep + 1} of {totalSteps}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={prevStep}
              disabled={currentStep === 0}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              size="sm"
              onClick={nextStep}
              className="gap-1 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
            >
              {currentStep === totalSteps - 1 ? 'Finish' : 'Next'}
              {currentStep < totalSteps - 1 && <ChevronRight className="h-4 w-4" />}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </>
  );
}
