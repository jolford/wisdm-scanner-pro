import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface ProgressCardProps {
  title: string;
  current: number;
  total: number;
  description?: string;
  variant?: "default" | "success" | "warning" | "info";
  className?: string;
}

export function ProgressCard({
  title,
  current,
  total,
  description,
  variant = "default",
  className,
}: ProgressCardProps) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  const variantClasses = {
    default: "border-primary/20",
    success: "border-success/20 bg-success-light",
    warning: "border-warning/20 bg-warning-light",
    info: "border-info/20 bg-info-light",
  };

  return (
    <Card className={cn("card-elevated", variantClasses[variant], className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <span className="text-2xl font-bold">{percentage}%</span>
        </div>
      </CardHeader>
      <CardContent>
        <Progress value={percentage} className="h-2 mb-2" />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {current} / {total}
          </span>
          {description && <span>{description}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
