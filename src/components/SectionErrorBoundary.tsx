import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { logError } from '@/lib/error-logger';
import { cn } from '@/lib/utils';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  sectionName?: string;
  onReset?: () => void;
  className?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  showDetails: boolean;
}

export class SectionErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[${this.props.sectionName || 'Section'}] Error:`, error, errorInfo);
    
    logError(error, this.props.sectionName || 'SectionErrorBoundary', {
      componentStack: errorInfo.componentStack,
    });
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, showDetails: false });
    this.props.onReset?.();
  };

  private toggleDetails = () => {
    this.setState(prev => ({ showDetails: !prev.showDetails }));
  };

  public render() {
    if (this.state.hasError) {
      // Custom fallback provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default inline error UI
      return (
        <Card className={cn("border-destructive/50 bg-destructive/5", this.props.className)}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-destructive text-base">
              <AlertTriangle className="h-5 w-5" />
              {this.props.sectionName ? `Error in ${this.props.sectionName}` : 'Something went wrong'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This section encountered an error. You can try reloading it or continue using other parts of the application.
            </p>

            {import.meta.env.DEV && this.state.error && (
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={this.toggleDetails}
                  className="text-xs h-7 px-2"
                >
                  {this.state.showDetails ? (
                    <>
                      <ChevronUp className="h-3 w-3 mr-1" />
                      Hide Details
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3 mr-1" />
                      Show Details
                    </>
                  )}
                </Button>
                
                {this.state.showDetails && (
                  <div className="mt-2 p-3 bg-muted rounded-md">
                    <p className="text-xs font-mono text-destructive break-all">
                      {this.state.error.message}
                    </p>
                    {this.state.error.stack && (
                      <pre className="mt-2 text-xs font-mono text-muted-foreground overflow-x-auto max-h-32">
                        {this.state.error.stack}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )}

            <Button size="sm" onClick={this.handleRetry} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

// HOC for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  sectionName?: string
) {
  return function WithErrorBoundary(props: P) {
    return (
      <SectionErrorBoundary sectionName={sectionName}>
        <WrappedComponent {...props} />
      </SectionErrorBoundary>
    );
  };
}
