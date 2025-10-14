import { useNavigate } from 'react-router-dom';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { safeErrorMessage } from '@/lib/error-handler';
import { z } from 'zod';

const customerSchema = z.object({
  company_name: z.string().min(1, 'Company name is required').max(200),
  contact_name: z.string().max(200).optional(),
  contact_email: z.string().email('Invalid email address').max(200),
  phone: z.string().max(50).optional(),
});

const NewCustomer = () => {
  const { loading, isAdmin } = useRequireAuth(true);
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    company_name: '',
    contact_name: '',
    contact_email: '',
    phone: '',
  });
  const [saving, setSaving] = useState(false);

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

      const { error } = await supabase.from('customers').insert({
        company_name: validated.company_name,
        contact_name: validated.contact_name || null,
        contact_email: validated.contact_email,
        phone: validated.phone || null,
      });

      if (error) throw error;

      toast.success('Customer created successfully');
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <AdminLayout title="New Customer" description="Add a new customer account">
      <Card className="max-w-2xl p-6 bg-gradient-to-br from-card to-card/80 shadow-[var(--shadow-elegant)]">
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
            <Button
              type="submit"
              disabled={saving}
              className="bg-gradient-to-r from-primary to-accent"
            >
              {saving ? 'Creating...' : 'Create Customer'}
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
    </AdminLayout>
  );
};

export default NewCustomer;
