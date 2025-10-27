import { useNavigate, useParams } from 'react-router-dom';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { safeErrorMessage } from '@/lib/error-handler';
import { z } from 'zod';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';

const customerSchema = z.object({
  company_name: z.string().min(1, 'Company name is required').max(200),
  contact_name: z.string().max(200).optional(),
  contact_email: z.string().email('Invalid email address').max(200),
  phone: z.string().max(50).optional(),
});

const EditCustomer = () => {
  const { loading, isAdmin } = useRequireAuth(true);
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  type Project = { id: string; name: string };
  const [formData, setFormData] = useState({
    company_name: '',
    contact_name: '',
    contact_email: '',
    phone: '',
  });
  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [availableProjects, setAvailableProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [loadingProjects, setLoadingProjects] = useState<boolean>(true);

  useEffect(() => {
    if (!loading && isAdmin && id) {
      loadCustomer();
      loadProjectsForCustomer();
    }
  }, [loading, isAdmin, id]);

  const loadCustomer = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setFormData({
          company_name: data.company_name,
          contact_name: data.contact_name || '',
          contact_email: data.contact_email,
          phone: data.phone || '',
        });
      }
    } catch (error: any) {
      toast.error('Failed to load customer: ' + error.message);
      navigate('/admin/customers');
    } finally {
      setLoadingData(false);
    }
  };

  const loadProjectsForCustomer = async () => {
    if (!id) return;
    try {
      setLoadingProjects(true);
      const [{ data: custProjects }, { data: unassigned }] = await Promise.all([
        supabase.from('projects').select('id, name').eq('customer_id', id).order('name'),
        supabase.from('projects').select('id, name').is('customer_id', null).eq('is_active', true).order('name')
      ]);
      setProjects(custProjects || []);
      setAvailableProjects(unassigned || []);
    } catch (error: any) {
      toast.error('Failed to load projects: ' + error.message);
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleAssignProject = async () => {
    if (!id || !selectedProjectId) {
      toast.error('Please select a project to assign');
      return;
    }
    try {
      const { error } = await supabase
        .from('projects')
        .update({ customer_id: id })
        .eq('id', selectedProjectId);
      if (error) throw error;
      toast.success('Project assigned');
      setSelectedProjectId('');
      await loadProjectsForCustomer();
    } catch (error: any) {
      toast.error('Failed to assign project: ' + error.message);
    }
  };

  const handleUnassignProject = async (projectId: string) => {
    try {
      const { error } = await supabase
        .from('projects')
        .update({ customer_id: null })
        .eq('id', projectId);
      if (error) throw error;
      toast.success('Project unassigned');
      await loadProjectsForCustomer();
    } catch (error: any) {
      toast.error('Failed to unassign project: ' + error.message);
    }
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const validated = customerSchema.parse({
        company_name: formData.company_name,
        contact_name: formData.contact_name || undefined,
        contact_email: formData.contact_email,
        phone: formData.phone || undefined,
      });

      setSaving(true);

      const { error } = await supabase
        .from('customers')
        .update({
          company_name: validated.company_name,
          contact_name: validated.contact_name || null,
          contact_email: validated.contact_email,
          phone: validated.phone || null,
        })
        .eq('id', id);

      if (error) throw error;

      toast.success('Customer updated successfully');
      navigate('/admin/customers');
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error(safeErrorMessage(error));
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <AdminLayout title="Edit Customer" description="Update customer information">
      <Card className="max-w-2xl p-6 bg-[var(--gradient-card)] shadow-[var(--shadow-elegant)] border border-primary/10">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="company_name">Company Name *</Label>
            <Input
              id="company_name"
              value={formData.company_name}
              onChange={(e) =>
                setFormData({ ...formData, company_name: e.target.value })
              }
              maxLength={200}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact_name">Contact Name</Label>
            <Input
              id="contact_name"
              value={formData.contact_name}
              onChange={(e) =>
                setFormData({ ...formData, contact_name: e.target.value })
              }
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact_email">Contact Email *</Label>
            <Input
              id="contact_email"
              type="email"
              value={formData.contact_email}
              onChange={(e) =>
                setFormData({ ...formData, contact_email: e.target.value })
              }
              maxLength={200}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              maxLength={50}
            />
          </div>

          <div className="flex gap-3">
            <Button type="submit" disabled={saving} className="bg-gradient-to-r from-primary to-accent hover:shadow-lg">
              {saving ? 'Updating...' : 'Update Customer'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/admin/customers')}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Card>

      {/* Projects for this customer */}
      <Card className="mt-8 max-w-2xl p-6 bg-[var(--gradient-card)] shadow-[var(--shadow-elegant)] border border-primary/10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Projects for this customer</h2>
            <p className="text-sm text-muted-foreground">Assign or remove projects linked to this customer</p>
          </div>
          <Button variant="outline" onClick={() => navigate(`/admin/projects/new?customer_id=${id}`)}>
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="w-80">
                <SelectValue placeholder={loadingProjects ? 'Loading projects...' : 'Assign existing project...'} />
              </SelectTrigger>
              <SelectContent>
                {availableProjects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAssignProject} disabled={!selectedProjectId}>
              Assign
            </Button>
          </div>

          <div className="border-t pt-4">
            {loadingProjects ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : projects.length > 0 ? (
              <div className="space-y-2">
                {projects.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="font-medium">{p.name}</div>
                    <Button variant="ghost" className="text-destructive" onClick={() => handleUnassignProject(p.id)}>
                      <Trash2 className="h-4 w-4 mr-1" /> Unassign
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground py-4">No projects assigned to this customer yet.</div>
            )}
          </div>
        </div>
      </Card>
    </AdminLayout>
  );
};

export default EditCustomer;
