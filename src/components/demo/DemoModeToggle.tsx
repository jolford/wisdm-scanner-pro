import { Play, X, Presentation, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDemoMode } from '@/contexts/DemoModeContext';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function DemoModeToggle() {
  const { isDemoMode, toggleDemoMode, startTour, isTourActive } = useDemoMode();

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      {isDemoMode && !isTourActive && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={startTour}
                size="lg"
                className="rounded-full shadow-lg bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white gap-2"
              >
                <Play className="h-5 w-5" />
                Start Guided Tour
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Begin the interactive product tour</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={toggleDemoMode}
              size="lg"
              variant={isDemoMode ? "destructive" : "default"}
              className={`rounded-full shadow-lg gap-2 ${
                !isDemoMode 
                  ? 'bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white' 
                  : ''
              }`}
            >
              {isDemoMode ? (
                <>
                  <X className="h-5 w-5" />
                  Exit Demo
                </>
              ) : (
                <>
                  <Presentation className="h-5 w-5" />
                  Demo Mode
                </>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>{isDemoMode ? 'Exit demo mode' : 'Enter demo mode for recording'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {isDemoMode && (
        <Badge 
          variant="secondary" 
          className="absolute -top-2 -left-2 bg-gradient-to-r from-amber-400 to-orange-500 text-white border-0"
        >
          <Sparkles className="h-3 w-3 mr-1" />
          LIVE
        </Badge>
      )}
    </div>
  );
}
