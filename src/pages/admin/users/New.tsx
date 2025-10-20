import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export default function NewUser() {
  const { loading, isAdmin } = useRequireAuth(true);
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [customers, setCustomers] = useState<Array<{ id: string; company_name: string }>>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    full_name: "",
    role: "user" as "system_admin" | "admin" | "user",
    customer_id: "",
    can_scan: true,
    can_validate: true,
    can_export: true,
  });

  // Load customers
  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const { data, error } = await supabase
          .from("customers")
          .select("id, company_name")
          .order("company_name");

        if (error) throw error;
        setCustomers(data || []);
      } catch (error: any) {
        toast.error("Failed to load customers");
      } finally {
        setLoadingCustomers(false);
      }
    };

    loadCustomers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.password || !formData.full_name) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (formData.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (formData.role !== "system_admin" && !formData.customer_id) {
      toast.error("Please select a customer for non-admin users");
      return;
    }

    setSubmitting(true);

    try {
      // Create user via auth
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.full_name,
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (signUpError) throw signUpError;
      if (!authData.user) throw new Error("User creation failed");

      const userId = authData.user.id;

      // Update profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ full_name: formData.full_name })
        .eq("id", userId);

      if (profileError) throw profileError;

      // Assign role
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: formData.role });

      if (roleError) throw roleError;

      // Assign customer (if not system admin)
      if (formData.role !== "system_admin" && formData.customer_id) {
        const { error: customerError } = await supabase
          .from("user_customers")
          .insert({ user_id: userId, customer_id: formData.customer_id });

        if (customerError) throw customerError;
      }

      // Set permissions
      const { error: permError } = await supabase
        .from("user_permissions")
        .insert({
          user_id: userId,
          can_scan: formData.can_scan,
          can_validate: formData.can_validate,
          can_export: formData.can_export,
        });

      if (permError) throw permError;

      toast.success("User created successfully");
      navigate("/admin/users");
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast.error(error.message || "Failed to create user");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || loadingCustomers) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    navigate("/");
    return null;
  }

  return (
    <AdminLayout title="Create New User" description="Add a new user to the system">
      <Card className="max-w-2xl mx-auto p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">
              Email <span className="text-destructive">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="user@example.com"
              required
            />
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password">
              Password <span className="text-destructive">*</span>
            </Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Minimum 6 characters"
              minLength={6}
              required
            />
            <p className="text-xs text-muted-foreground">Minimum 6 characters</p>
          </div>

          {/* Full Name */}
          <div className="space-y-2">
            <Label htmlFor="full_name">
              Full Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="full_name"
              type="text"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              placeholder="John Doe"
              required
            />
          </div>

          {/* Role */}
          <div className="space-y-2">
            <Label htmlFor="role">
              Role <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.role}
              onValueChange={(value: any) => setFormData({ ...formData, role: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Tenant Admin</SelectItem>
                <SelectItem value="system_admin">System Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Customer Assignment (hidden for system admins) */}
          {formData.role !== "system_admin" && (
            <div className="space-y-2">
              <Label htmlFor="customer">
                Customer <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.customer_id}
                onValueChange={(value) => setFormData({ ...formData, customer_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
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
          )}

          {/* Permissions */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-semibold">Permissions</h3>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="can_scan" className="cursor-pointer">
                Can Scan Documents
              </Label>
              <Switch
                id="can_scan"
                checked={formData.can_scan}
                onCheckedChange={(checked) => setFormData({ ...formData, can_scan: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="can_validate" className="cursor-pointer">
                Can Validate Documents
              </Label>
              <Switch
                id="can_validate"
                checked={formData.can_validate}
                onCheckedChange={(checked) => setFormData({ ...formData, can_validate: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="can_export" className="cursor-pointer">
                Can Export Documents
              </Label>
              <Switch
                id="can_export"
                checked={formData.can_export}
                onCheckedChange={(checked) => setFormData({ ...formData, can_export: checked })}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/admin/users")}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create User
            </Button>
          </div>
        </form>
      </Card>
    </AdminLayout>
  );
}
