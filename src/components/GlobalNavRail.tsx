import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  LayoutDashboard, 
  ScanLine, 
  FolderOpen, 
  Settings, 
  ChevronLeft,
  ChevronRight,
  FileText,
  Users,
  BarChart3,
  Workflow
} from 'lucide-react';

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/admin' },
  { icon: ScanLine, label: 'Scanner', path: '/' },
  { icon: FolderOpen, label: 'Batches', path: '/batches' },
  { icon: FileText, label: 'Documents', path: '/admin/documents' },
  { icon: Workflow, label: 'Workflows', path: '/admin/workflows' },
  { icon: BarChart3, label: 'Analytics', path: '/admin/analytics' },
  { icon: Users, label: 'Users', path: '/admin/users', adminOnly: true },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

export function GlobalNavRail() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isExpanded, setIsExpanded] = useState(() => {
    return localStorage.getItem('navRailExpanded') === 'true';
  });

  const toggleExpanded = () => {
    const newValue = !isExpanded;
    setIsExpanded(newValue);
    localStorage.setItem('navRailExpanded', String(newValue));
  };

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  // Don't show on auth page
  if (location.pathname === '/auth') {
    return null;
  }

  return (
    <TooltipProvider delayDuration={0}>
      <nav 
        className={cn(
          "fixed left-0 top-0 h-full bg-sidebar border-r border-sidebar-border z-40 transition-all duration-200 flex flex-col",
          isExpanded ? "w-48" : "w-14"
        )}
      >
        {/* Logo area */}
        <div className={cn(
          "h-14 flex items-center border-b border-sidebar-border px-3",
          isExpanded ? "justify-between" : "justify-center"
        )}>
          {isExpanded && (
            <span className="font-semibold text-sidebar-foreground text-sm">WISDM</span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={toggleExpanded}
          >
            {isExpanded ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>

        {/* Navigation items */}
        <div className="flex-1 py-2 space-y-1 px-2">
          {navItems.map((item) => {
            const active = isActive(item.path);
            const Icon = item.icon;

            if (isExpanded) {
              return (
                <Button
                  key={item.path}
                  variant={active ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start gap-3 h-10",
                    active 
                      ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}
                  onClick={() => navigate(item.path)}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Button>
              );
            }

            return (
              <Tooltip key={item.path}>
                <TooltipTrigger asChild>
                  <Button
                    variant={active ? "secondary" : "ghost"}
                    size="icon"
                    className={cn(
                      "w-10 h-10",
                      active 
                        ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                    )}
                    onClick={() => navigate(item.path)}
                  >
                    <Icon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </nav>
    </TooltipProvider>
  );
}
