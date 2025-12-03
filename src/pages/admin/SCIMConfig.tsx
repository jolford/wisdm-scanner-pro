import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Users, Plus, RefreshCw, Copy, Eye, EyeOff, Clock, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDistanceToNow } from "date-fns";

interface SCIMConfig {
  id: string;
  customer_id: string;
  scim_token_prefix: string;
  is_active: boolean;
  auto_provision_users: boolean;
  auto_deactivate_users: boolean;
  default_role: string;
  group_mappings: Record<string, string>;
  last_sync_at: string | null;
  created_at: string;
}

interface SCIMLog {
  id: string;
  operation: string;
  resource_type: string;
  resource_id: string | null;
  status: string;
  details: Record<string, any> | null;
  created_at: string;
}

export default function SCIMConfig() {
  const queryClient = useQueryClient();
  const [isSetupDialogOpen, setIsSetupDialogOpen] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);

  const { data: config, isLoading } = useQuery({
    queryKey: ["scim-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scim_configs")
        .select("*")
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data as SCIMConfig | null;
    }
  });

  const { data: logs } = useQuery({
    queryKey: ["scim-logs"],
    queryFn: async () => {
      if (!config?.id) return [];
      const { data, error } = await supabase
        .from("scim_sync_logs")
        .select("*")
        .eq("scim_config_id", config.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as SCIMLog[];
    },
    enabled: !!config?.id
  });

  const generateToken = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = 'scim_';
    for (let i = 0; i < 40; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const token = generateToken();
      const tokenHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
        .then(hash => Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join(''));
      
      const { data: userData } = await supabase.auth.getUser();
      const { data: userCustomers } = await supabase
        .from("user_customers")
        .select("customer_id")
        .eq("user_id", userData.user?.id)
        .single();

      const { error } = await supabase.from("scim_configs").insert({
        customer_id: userCustomers?.customer_id,
        scim_token_hash: tokenHash,
        scim_token_prefix: token.substring(0, 10),
        created_by: userData.user?.id
      });
      if (error) throw error;
      return token;
    },
    onSuccess: (token) => {
      setGeneratedToken(token);
      queryClient.invalidateQueries({ queryKey: ["scim-config"] });
      toast.success("SCIM provisioning enabled");
    },
    onError: (error) => toast.error(`Failed to enable SCIM: ${error.message}`)
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const { error } = await supabase.from("scim_configs").update(data).eq("id", config?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scim-config"] });
      toast.success("SCIM configuration updated");
    },
    onError: (error) => toast.error(`Failed to update SCIM config: ${error.message}`)
  });

  const rotateTokenMutation = useMutation({
    mutationFn: async () => {
      const token = generateToken();
      const tokenHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
        .then(hash => Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join(''));
      
      const { error } = await supabase.from("scim_configs").update({
        scim_token_hash: tokenHash,
        scim_token_prefix: token.substring(0, 10)
      }).eq("id", config?.id);
      if (error) throw error;
      return token;
    },
    onSuccess: (token) => {
      setGeneratedToken(token);
      queryClient.invalidateQueries({ queryKey: ["scim-config"] });
      toast.success("SCIM token rotated");
    },
    onError: (error) => toast.error(`Failed to rotate token: ${error.message}`)
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const scimBaseUrl = `https://pbyerakkryuflamlmpvm.supabase.co/functions/v1/scim-provisioning`;

  return (
    <AdminLayout title="SCIM Provisioning">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8 text-primary" />
            SCIM User Provisioning
          </h1>
          <p className="text-muted-foreground mt-1">
            Automatically sync users from your identity provider using SCIM 2.0
          </p>
        </div>

        {!config ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">SCIM Not Configured</h3>
              <p className="text-muted-foreground mb-4">
                Enable SCIM to automatically provision and de-provision users from your identity provider
              </p>
              <Dialog open={isSetupDialogOpen} onOpenChange={setIsSetupDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Enable SCIM Provisioning
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Enable SCIM Provisioning</DialogTitle>
                    <DialogDescription>
                      This will generate a SCIM token for your identity provider. Store it securely - it won't be shown again.
                    </DialogDescription>
                  </DialogHeader>
                  {generatedToken ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-muted rounded-lg">
                        <Label className="text-xs text-muted-foreground">SCIM Token</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="flex-1 text-sm font-mono break-all">
                            {showToken ? generatedToken : "••••••••••••••••••••••••••••••••"}
                          </code>
                          <Button variant="ghost" size="icon" onClick={() => setShowToken(!showToken)}>
                            {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => copyToClipboard(generatedToken)}>
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="p-4 bg-destructive/10 text-destructive rounded-lg text-sm">
                        <AlertTriangle className="h-4 w-4 inline mr-2" />
                        Save this token now. It will not be shown again.
                      </div>
                      <Button className="w-full" onClick={() => setIsSetupDialogOpen(false)}>
                        I've Saved the Token
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        SCIM provisioning enables automatic user lifecycle management:
                      </p>
                      <ul className="text-sm space-y-2">
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          Auto-create users when added to your IdP
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          Auto-update user profiles on changes
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          Auto-deactivate users when removed
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          Sync group memberships to roles
                        </li>
                      </ul>
                      <Button 
                        className="w-full" 
                        onClick={() => createMutation.mutate()}
                        disabled={createMutation.isPending}
                      >
                        {createMutation.isPending ? "Generating..." : "Generate SCIM Token"}
                      </Button>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>SCIM Endpoint</CardTitle>
                  <CardDescription>Configure these in your identity provider</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Base URL</Label>
                    <div className="flex items-center gap-2">
                      <Input readOnly value={scimBaseUrl} className="font-mono text-sm" />
                      <Button variant="ghost" size="icon" onClick={() => copyToClipboard(scimBaseUrl)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Token Prefix</Label>
                    <div className="flex items-center gap-2">
                      <Input readOnly value={`${config.scim_token_prefix}...`} className="font-mono text-sm" />
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => rotateTokenMutation.mutate()}
                        disabled={rotateTokenMutation.isPending}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Rotate
                      </Button>
                    </div>
                  </div>
                  {generatedToken && (
                    <div className="p-4 bg-muted rounded-lg">
                      <Label className="text-xs text-muted-foreground">New Token (save now)</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="flex-1 text-sm font-mono break-all">
                          {showToken ? generatedToken : "••••••••••••••••••••••••••••••••"}
                        </code>
                        <Button variant="ghost" size="icon" onClick={() => setShowToken(!showToken)}>
                          {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => copyToClipboard(generatedToken)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Provisioning Settings</CardTitle>
                  <CardDescription>Control how users are synced</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>SCIM Active</Label>
                      <p className="text-xs text-muted-foreground">Accept SCIM requests</p>
                    </div>
                    <Switch
                      checked={config.is_active}
                      onCheckedChange={(checked) => updateMutation.mutate({ is_active: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Auto-Provision Users</Label>
                      <p className="text-xs text-muted-foreground">Create users automatically</p>
                    </div>
                    <Switch
                      checked={config.auto_provision_users}
                      onCheckedChange={(checked) => updateMutation.mutate({ auto_provision_users: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Auto-Deactivate Users</Label>
                      <p className="text-xs text-muted-foreground">Deactivate on removal</p>
                    </div>
                    <Switch
                      checked={config.auto_deactivate_users}
                      onCheckedChange={(checked) => updateMutation.mutate({ auto_deactivate_users: checked })}
                    />
                  </div>
                  <div className="pt-2 border-t">
                    <Label>Default Role</Label>
                    <Select 
                      value={config.default_role} 
                      onValueChange={(value) => updateMutation.mutate({ default_role: value as "user" | "admin" })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Sync Activity</CardTitle>
                    <CardDescription>
                      {config.last_sync_at 
                        ? `Last sync: ${formatDistanceToNow(new Date(config.last_sync_at))} ago`
                        : "No syncs yet"}
                    </CardDescription>
                  </div>
                  <Badge variant={config.is_active ? "default" : "secondary"}>
                    {config.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {logs && logs.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Operation</TableHead>
                        <TableHead>Resource</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-muted-foreground">
                            <Clock className="h-3 w-3 inline mr-1" />
                            {formatDistanceToNow(new Date(log.created_at))} ago
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{log.operation}</Badge>
                          </TableCell>
                          <TableCell>{log.resource_type}</TableCell>
                          <TableCell>
                            <Badge variant={log.status === "success" ? "default" : "destructive"}>
                              {log.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {log.details ? JSON.stringify(log.details) : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No sync activity yet. Configure SCIM in your identity provider to start syncing users.
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
