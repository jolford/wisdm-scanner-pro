import { Link } from "react-router-dom";
const APP_VERSION = '1.0';

export const Footer = () => {
  return (
    <footer className="border-t border-border bg-background py-4 mt-auto">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
          <p>© 2025 Western Integrated Systems. All rights reserved.</p>
          <div className="flex items-center gap-4 flex-wrap justify-center">
            <Link to="/help" className="hover:underline">Help Center</Link>
            <Link to="/api-docs" className="hover:underline">API Docs</Link>
            <Link to="/download/presentation" className="hover:underline font-medium">Download PowerPoint</Link>
          </div>
          <div className="flex items-center gap-4 flex-wrap justify-center text-xs">
            <Link to="/privacy-policy" className="hover:underline">Privacy Policy</Link>
            <Link to="/terms-of-service" className="hover:underline">Terms of Service</Link>
            <Link to="/cookie-policy" className="hover:underline">Cookie Policy</Link>
            <Link to="/data-processing-agreement" className="hover:underline">DPA</Link>
          </div>
          <p className="text-xs">Version {APP_VERSION}</p>
        </div>
      </div>
    </footer>
  );
};
