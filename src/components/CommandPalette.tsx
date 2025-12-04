import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Home,
  FolderOpen,
  Users,
  Settings,
  BarChart3,
  FileText,
  Plus,
  BookOpen,
  Shield,
  Boxes,
  Key,
  Building2,
  AlertTriangle,
  Target,
  Webhook,
  GitBranch,
  Brain,
  Package,
  DollarSign,
  Palette,
  Clock,
  Code,
  RefreshCw,
  Edit3,
  Smartphone,
  Search,
  Activity,
  Gauge,
  KeyRound,
  UserCog,
  Bug,
  Zap,
  History,
} from "lucide-react";

const adminRoutes = [
  { title: "Dashboard", url: "/admin", icon: Home, group: "Overview" },
  { title: "Projects", url: "/admin/projects", icon: FolderOpen, group: "Core" },
  { title: "Batches", url: "/admin/batches", icon: FileText, group: "Core" },
  { title: "Documents", url: "/admin/documents", icon: FileText, group: "Core" },
  { title: "Users", url: "/admin/users", icon: Users, group: "Core" },
  { title: "Customers", url: "/admin/customers", icon: Building2, group: "Core" },
  { title: "Licenses", url: "/admin/licenses", icon: Key, group: "Core" },
  { title: "Mobile Validation", url: "/admin/mobile-validation", icon: Smartphone, group: "Core" },
  { title: "Workflow Builder", url: "/admin/workflow-builder", icon: GitBranch, group: "Automation" },
  { title: "Workflow Management", url: "/admin/workflows", icon: History, group: "Automation" },
  { title: "Batch Templates", url: "/admin/batch-templates", icon: Zap, group: "Automation" },
  { title: "Smart Routing", url: "/admin/smart-routing", icon: GitBranch, group: "Automation" },
  { title: "ML Learning", url: "/admin/ml-learning", icon: Brain, group: "Automation" },
  { title: "Integrations", url: "/admin/integrations", icon: Package, group: "Automation" },
  { title: "Webhooks", url: "/admin/webhooks", icon: Webhook, group: "Automation" },
  { title: "Exception Queue", url: "/admin/exceptions", icon: AlertTriangle, group: "Quality" },
  { title: "Confidence Scoring", url: "/admin/confidence", icon: Target, group: "Quality" },
  { title: "Validation Analytics", url: "/admin/analytics", icon: BarChart3, group: "Quality" },
  { title: "SLA Monitoring", url: "/admin/sla-monitoring", icon: Gauge, group: "Quality" },
  { title: "QA Metrics", url: "/admin/qa-metrics", icon: Activity, group: "Quality" },
  { title: "Error Logs", url: "/admin/error-logs", icon: Bug, group: "Quality" },
  { title: "Advanced Search", url: "/admin/advanced-search", icon: Search, group: "Quality" },
  { title: "Business Metrics", url: "/admin/business-metrics", icon: BarChart3, group: "Sales" },
  { title: "Cost Tracking", url: "/admin/cost-tracking", icon: DollarSign, group: "Sales" },
  { title: "System Viability", url: "/admin/system-viability", icon: Settings, group: "Sales" },
  { title: "White Label", url: "/admin/white-label", icon: Palette, group: "Sales" },
  { title: "Validation Rules", url: "/admin/validation-rules", icon: Shield, group: "Config" },
  { title: "SSO/SAML Config", url: "/admin/sso", icon: KeyRound, group: "Config" },
  { title: "SCIM Provisioning", url: "/admin/scim", icon: UserCog, group: "Config" },
  { title: "Custom Scripts", url: "/admin/custom-scripts", icon: Code, group: "Config" },
  { title: "Scheduled Batches", url: "/admin/scheduled-batches", icon: Clock, group: "Config" },
  { title: "Bulk Edit", url: "/admin/bulk-edit", icon: Edit3, group: "Advanced" },
  { title: "Document Reprocessing", url: "/admin/document-reprocessing", icon: RefreshCw, group: "Advanced" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  const groupedRoutes = adminRoutes.reduce((acc, route) => {
    if (!acc[route.group]) acc[route.group] = [];
    acc[route.group].push(route);
    return acc;
  }, {} as Record<string, typeof adminRoutes>);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search commands, pages, actions..." />
      <CommandList className="max-h-[400px]">
        <CommandEmpty>No results found.</CommandEmpty>
        
        <CommandGroup heading="Quick Actions">
          <CommandItem onSelect={() => runCommand(() => navigate("/"))}>
            <Home className="mr-2 h-4 w-4" />
            <span>Go to Scanner</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/admin/projects/new"))}>
            <Plus className="mr-2 h-4 w-4" />
            <span>New Project</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/admin/batches/new"))}>
            <Plus className="mr-2 h-4 w-4" />
            <span>New Batch</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/admin/users/new"))}>
            <Plus className="mr-2 h-4 w-4" />
            <span>New User</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {Object.entries(groupedRoutes).map(([group, routes]) => (
          <CommandGroup key={group} heading={group}>
            {routes.map((route) => (
              <CommandItem key={route.url} onSelect={() => runCommand(() => navigate(route.url))}>
                <route.icon className="mr-2 h-4 w-4" />
                <span>{route.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}

        <CommandSeparator />

        <CommandGroup heading="Help & Resources">
          <CommandItem onSelect={() => runCommand(() => navigate("/help"))}>
            <BookOpen className="mr-2 h-4 w-4" />
            <span>Help Center</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/api-docs"))}>
            <FileText className="mr-2 h-4 w-4" />
            <span>API Documentation</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/release-notes"))}>
            <FileText className="mr-2 h-4 w-4" />
            <span>Release Notes</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/security-policy"))}>
            <Shield className="mr-2 h-4 w-4" />
            <span>Security Policy</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
