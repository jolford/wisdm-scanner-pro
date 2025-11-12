import { Link, LinkProps, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface NavLinkProps extends LinkProps {
  activeClassName?: string;
  end?: boolean;
}

export function NavLink({ 
  to, 
  className, 
  activeClassName = 'bg-primary/10 text-primary font-medium',
  end = false,
  children,
  ...props 
}: NavLinkProps) {
  const location = useLocation();
  const toPath = typeof to === 'string' ? to : to.pathname || '';
  
  const isActive = end 
    ? location.pathname === toPath
    : location.pathname.startsWith(toPath);

  return (
    <Link
      to={to}
      className={cn(className, isActive && activeClassName)}
      aria-current={isActive ? 'page' : undefined}
      {...props}
    >
      {children}
    </Link>
  );
}
