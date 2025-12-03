import { Sparkles, Video, Monitor } from 'lucide-react';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { Badge } from '@/components/ui/badge';

export function DemoBanner() {
  const { isDemoMode } = useDemoMode();

  if (!isDemoMode) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[90] bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white py-2 px-4 flex items-center justify-center gap-3 shadow-lg">
      <div className="flex items-center gap-2">
        <div className="relative">
          <Video className="h-5 w-5" />
          <span className="absolute -top-1 -right-1 h-2 w-2 bg-red-500 rounded-full animate-pulse" />
        </div>
        <span className="font-semibold">Demo Mode Active</span>
      </div>
      
      <div className="h-4 w-px bg-white/30" />
      
      <div className="flex items-center gap-4 text-sm">
        <Badge variant="secondary" className="bg-white/20 text-white border-0 gap-1">
          <Sparkles className="h-3 w-3" />
          Sample Data Loaded
        </Badge>
        <Badge variant="secondary" className="bg-white/20 text-white border-0 gap-1">
          <Monitor className="h-3 w-3" />
          Optimized for Recording
        </Badge>
      </div>
    </div>
  );
}
