import { useNavigate } from 'react-router-dom';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, UserPlus, Settings, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import wisdmLogo from '@/assets/wisdm-logo.png';
import { Input } from '@/components/ui/input';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface User {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  customers: Array<{ id: string; company_name: string }>;
  permissions?: {
    can_scan: boolean;
    can_validate: boolean;
    can_export: boolean;
  };
  roles: string[];
}

interface Customer {
  id: string;
  company_name: string;
}

const UsersIndex = () => {
  const { loading, isAdmin } = useRequireAuth(true);
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPermissionsDialogOpen, setIsPermissionsDialogOpen] = useState(false);
  const [editingPermissions, setEditingPermissions] = useState<User['permissions']>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<{ id: string; full_name: string; email: string } | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && isAdmin) {
      loadUsers();
      loadCustomers();
    }
  }, [loading, isAdmin]);

  const loadUsers = async () => {
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          full_name,
          created_at
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Load customer assignments, permissions, and roles for each user
      const usersWithCustomers = await Promise.all(
        (profiles || []).map(async (profile) => {
          const { data: userCustomers } = await supabase
            .from('user_customers')
            .select(`
              customer_id,
              customers!inner(id, company_name)
            `)
            .eq('user_id', profile.id);

          const { data: permissions } = await supabase
            .from('user_permissions')
            .select('*')
            .eq('user_id', profile.id)
            .maybeSingle();

          const { data: userRoles } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', profile.id);

          return {
            ...profile,
            customers: (userCustomers || []).map((uc: any) => ({
              id: uc.customers.id,
              company_name: uc.customers.company_name,
            })),
            permissions: permissions || {
              can_scan: true,
              can_validate: true,
              can_export: true,
            },
            roles: (userRoles || []).map((r: any) => r.role),
          };
        })
      );

      setUsers(usersWithCustomers);
    } catch (error: any) {
      toast.error('Failed to load users: ' + error.message);
    }
  };

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, company_name')
        .order('company_name');

      if (error) throw error;
      setCustomers(data || []);
    } catch (error: any) {
      toast.error('Failed to load customers: ' + error.message);
    }
  };

  const handleAssignCustomer = async () => {
    if (!selectedUser || !selectedCustomer) {
      toast.error('Please select a customer');
      return;
    }

    try {
      const { error } = await supabase
        .from('user_customers')
        .insert({
          user_id: selectedUser,
          customer_id: selectedCustomer,
        });

      if (error) {
        if (error.code === '23505') {
          toast.error('User is already assigned to this customer');
        } else {
          throw error;
        }
        return;
      }

      toast.success('Customer assigned successfully');
      setIsDialogOpen(false);
      setSelectedUser(null);
      setSelectedCustomer('');
      loadUsers();
    } catch (error: any) {
      toast.error('Failed to assign customer: ' + error.message);
    }
  };

  const handleRemoveCustomer = async (userId: string, customerId: string) => {
    try {
      const { error } = await supabase
        .from('user_customers')
        .delete()
        .eq('user_id', userId)
        .eq('customer_id', customerId);

      if (error) throw error;

      toast.success('Customer access removed');
      loadUsers();
    } catch (error: any) {
      toast.error('Failed to remove customer: ' + error.message);
    }
  };

  const handleOpenPermissions = (user: User) => {
    setSelectedUser(user.id);
    setEditingPermissions(user.permissions || {
      can_scan: true,
      can_validate: true,
      can_export: true,
    });
    setIsPermissionsDialogOpen(true);
  };

  const handleSavePermissions = async () => {
    if (!selectedUser || !editingPermissions) return;

    try {
      const { error } = await supabase
        .from('user_permissions')
        .upsert({
          user_id: selectedUser,
          ...editingPermissions,
        });

      if (error) throw error;

      toast.success('Permissions updated successfully');
      setIsPermissionsDialogOpen(false);
      setSelectedUser(null);
      setEditingPermissions(null);
      loadUsers();
    } catch (error: any) {
      toast.error('Failed to update permissions: ' + error.message);
    }
  };

  const handleToggleAdminRole = async (userId: string, currentRole: 'user' | 'admin' | 'system_admin' | null) => {
    try {
      if (currentRole === 'admin' || currentRole === 'system_admin') {
        // Remove the role
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('role', currentRole);

        if (error) throw error;
        toast.success('Role removed');
      } else {
        // Add admin role (tenant-level)
        const { error } = await supabase
          .from('user_roles')
          .insert({
            user_id: userId,
            role: 'admin',
          });

        if (error) throw error;
        toast.success('Admin role granted');
      }

      loadUsers();
    } catch (error: any) {
      toast.error('Failed to update role: ' + error.message);
    }
  };

  const handleToggleSystemAdminRole = async (userId: string, isCurrentlySystemAdmin: boolean) => {
    try {
      if (isCurrentlySystemAdmin) {
        // Remove system_admin role
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('role', 'system_admin');

        if (error) throw error;
        toast.success('System Admin role removed');
      } else {
        // Add system_admin role
        const { error } = await supabase
          .from('user_roles')
          .insert({
            user_id: userId,
            role: 'system_admin',
          });

        if (error) throw error;
        toast.success('System Admin role granted');
      }

      loadUsers();
    } catch (error: any) {
      toast.error('Failed to update system admin role: ' + error.message);
    }
  };

  const handleOpenEdit = (user: User) => {
    setEditingUser({
      id: user.id,
      full_name: user.full_name || '',
      email: user.email || '',
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editingUser.full_name,
          email: editingUser.email,
        })
        .eq('id', editingUser.id);

      if (error) throw error;

      toast.success('User updated successfully');
      setIsEditDialogOpen(false);
      setEditingUser(null);
      loadUsers();
    } catch (error: any) {
      toast.error('Failed to update user: ' + error.message);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserId) return;

    try {
      // Invoke backend function with current session automatically
      const { data, error: funcError } = await supabase.functions.invoke('delete-user', {
        body: { userId: deleteUserId },
      });

      if (funcError) {
        throw new Error(funcError.message || 'Failed to delete user');
      }

      toast.success('User deleted successfully');
      setDeleteUserId(null);
      loadUsers();
    } catch (error: any) {
      toast.error('Failed to delete user: ' + (error?.message || 'Unknown error'));
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-10 bg-background/80">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={wisdmLogo} alt="WISDM Logo" className="h-10 w-auto" />
              <div className="border-l border-border/50 pl-3">
                <h1 className="text-xl font-bold">User Management</h1>
              </div>
            </div>
            <Button onClick={() => navigate('/admin')} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Card className="p-6 bg-gradient-to-br from-card to-card/80 shadow-[var(--shadow-elegant)]">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold mb-1">All Users</h2>
              <p className="text-sm text-muted-foreground">
                Manage user access to customer licenses
              </p>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead>Assigned Customers</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.full_name || 'N/A'}
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={user.roles?.includes('system_admin') || false}
                          onCheckedChange={() => handleToggleSystemAdminRole(user.id, user.roles?.includes('system_admin') || false)}
                        />
                        <span className="text-sm font-medium">
                          {user.roles?.includes('system_admin') ? 'System Admin' : 'System User'}
                        </span>
                      </div>
                      {!user.roles?.includes('system_admin') && (
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={user.roles?.includes('admin') || false}
                            onCheckedChange={() => handleToggleAdminRole(
                              user.id, 
                              user.roles?.includes('admin') ? 'admin' : null
                            )}
                          />
                          <span className="text-sm">
                            {user.roles?.includes('admin') ? 'Tenant Admin' : 'Regular User'}
                          </span>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 text-xs">
                      {user.permissions?.can_scan && (
                        <span className="px-2 py-1 bg-blue-500/10 text-blue-600 rounded">Scan</span>
                      )}
                      {user.permissions?.can_validate && (
                        <span className="px-2 py-1 bg-green-500/10 text-green-600 rounded">Validate</span>
                      )}
                      {user.permissions?.can_export && (
                        <span className="px-2 py-1 bg-purple-500/10 text-purple-600 rounded">Export</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {user.customers.length > 0 ? (
                        user.customers.map((customer) => (
                          <span
                            key={customer.id}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded text-xs"
                          >
                            {customer.company_name}
                            <button
                              onClick={() => handleRemoveCustomer(user.id, customer.id)}
                              className="hover:text-destructive"
                            >
                              ×
                            </button>
                          </span>
                        ))
                      ) : (
                        <span className="text-muted-foreground text-sm">None</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {new Date(user.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenEdit(user)}
                        title="Edit User"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenPermissions(user)}
                        title="Manage Permissions"
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteUserId(user.id)}
                        title="Delete User"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    <Dialog
                      open={isDialogOpen && selectedUser === user.id}
                      onOpenChange={(open) => {
                        setIsDialogOpen(open);
                        if (open) {
                          setSelectedUser(user.id);
                        } else {
                          setSelectedUser(null);
                          setSelectedCustomer('');
                        }
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline">
                          <UserPlus className="h-4 w-4 mr-2" />
                          Assign Customer
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Assign Customer</DialogTitle>
                          <DialogDescription>
                            Give {user.email} access to a customer's licenses
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Select Customer</label>
                            <Select
                              value={selectedCustomer}
                              onValueChange={setSelectedCustomer}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Choose a customer..." />
                              </SelectTrigger>
                              <SelectContent>
                                {customers.map((customer) => (
                                  <SelectItem key={customer.id} value={customer.id}>
                                    {customer.company_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button
                            onClick={handleAssignCustomer}
                            className="w-full bg-gradient-to-r from-primary to-accent"
                          >
                            Assign Customer
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {users.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No users found
            </div>
          )}
        </Card>

        {/* Edit User Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>
                Update user profile information
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name</Label>
                <Input
                  id="full_name"
                  value={editingUser?.full_name || ''}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser!, full_name: e.target.value })
                  }
                  placeholder="Enter full name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={editingUser?.email || ''}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser!, email: e.target.value })
                  }
                  placeholder="Enter email"
                />
              </div>
              <Button
                onClick={handleSaveEdit}
                className="w-full bg-gradient-to-r from-primary to-accent"
              >
                Save Changes
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Permissions Dialog */}
        <Dialog open={isPermissionsDialogOpen} onOpenChange={setIsPermissionsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Manage Permissions</DialogTitle>
              <DialogDescription>
                Configure what this user can do in the system
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="can_scan" className="flex flex-col gap-1">
                  <span className="font-medium">Can Scan</span>
                  <span className="text-xs text-muted-foreground">
                    Upload and process documents
                  </span>
                </Label>
                <Switch
                  id="can_scan"
                  checked={editingPermissions?.can_scan || false}
                  onCheckedChange={(checked) =>
                    setEditingPermissions({ ...editingPermissions!, can_scan: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="can_validate" className="flex flex-col gap-1">
                  <span className="font-medium">Can Validate</span>
                  <span className="text-xs text-muted-foreground">
                    Review and approve scanned documents
                  </span>
                </Label>
                <Switch
                  id="can_validate"
                  checked={editingPermissions?.can_validate || false}
                  onCheckedChange={(checked) =>
                    setEditingPermissions({ ...editingPermissions!, can_validate: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="can_export" className="flex flex-col gap-1">
                  <span className="font-medium">Can Export</span>
                  <span className="text-xs text-muted-foreground">
                    Export validated documents
                  </span>
                </Label>
                <Switch
                  id="can_export"
                  checked={editingPermissions?.can_export || false}
                  onCheckedChange={(checked) =>
                    setEditingPermissions({ ...editingPermissions!, can_export: checked })
                  }
                />
              </div>
              <Button
                onClick={handleSavePermissions}
                className="w-full bg-gradient-to-r from-primary to-accent"
              >
                Save Permissions
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this user and all associated data. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteUser}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete User
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
};

export default UsersIndex;
