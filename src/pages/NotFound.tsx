import { useLocation, Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
    
    // Auto-redirect if this is a URL-encoded query string issue (e.g., %3F instead of ?)
    if (location.pathname.includes('%3F') || location.pathname.includes('%26')) {
      const decodedPath = decodeURIComponent(location.pathname);
      if (decodedPath.includes('?')) {
        // Extract path and query from the decoded URL
        const [path, query] = decodedPath.split('?');
        navigate(`${path || '/'}?${query}`, { replace: true });
        return;
      }
    }
  }, [location.pathname, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold text-foreground">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Oops! Page not found</p>
        <Button asChild>
          <Link to="/">
            <Home className="h-4 w-4 mr-2" />
            Return to Home
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
