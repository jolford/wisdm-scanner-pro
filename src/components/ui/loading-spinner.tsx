import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function LoadingSpinner({ className, size = "md" }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };

  return (
    <div className={cn("relative", sizeClasses[size], className)}>
      {/* Outer glow pulse */}
      <div className="absolute inset-0 rounded-full bg-primary/20 blur-md animate-pulse" />
      
      {/* Outer rotating ring (slow) */}
      <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary/40 border-r-primary/40 animate-spin" style={{ animationDuration: '3s' }} />
      
      {/* Middle rotating ring (medium, reverse) */}
      <div className="absolute inset-[15%] rounded-full border-4 border-transparent border-t-primary border-l-primary/60 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
      
      {/* Inner rotating ring (fast) */}
      <div className="absolute inset-[30%] rounded-full border-3 border-transparent border-t-accent border-r-accent/80 animate-spin" style={{ animationDuration: '0.8s' }} />
      
      {/* Center pulsing orb with gradient */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-3 w-3 rounded-full bg-gradient-to-br from-primary to-accent animate-pulse shadow-lg shadow-primary/50" />
      </div>
      
      {/* Orbiting particles */}
      <div className="absolute inset-0 animate-spin" style={{ animationDuration: '2s' }}>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-primary shadow-lg shadow-primary/50" />
      </div>
      <div className="absolute inset-0 animate-spin" style={{ animationDuration: '2s', animationDelay: '0.5s' }}>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-accent shadow-lg shadow-accent/50" />
      </div>
    </div>
  );
}
