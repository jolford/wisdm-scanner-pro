import { ReactNode } from 'react';
import { Menu } from 'lucide-react';
import lucidDocsLogo from '@/assets/luciddocs-logo-new.png';
import {
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { AdminSidebar } from './AdminSidebar';
import { AdminHeader } from './AdminHeader';
import { Breadcrumbs } from '@/components/Breadcrumbs';

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
}

export function AdminLayout({ children, title, description }: AdminLayoutProps) {
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
                  <div className="bg-card rounded-lg border border-border/50 p-2 shadow-sm">
                    <img
                      src={lucidDocsLogo}
                      alt="LucidDocs AI Document Processing"
                      className="h-10 sm:h-12 w-auto"
                    />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold">{title}</h1>
                    {description && (
                      <p className="text-sm text-muted-foreground">{description}</p>
                    )}
                  </div>
                </div>
                <nav aria-label="Utility navigation">
                  <AdminHeader />
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
