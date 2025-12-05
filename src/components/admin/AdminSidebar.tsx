import { 
  LayoutDashboard, FolderKanban, FileText, Users, Key, Building2, 
  Target, AlertTriangle, Webhook, Shield, Clock,
  BarChart2, DollarSign, TrendingUp,
  Brain, RefreshCw, Database, Palette, Activity,
  Settings, LogOut, HelpCircle, GitBranch, FileType,
  Smartphone, Package, ChevronDown, History, Zap, Bug, Code,
  KeyRound, UserCog, Gauge
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

const menuItems = [
  {
    title: 'Overview',
    items: [
      { title: 'Dashboard', url: '/admin', icon: LayoutDashboard, end: true },
    ],
    defaultOpen: true,
  },
  {
    title: 'Batch Management',
    items: [
      { title: 'Projects', url: '/admin/projects', icon: FolderKanban },
      { title: 'Batches', url: '/admin/batches', icon: FileText },
      { title: 'Documents', url: '/admin/documents', icon: FileText },
      { title: 'Mobile Validation', url: '/admin/mobile-validation', icon: Smartphone },
    ],
    defaultOpen: true,
  },
  {
    title: 'Security Settings',
    items: [
      { title: 'Users', url: '/admin/users', icon: Users },
      { title: 'Customers', url: '/admin/customers', icon: Building2 },
      { title: 'Licenses', url: '/admin/licenses', icon: Key },
      { title: 'Credential Migration', url: '/admin/credential-migration', icon: Shield },
    ],
    defaultOpen: false,
  },
  {
    title: 'Automation & Intelligence',
    items: [
      { title: 'Workflow Builder', url: '/admin/workflow-builder', icon: GitBranch },
      { title: 'Workflow Management', url: '/admin/workflows', icon: History },
      { title: 'Batch Templates', url: '/admin/batch-templates', icon: Zap },
      { title: 'Smart Routing', url: '/admin/smart-routing', icon: GitBranch },
      { title: 'ML Learning', url: '/admin/ml-learning', icon: Brain },
      { title: 'Integrations', url: '/admin/integrations', icon: Package },
      { title: 'Webhooks', url: '/admin/webhooks', icon: Webhook },
    ],
    defaultOpen: false,
  },
  {
    title: 'Quality & Analytics',
    items: [
      { title: 'Exception Queue', url: '/admin/exceptions', icon: AlertTriangle },
      { title: 'Confidence Scoring', url: '/admin/confidence', icon: Target },
      { title: 'Validation Analytics', url: '/admin/analytics', icon: BarChart2 },
      { title: 'SLA Monitoring', url: '/admin/sla-monitoring', icon: Gauge },
      { title: 'QA Metrics', url: '/admin/qa-metrics', icon: Activity },
      { title: 'Error Logs', url: '/admin/error-logs', icon: Bug },
    ],
    defaultOpen: false,
  },
  {
    title: 'Sales Tools',
    items: [
      { title: 'Business Metrics', url: '/admin/business-metrics', icon: TrendingUp },
      { title: 'Cost Tracking', url: '/admin/cost-tracking', icon: DollarSign },
      { title: 'System Viability', url: '/admin/system-viability', icon: Settings },
      { title: 'White Label', url: '/admin/white-label', icon: Palette },
    ],
    defaultOpen: false,
  },
  {
    title: 'Configuration',
    items: [
      { title: 'Validation Rules', url: '/admin/validation-rules', icon: Shield },
      { title: 'Validation Lookups', url: '/admin/validation-lookups', icon: Database },
      { title: 'SSO/SAML Config', url: '/admin/sso', icon: KeyRound },
      { title: 'SCIM Provisioning', url: '/admin/scim', icon: UserCog },
      { title: 'Custom Scripts', url: '/admin/custom-scripts', icon: Code },
      { title: 'Scheduled Batches', url: '/admin/scheduled-batches', icon: Clock },
    ],
    defaultOpen: false,
  },
  {
    title: 'Advanced',
    items: [
      { title: 'ML Templates', url: '/admin/ml-templates', icon: FileType },
      { title: 'Document Reprocessing', url: '/admin/document-reprocessing', icon: RefreshCw },
    ],
    defaultOpen: false,
  },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const navigate = useNavigate();
  const location = useLocation();
  const collapsed = state === 'collapsed';

  // Initialize group states from localStorage or defaults
  const [groupStates, setGroupStates] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('admin-sidebar-groups');
    if (saved) {
      return JSON.parse(saved);
    }
    // Set defaults
    const defaults: Record<string, boolean> = {};
    menuItems.forEach(group => {
      defaults[group.title] = group.defaultOpen ?? true;
    });
    return defaults;
  });

  // Check if current route is in a group to auto-expand it
  useEffect(() => {
    const currentGroup = menuItems.find(group =>
      group.items.some(item => location.pathname === item.url)
    );
    if (currentGroup && !groupStates[currentGroup.title]) {
      setGroupStates(prev => {
        const updated = { ...prev, [currentGroup.title]: true };
        localStorage.setItem('admin-sidebar-groups', JSON.stringify(updated));
        return updated;
      });
    }
  }, [location.pathname]);

  const toggleGroup = (title: string) => {
    setGroupStates(prev => {
      const updated = { ...prev, [title]: !prev[title] };
      localStorage.setItem('admin-sidebar-groups', JSON.stringify(updated));
      return updated;
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logged out successfully');
    navigate('/auth');
  };

  return (
    <Sidebar className={collapsed ? 'w-16' : 'w-64'} collapsible="icon">
      <SidebarContent className="overflow-y-auto">
        {menuItems.map((group) => (
          <Collapsible
            key={group.title}
            open={groupStates[group.title]}
            onOpenChange={() => toggleGroup(group.title)}
          >
            <SidebarGroup>
              <CollapsibleTrigger asChild>
                <SidebarGroupLabel className="text-xs uppercase tracking-wider cursor-pointer hover:bg-accent rounded-md flex items-center justify-between">
                  {!collapsed && (
                    <>
                      <span>{group.title}</span>
                      <ChevronDown 
                        className={`h-4 w-4 transition-transform ${
                          groupStates[group.title] ? '' : '-rotate-90'
                        }`}
                      />
                    </>
                  )}
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      // Add demo markers for specific menu items
                      const demoClass = 
                        item.url === '/admin/workflow-builder' ? 'demo-workflows' :
                        item.url === '/admin/integrations' ? 'demo-integrations' :
                        item.url === '/admin/analytics' ? 'demo-analytics' :
                        item.url === '/admin/credential-migration' ? 'demo-security' :
                        '';
                      return (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton asChild>
                            <NavLink
                              to={item.url}
                              end={item.end}
                              className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:bg-accent ${demoClass}`}
                              activeClassName="bg-primary/10 text-primary font-medium"
                            >
                              <Icon className="h-4 w-4 flex-shrink-0" />
                              {!collapsed && <span>{item.title}</span>}
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <Separator />
        <div className="p-2 space-y-2">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => navigate('/help')}
          >
            <HelpCircle className="h-4 w-4 mr-2" />
            {!collapsed && 'Help Center'}
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => navigate('/')}
          >
            <LayoutDashboard className="h-4 w-4 mr-2" />
            {!collapsed && 'Back to Scanner'}
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            {!collapsed && 'Logout'}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
