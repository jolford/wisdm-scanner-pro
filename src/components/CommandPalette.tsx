import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  
  { title: "Scheduled Batches", url: "/admin/scheduled-batches", icon: Clock, group: "Config" },
  { title: "Bulk Edit", url: "/admin/bulk-edit", icon: Edit3, group: "Advanced" },
  { title: "Document Reprocessing", url: "/admin/document-reprocessing", icon: RefreshCw, group: "Advanced" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  // Fetch batches for search
  const { data: batches } = useQuery({
    queryKey: ['command-palette-batches'],
    queryFn: async () => {
      const { data } = await supabase
        .from('batches')
        .select('id, batch_name, project:projects(name)')
        .order('created_at', { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: open,
  });

  // Fetch projects for search
  const { data: projects } = useQuery({
    queryKey: ['command-palette-projects'],
    queryFn: async () => {
      const { data } = await supabase
        .from('projects')
        .select('id, name')
        .order('created_at', { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: open,
  });

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

  // Reset search when dialog closes
  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  const groupedRoutes = adminRoutes.reduce((acc, route) => {
    if (!acc[route.group]) acc[route.group] = [];
    acc[route.group].push(route);
    return acc;
  }, {} as Record<string, typeof adminRoutes>);

  // Filter batches based on search
  const filteredBatches = batches?.filter(b => 
    b.batch_name.toLowerCase().includes(search.toLowerCase())
  ) || [];

  // Filter projects based on search
  const filteredProjects = projects?.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const openBatchInQueue = (batchId: string, projectId: string | null) => {
    if (projectId) {
      sessionStorage.setItem('selectedProjectId', projectId);
    }
    sessionStorage.setItem('selectedBatchId', batchId);
    setOpen(false);
    navigate('/');
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput 
        placeholder="Search batches, projects, pages..." 
        value={search}
        onValueChange={setSearch}
      />
      <CommandList className="max-h-[400px]">
        <CommandEmpty>No results found.</CommandEmpty>
        
        {/* Show batches when searching */}
        {search.length > 0 && filteredBatches.length > 0 && (
          <>
            <CommandGroup heading="Batches">
              {filteredBatches.slice(0, 5).map((batch) => (
                <CommandItem 
                  key={batch.id}
                  value={`batch-${batch.batch_name}`}
                  onSelect={() => openBatchInQueue(batch.id, (batch.project as any)?.id)}
                >
                  <Boxes className="mr-2 h-4 w-4" />
                  <span>{batch.batch_name}</span>
                  {(batch.project as any)?.name && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({(batch.project as any).name})
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Show projects when searching */}
        {search.length > 0 && filteredProjects.length > 0 && (
          <>
            <CommandGroup heading="Projects">
              {filteredProjects.slice(0, 5).map((project) => (
                <CommandItem 
                  key={project.id}
                  value={`project-${project.name}`}
                  onSelect={() => {
                    setOpen(false);
                    navigate(`/admin/projects/${project.id}`);
                  }}
                >
                  <FolderOpen className="mr-2 h-4 w-4" />
                  <span>{project.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}
        
        <CommandGroup heading="Quick Actions">
          <CommandItem 
            onSelect={() => {
              setOpen(false);
              navigate("/");
            }}
          >
            <Home className="mr-2 h-4 w-4" />
            <span>Go to Scanner</span>
          </CommandItem>
          <CommandItem 
            onSelect={() => {
              setOpen(false);
              navigate("/admin/projects/new");
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            <span>New Project</span>
          </CommandItem>
          <CommandItem 
            onSelect={() => {
              setOpen(false);
              navigate("/admin/batches/new");
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            <span>New Batch</span>
          </CommandItem>
          <CommandItem 
            onSelect={() => {
              setOpen(false);
              navigate("/admin/users/new");
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            <span>New User</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {Object.entries(groupedRoutes).map(([group, routes]) => (
          <CommandGroup key={group} heading={group}>
            {routes.map((route) => (
              <CommandItem 
                key={route.url} 
                onSelect={() => {
                  setOpen(false);
                  navigate(route.url);
                }}
              >
                <route.icon className="mr-2 h-4 w-4" />
                <span>{route.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}

        <CommandSeparator />

        <CommandGroup heading="Help & Resources">
          <CommandItem 
            onSelect={() => {
              setOpen(false);
              navigate("/help");
            }}
          >
            <BookOpen className="mr-2 h-4 w-4" />
            <span>Help Center</span>
          </CommandItem>
          <CommandItem 
            onSelect={() => {
              setOpen(false);
              navigate("/api-docs");
            }}
          >
            <FileText className="mr-2 h-4 w-4" />
            <span>API Documentation</span>
          </CommandItem>
          <CommandItem 
            onSelect={() => {
              setOpen(false);
              navigate("/release-notes");
            }}
          >
            <FileText className="mr-2 h-4 w-4" />
            <span>Release Notes</span>
          </CommandItem>
          <CommandItem 
            onSelect={() => {
              setOpen(false);
              navigate("/security-policy");
            }}
          >
            <Shield className="mr-2 h-4 w-4" />
            <span>Security Policy</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
