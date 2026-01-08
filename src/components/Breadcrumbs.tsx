import { ChevronRight, Home } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

const routeLabels: Record<string, string> = {
  admin: 'Admin',
  projects: 'Projects',
  batches: 'Batches',
  documents: 'Documents',
  users: 'Users',
  licenses: 'Licenses',
  customers: 'Customers',
  analytics: 'Analytics',
  'cost-tracking': 'Cost Tracking',
  'ml-learning': 'ML Learning',
  'smart-routing': 'Smart Routing',
  'advanced-search': 'Advanced Search',
  workflows: 'Workflows',
  'workflow-builder': 'Workflow Builder',
  integrations: 'Integrations',
  'batch-templates': 'Batch Templates',
  webhooks: 'Webhooks',
  confidence: 'Confidence Scoring',
  exceptions: 'Exception Queue',
  duplicates: 'Duplicate Detection',
  'validation-rules': 'Validation Rules',
  'scheduled-batches': 'Scheduled Batches',
  new: 'New',
  edit: 'Edit',
};

export const Breadcrumbs = () => {
  const location = useLocation();
  const pathSegments = location.pathname.split('/').filter(Boolean);

  if (pathSegments.length === 0) return null;

  const breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', href: '/' },
  ];

  let currentPath = '';
  pathSegments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    const label = routeLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
    
    // Don't make the last item a link
    const isLast = index === pathSegments.length - 1;
    breadcrumbs.push({
      label,
      href: isLast ? undefined : currentPath,
    });
  });

  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex items-center space-x-2 text-xs text-muted-foreground/80">
        {breadcrumbs.map((crumb, index) => (
          <li key={index} className="flex items-center">
            {index > 0 && <ChevronRight className="h-4 w-4 mx-2" />}
            {crumb.href ? (
              <Link
                to={crumb.href}
                className="flex items-center hover:text-foreground transition-colors"
              >
                {index === 0 && <Home className="h-4 w-4 mr-1" />}
                {crumb.label}
              </Link>
            ) : (
              <span className={cn("flex items-center font-medium text-foreground", index === 0 && "gap-1")}>
                {index === 0 && <Home className="h-4 w-4" />}
                {crumb.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};
