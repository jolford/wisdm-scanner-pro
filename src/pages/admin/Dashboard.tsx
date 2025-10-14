import { useNavigate } from 'react-router-dom';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus, FolderOpen, FileText, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import wisdmLogo from '@/assets/wisdm-logo.png';

const AdminDashboard = () => {
  const { loading, isAdmin } = useRequireAuth(true);
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    projects: 0,
    documents: 0,
    users: 0,
  });

  useEffect(() => {
    if (!loading && isAdmin) {
      loadStats();
    }
  }, [loading, isAdmin]);

  const loadStats = async () => {
    try {
      const [projectsRes, documentsRes, profilesRes] = await Promise.all([
        supabase.from('projects').select('id', { count: 'exact', head: true }),
        supabase.from('documents').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
      ]);

      setStats({
        projects: projectsRes.count || 0,
        documents: documentsRes.count || 0,
        users: profilesRes.count || 0,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
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
                <h1 className="text-xl font-bold">Admin Dashboard</h1>
              </div>
            </div>
            <Button onClick={() => navigate('/')}>Back to Scanner</Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Welcome, Administrator</h2>
          <p className="text-muted-foreground">
            Manage projects, view documents, and configure extraction settings
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6 bg-gradient-to-br from-card to-card/80 shadow-[var(--shadow-elegant)]">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <FolderOpen className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Projects</p>
                <p className="text-2xl font-bold">{stats.projects}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-card to-card/80 shadow-[var(--shadow-elegant)]">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-accent/10 rounded-lg">
                <FileText className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Documents</p>
                <p className="text-2xl font-bold">{stats.documents}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-card to-card/80 shadow-[var(--shadow-elegant)]">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-secondary/10 rounded-lg">
                <Users className="h-6 w-6 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold">{stats.users}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="p-6 bg-gradient-to-br from-card to-card/80 shadow-[var(--shadow-elegant)]">
            <h3 className="text-xl font-semibold mb-4">Projects</h3>
            <p className="text-muted-foreground mb-4">
              Create and manage document processing projects with custom extraction fields
            </p>
            <div className="flex gap-3">
              <Button
                onClick={() => navigate('/admin/projects/new')}
                className="bg-gradient-to-r from-primary to-accent"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Project
              </Button>
              <Button variant="outline" onClick={() => navigate('/admin/projects')}>
                View All
              </Button>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-card to-card/80 shadow-[var(--shadow-elegant)]">
            <h3 className="text-xl font-semibold mb-4">Documents</h3>
            <p className="text-muted-foreground mb-4">
              View all uploaded documents and their extracted metadata across all projects
            </p>
            <Button variant="outline" onClick={() => navigate('/documents')}>
              View Documents
            </Button>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
