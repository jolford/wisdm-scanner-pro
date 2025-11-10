/**
 * Admin Dashboard Component
 * 
 * Main administrative dashboard that provides an overview of the entire WISDM Capture Pro system.
 * Displays key metrics, statistics, and quick action buttons for system administrators.
 * 
 * Features:
 * - Real-time system statistics (projects, documents, users, licenses, customers)
 * - Quick navigation cards for common admin tasks
 * - Pricing PDF generator for sales/marketing materials
 * - Admin-only access with authentication guard
 * 
 * @requires useRequireAuth - Ensures only admins can access
 * @requires AdminLayout - Provides consistent admin page structure
 */

import { useNavigate } from 'react-router-dom';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus, FolderOpen, FileText, Users, Key, Building2, GripVertical, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { PricingPDFGenerator } from '@/components/admin/PricingPDFGenerator';
import { SkeletonStats } from '@/components/ui/skeleton-card';
import { useDashboardWidgets } from '@/hooks/use-dashboard-widgets';
import { WidgetRenderer } from '@/components/dashboard/WidgetRenderer';
import { DashboardCustomizer } from '@/components/dashboard/DashboardCustomizer';
import { WIDGET_REGISTRY } from '@/components/dashboard/WidgetRegistry';

const AdminDashboard = () => {
  // Authentication guard - ensures only admins can access this page
  const { loading, isAdmin } = useRequireAuth(true);
  const navigate = useNavigate();
  
  // Dashboard widgets state
  const { widgets, isLoading: widgetsLoading, addWidget, removeWidget, reorderWidgets } = useDashboardWidgets();
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);
  
  // System-wide statistics state
  const [stats, setStats] = useState({
    projects: 0,      // Total number of projects in the system
    documents: 0,     // Total documents processed
    users: 0,         // Total registered users
    licenses: 0,      // Total active licenses
    customers: 0,     // Total customer organizations
  });
  const [statsLoading, setStatsLoading] = useState(true);

  // Load statistics when component mounts and user is authenticated as admin
  useEffect(() => {
    if (!loading && isAdmin) {
      loadStats();
    }
  }, [loading, isAdmin]);

  /**
   * Fetch system-wide statistics from database
   * Uses parallel queries for optimal performance
   * Only fetches counts (head: true) to minimize data transfer
   */
  const loadStats = async () => {
    setStatsLoading(true);
    try {
      // Execute all stat queries in parallel for better performance
      const [projectsRes, documentsRes, profilesRes, licensesRes, customersRes] = await Promise.all([
        supabase.from('projects').select('id', { count: 'exact', head: true }),
        supabase.from('documents').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('licenses').select('id', { count: 'exact', head: true }),
        supabase.from('customers').select('id', { count: 'exact', head: true }),
      ]);

      // Update state with fetched counts, defaulting to 0 if no data
      setStats({
        projects: projectsRes.count || 0,
        documents: documentsRes.count || 0,
        users: profilesRes.count || 0,
        licenses: licensesRes.count || 0,
        customers: customersRes.count || 0,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
      // Silently fail - stats will remain at 0
    } finally {
      setStatsLoading(false);
    }
  };

  // Drag and drop handlers for widget reordering
  const handleDragStart = (widgetId: string) => {
    setDraggedWidget(widgetId);
  };

  const handleDragOver = (e: React.DragEvent, targetWidgetId: string) => {
    e.preventDefault();
    if (!draggedWidget || draggedWidget === targetWidgetId) return;

    const draggedIndex = widgets.findIndex(w => w.id === draggedWidget);
    const targetIndex = widgets.findIndex(w => w.id === targetWidgetId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const reordered = [...widgets];
    const [removed] = reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, removed);

    reorderWidgets(reordered);
  };

  const handleDragEnd = () => {
    setDraggedWidget(null);
  };

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <AdminLayout title="Admin Dashboard" description="System overview and quick actions">
      <div className="space-y-8">
        {/* Stats Cards */}
        {statsLoading ? (
          <SkeletonStats />
        ) : (
          <div className="grid md:grid-cols-5 gap-6">
            <Card className="p-6 bg-gradient-to-br from-card to-card/80 shadow-[var(--shadow-elegant)]">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FolderOpen className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Projects</p>
                  <p className="text-2xl font-bold">{stats.projects}</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-gradient-to-br from-card to-card/80 shadow-[var(--shadow-elegant)]">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 bg-accent/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Documents</p>
                  <p className="text-2xl font-bold">{stats.documents}</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-gradient-to-br from-card to-card/80 shadow-[var(--shadow-elegant)]">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 bg-secondary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Users</p>
                  <p className="text-2xl font-bold">{stats.users}</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-gradient-to-br from-card to-card/80 shadow-[var(--shadow-elegant)]">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 bg-muted/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Key className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Licenses</p>
                  <p className="text-2xl font-bold">{stats.licenses}</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-gradient-to-br from-card to-card/80 shadow-[var(--shadow-elegant)]">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 bg-accent/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Customers</p>
                  <p className="text-2xl font-bold">{stats.customers}</p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Customizable Widget Section */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Dashboard Widgets</h2>
            <Button onClick={() => setCustomizerOpen(true)} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add Widget
            </Button>
          </div>

          {widgetsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="h-64 animate-pulse bg-muted" />
              ))}
            </div>
          ) : widgets.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {widgets.map((widget) => (
                <div
                  key={widget.id}
                  draggable
                  onDragStart={() => handleDragStart(widget.id)}
                  onDragOver={(e) => handleDragOver(e, widget.id)}
                  onDragEnd={handleDragEnd}
                  className="relative group cursor-move"
                >
                  <div className="absolute -top-2 -right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <Button
                      size="icon"
                      variant="destructive"
                      className="h-6 w-6 rounded-full"
                      onClick={() => removeWidget(widget.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                    <GripVertical className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <WidgetRenderer type={widget.widget_type} config={widget.config} />
                </div>
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground mb-4">No widgets added yet. Click "Add Widget" to get started.</p>
              <Button onClick={() => setCustomizerOpen(true)} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Widget
              </Button>
            </Card>
          )}
        </div>

        {/* Sales Tools */}
        <div className="grid md:grid-cols-1 gap-6">
          <PricingPDFGenerator />
        </div>
      </div>

      <DashboardCustomizer
        open={customizerOpen}
        onClose={() => setCustomizerOpen(false)}
        currentWidgets={widgets.map(w => w.widget_type)}
        onAddWidget={addWidget}
      />
    </AdminLayout>
  );
};

export default AdminDashboard;

