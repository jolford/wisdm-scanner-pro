import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: "validated" | "pending" | "rejected" | "processing" | "error";
  className?: string;
  showIcon?: boolean;
}

const statusConfig = {
  validated: {
    label: "Validated",
    variant: "success-soft" as const,
    icon: CheckCircle2,
  },
  pending: {
    label: "Pending",
    variant: "warning-soft" as const,
    icon: Clock,
  },
  rejected: {
    label: "Rejected",
    variant: "destructive" as const,
    icon: XCircle,
  },
  processing: {
    label: "Processing",
    variant: "processing-soft" as const,
    icon: Loader2,
  },
  error: {
    label: "Error",
    variant: "destructive" as const,
    icon: AlertCircle,
  },
};

export function StatusBadge({ status, className, showIcon = true }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={cn("gap-1", className)}>
      {showIcon && (
        <Icon
          className={cn(
            "h-3 w-3",
            status === "processing" && "animate-spin"
          )}
        />
      )}
      {config.label}
    </Badge>
  );
}
