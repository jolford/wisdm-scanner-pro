import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Project {
  id: string;
  name: string;
  description: string;
  extraction_fields: any;
}

interface ProjectSelectorProps {
  selectedProjectId: string | null;
  onProjectSelect: (projectId: string, project: Project) => void;
}

export const ProjectSelector = ({ selectedProjectId, onProjectSelect }: ProjectSelectorProps) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  return (
    <Card className="p-6 bg-gradient-to-br from-card to-card/80 shadow-[var(--shadow-elegant)]">
      <div className="space-y-4">
        <div>
          <Label htmlFor="project">Select Project *</Label>
          <Select
            value={selectedProjectId || ''}
            onValueChange={(value) => {
              const project = projects.find(p => p.id === value);
              if (project) onProjectSelect(value, project);
            }}
            disabled={loading}
          >
            <SelectTrigger id="project">
              <SelectValue placeholder={loading ? 'Loading projects...' : 'Choose a project'} />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedProject && (
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm font-medium mb-2">Extraction Fields:</p>
            <div className="flex flex-wrap gap-2">
              {(selectedProject.extraction_fields as any[])?.map((field, idx) => (
                <span key={idx} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                  {field.name}
                </span>
              ))}
            </div>
            {selectedProject.description && (
              <p className="text-xs text-muted-foreground mt-3">{selectedProject.description}</p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};
