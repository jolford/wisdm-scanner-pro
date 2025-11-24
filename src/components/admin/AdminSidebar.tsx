import { 
  LayoutDashboard, FolderKanban, FileText, Users, Key, Building2, 
  Target, AlertTriangle, Webhook, Copy, Shield, Clock,
  BarChart2, DollarSign, TrendingUp, Edit3, GitCompare,
  Brain, TestTube2, RefreshCw, Database, Palette, Activity,
  BookOpen, Settings, LogOut, HelpCircle, GitBranch, FileType,
  Smartphone, Package
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

const menuItems = [
  {
    title: 'Overview',
    items: [
      { title: 'Dashboard', url: '/admin', icon: LayoutDashboard, end: true },
    ],
  },
  {
    title: 'Core Management',
    items: [
      { title: 'Projects', url: '/admin/projects', icon: FolderKanban },
      { title: 'Batches', url: '/admin/batches', icon: FileText },
      { title: 'Documents', url: '/admin/documents', icon: FileText },
      { title: 'Users', url: '/admin/users', icon: Users },
      { title: 'Licenses', url: '/admin/licenses', icon: Key },
      { title: 'Customers', url: '/admin/customers', icon: Building2 },
    ],
  },
  {
    title: 'Intelligence & Tools',
    items: [
      { title: 'ML Learning', url: '/admin/ml-learning', icon: Brain },
      { title: 'Smart Routing', url: '/admin/smart-routing', icon: GitBranch },
      { title: 'ML Templates', url: '/admin/ml-templates', icon: FileType },
      { title: 'Mobile Validation', url: '/admin/mobile-validation', icon: Smartphone },
      { title: 'Workflow Builder', url: '/admin/workflow-builder', icon: GitBranch },
      { title: 'Integrations', url: '/admin/integrations', icon: Package },
      { title: 'Barcode Test', url: '/admin/barcode-test', icon: TestTube2 },
      { title: 'Document Reprocessing', url: '/admin/document-reprocessing', icon: RefreshCw },
    ],
  },
  {
    title: 'Quality & Automation',
    items: [
      { title: 'Validation Lookups', url: '/admin/validation-lookups', icon: Database },
      { title: 'Confidence Scoring', url: '/admin/confidence', icon: Target },
      { title: 'Exception Queue', url: '/admin/exceptions', icon: AlertTriangle },
      { title: 'Webhooks', url: '/admin/webhooks', icon: Webhook },
      { title: 'Duplicate Detection', url: '/admin/duplicates', icon: Copy },
      { title: 'Validation Rules', url: '/admin/validation-rules', icon: Shield },
      { title: 'Scheduled Batches', url: '/admin/scheduled-batches', icon: Clock },
    ],
  },
  {
    title: 'Analytics & Operations',
    items: [
      { title: 'Validation Analytics', url: '/admin/analytics', icon: BarChart2 },
      { title: 'Business Metrics', url: '/admin/business-metrics', icon: TrendingUp },
      { title: 'Cost Tracking', url: '/admin/cost-tracking', icon: DollarSign },
      { title: 'QA Metrics', url: '/admin/qa-metrics', icon: Activity },
      { title: 'Bulk Edit', url: '/admin/bulk-edit', icon: Edit3 },
      { title: 'Document Comparison', url: '/admin/document-comparison', icon: GitCompare },
    ],
  },
  {
    title: 'Settings',
    items: [
      { title: 'White Label', url: '/admin/white-label', icon: Palette },
      { title: 'Credential Migration', url: '/admin/credential-migration', icon: Shield },
      { title: 'System Viability', url: '/admin/system-viability', icon: Settings },
      { title: 'Release Notes', url: '/admin/release-notes', icon: BookOpen },
    ],
  },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const navigate = useNavigate();
  const collapsed = state === 'collapsed';

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logged out successfully');
    navigate('/auth');
  };

  return (
    <Sidebar className={collapsed ? 'w-16' : 'w-64'} collapsible="icon">
      <SidebarContent className="overflow-y-auto">
        {menuItems.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel className="text-xs uppercase tracking-wider">
              {!collapsed && group.title}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
                          end={item.end}
                          className="flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:bg-accent"
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
          </SidebarGroup>
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
