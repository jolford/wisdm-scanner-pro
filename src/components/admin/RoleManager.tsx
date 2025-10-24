import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Shield, ShieldCheck, User, RefreshCw } from 'lucide-react';

interface UserWithRoles {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  last_sign_in_at: string | null;
  jwt_role: string | null;
  database_roles: string[];
  is_admin: boolean;
  is_system_admin: boolean;
}

export function RoleManager() {
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('admin-list-users');
      
      if (error) throw error;
      
      setUsers(data.users || []);
      toast.success(`Loaded ${data.total} users`);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast.error(error.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId: string, role: string) => {
    try {
      setUpdating(userId);
      
      const { data, error } = await supabase.functions.invoke('admin-set-role-metadata', {
        body: { targetUserId: userId, role }
      });
      
      if (error) throw error;
      
      toast.success(`Role updated to "${role}" for user`);
      
      // Refresh user list
      await fetchUsers();
    } catch (error: any) {
      console.error('Error updating role:', error);
      toast.error(error.message || 'Failed to update role');
    } finally {
      setUpdating(null);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const getRoleBadge = (user: UserWithRoles) => {
    if (user.is_system_admin) {
      return <Badge variant="destructive" className="gap-1"><ShieldCheck className="h-3 w-3" /> System Admin</Badge>;
    }
    if (user.is_admin) {
      return <Badge variant="warning" className="gap-1"><Shield className="h-3 w-3" /> Admin</Badge>;
    }
    return <Badge variant="secondary" className="gap-1"><User className="h-3 w-3" /> User</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>User Role Management</CardTitle>
            <CardDescription>
              Manage user roles in JWT app_metadata for server-side authorization
            </CardDescription>
          </div>
          <Button onClick={fetchUsers} disabled={loading} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading users...</div>
        ) : users.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No users found</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Current Role</TableHead>
                <TableHead>JWT Role</TableHead>
                <TableHead>DB Roles</TableHead>
                <TableHead>Last Sign In</TableHead>
                <TableHead>Change Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell>{user.full_name || '-'}</TableCell>
                  <TableCell>{getRoleBadge(user)}</TableCell>
                  <TableCell>
                    {user.jwt_role ? (
                      <Badge variant="outline">{user.jwt_role}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">None</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {user.database_roles.length > 0 ? (
                      <div className="flex gap-1 flex-wrap">
                        {user.database_roles.map(role => (
                          <Badge key={role} variant="outline" className="text-xs">{role}</Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">None</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.last_sign_in_at 
                      ? new Date(user.last_sign_in_at).toLocaleDateString()
                      : 'Never'}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={user.jwt_role || 'user'}
                      onValueChange={(role) => updateUserRole(user.id, role)}
                      disabled={updating === user.id}
                    >
                      <SelectTrigger className="w-[160px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="system_admin">System Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
