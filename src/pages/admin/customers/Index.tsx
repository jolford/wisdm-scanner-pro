import { useNavigate } from 'react-router-dom';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AdminLayout } from '@/components/admin/AdminLayout';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Customer {
  id: string;
  company_name: string;
  contact_name: string | null;
  contact_email: string;
  phone: string | null;
  created_at: string;
}

const CustomersIndex = () => {
  const { loading, isAdmin } = useRequireAuth(true);
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && isAdmin) {
      loadCustomers();
    }
  }, [loading, isAdmin]);

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('company_name');

      if (error) throw error;
      setCustomers(data || []);
    } catch (error: any) {
      toast.error('Failed to load customers: ' + error.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const { error } = await supabase.from('customers').delete().eq('id', deleteId);

      if (error) throw error;

      toast.success('Customer deleted successfully');
      setDeleteId(null);
      loadCustomers();
    } catch (error: any) {
      toast.error('Failed to delete customer: ' + error.message);
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
    <AdminLayout title="Customers" description="Manage customer accounts and information">
      <Card className="p-6 bg-gradient-to-br from-card to-card/80 shadow-[var(--shadow-elegant)]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold mb-1">All Customers</h2>
            <p className="text-sm text-muted-foreground">
              Manage customer accounts and their licenses
            </p>
          </div>
          <Button
            onClick={() => navigate('/admin/customers/new')}
            className="bg-gradient-to-r from-primary to-accent"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Customer
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company Name</TableHead>
              <TableHead>Contact Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((customer) => (
              <TableRow key={customer.id}>
                <TableCell className="font-medium">{customer.company_name}</TableCell>
                <TableCell>{customer.contact_name || 'N/A'}</TableCell>
                <TableCell>{customer.contact_email}</TableCell>
                <TableCell>{customer.phone || 'N/A'}</TableCell>
                <TableCell>
                  {new Date(customer.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/admin/customers/${customer.id}/edit`)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(customer.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {customers.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No customers found. Create your first customer to get started.
          </div>
        )}
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this customer and all associated data. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default CustomersIndex;
