import { ReactNode } from 'react';
import { Menu, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import wisdmLogo from '@/assets/wisdm-logo.png';
import {
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { AdminSidebar } from './AdminSidebar';
import { LanguageSelector } from '@/components/LanguageSelector';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Breadcrumbs } from '@/components/Breadcrumbs';

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
}

export function AdminLayout({ children, title, description }: AdminLayoutProps) {
  const navigate = useNavigate();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-background via-background to-accent/5">
        <AdminSidebar />

        <div className="flex-1 flex flex-col min-h-screen">
          <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-10 bg-background/80" role="banner">
            <div className="container mx-auto px-4 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <SidebarTrigger aria-label="Toggle navigation menu">
                    <Menu className="h-5 w-5" />
                  </SidebarTrigger>
                  <img src={wisdmLogo} alt="WISDM Document Capture and OCR Platform" className="h-6 w-auto dark:bg-white dark:p-1.5 dark:rounded-md" />
                  <div>
                    <h1 className="text-xl font-bold">{title}</h1>
                    {description && (
                      <p className="text-sm text-muted-foreground">{description}</p>
                    )}
                  </div>
                </div>
                <nav aria-label="Utility navigation">
                  <div className="flex items-center gap-2">
                    <LanguageSelector variant="dropdown" />
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => navigate('/api-docs')}
                      className="h-9 w-9"
                      title="API Documentation"
                    >
                      <BookOpen className="h-4 w-4" />
                    </Button>
                    <ThemeToggle />
                  </div>
                </nav>
              </div>
            </div>
          </header>

          <main className="flex-1 container mx-auto px-4 py-8" role="main" aria-label={title}>
            <Breadcrumbs />
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
