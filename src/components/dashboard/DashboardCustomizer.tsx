import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { WIDGET_REGISTRY } from './WidgetRegistry';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plus } from 'lucide-react';

interface DashboardCustomizerProps {
  open: boolean;
  onClose: () => void;
  currentWidgets: string[];
  onAddWidget: (widgetType: string) => void;
}

export function DashboardCustomizer({
  open,
  onClose,
  currentWidgets,
  onAddWidget,
}: DashboardCustomizerProps) {
  const availableWidgets = Object.values(WIDGET_REGISTRY).filter(
    (widget) => !currentWidgets.includes(widget.type)
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Customize Dashboard</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[500px] pr-4">
          <div className="grid grid-cols-2 gap-4">
            {availableWidgets.map((widget) => {
              const Icon = widget.icon;
              return (
                <Card key={widget.id} className="hover:border-primary transition-colors">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <Icon className="h-5 w-5 mt-1 text-primary" />
                        <div>
                          <CardTitle className="text-base">{widget.title}</CardTitle>
                          <CardDescription className="mt-1">{widget.description}</CardDescription>
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="mt-3"
                      onClick={() => {
                        onAddWidget(widget.type);
                        onClose();
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Widget
                    </Button>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
          {availableWidgets.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              All available widgets are already added to your dashboard
            </p>
          )}
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
