const APP_VERSION = '1.0';

export const Footer = () => {
  return (
    <footer className="border-t border-border/50 bg-background/80 backdrop-blur-sm py-4 mt-auto">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center gap-1 text-sm text-muted-foreground">
          <p>© 2025 Western Integrated Systems. All rights reserved.</p>
          <p className="text-xs">Version {APP_VERSION}</p>
        </div>
      </div>
    </footer>
  );
};
