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
  ClipboardList,
  Users,
  Settings,
  BarChart3,
  FileText,
  Plus,
  Search,
  BookOpen,
  Shield,
  Boxes,
} from "lucide-react";

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

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => runCommand(() => navigate("/"))}>
            <Home className="mr-2 h-4 w-4" />
            <span>Home</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/batches"))}>
            <Boxes className="mr-2 h-4 w-4" />
            <span>Batches</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/"))}>
            <ClipboardList className="mr-2 h-4 w-4" />
            <span>Queue</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/settings"))}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Admin">
          <CommandItem onSelect={() => runCommand(() => navigate("/admin"))}>
            <BarChart3 className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/admin/projects"))}>
            <FolderOpen className="mr-2 h-4 w-4" />
            <span>Projects</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/admin/users"))}>
            <Users className="mr-2 h-4 w-4" />
            <span>Users</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/admin/documents"))}>
            <FileText className="mr-2 h-4 w-4" />
            <span>Documents</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/admin/analytics"))}>
            <BarChart3 className="mr-2 h-4 w-4" />
            <span>Analytics</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Quick Actions">
          <CommandItem onSelect={() => runCommand(() => navigate("/admin/projects/new"))}>
            <Plus className="mr-2 h-4 w-4" />
            <span>New Project</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/admin/batches/new"))}>
            <Plus className="mr-2 h-4 w-4" />
            <span>New Batch</span>
          </CommandItem>
        </CommandGroup>

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
          <CommandItem onSelect={() => runCommand(() => navigate("/security-policy"))}>
            <Shield className="mr-2 h-4 w-4" />
            <span>Security Policy</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
