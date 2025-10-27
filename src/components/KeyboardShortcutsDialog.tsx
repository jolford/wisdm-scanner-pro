import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Keyboard } from 'lucide-react';
import { GLOBAL_SHORTCUTS } from '@/hooks/use-keyboard-shortcuts';

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  const shortcutsByCategory = Object.entries(GLOBAL_SHORTCUTS).reduce((acc, [_, shortcut]) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, typeof GLOBAL_SHORTCUTS[keyof typeof GLOBAL_SHORTCUTS][]>);

  const formatKey = (key: string, modifiers?: { ctrl?: boolean; shift?: boolean; alt?: boolean }) => {
    const parts = [];
    if (modifiers?.ctrl) parts.push('Ctrl');
    if (modifiers?.shift) parts.push('Shift');
    if (modifiers?.alt) parts.push('Alt');
    parts.push(key === ' ' ? 'Space' : key.toUpperCase());
    return parts;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            <DialogTitle>Keyboard Shortcuts</DialogTitle>
          </div>
          <DialogDescription>
            Use these shortcuts to navigate and perform actions quickly
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {Object.entries(shortcutsByCategory).map(([category, shortcuts]) => (
            <div key={category}>
              <h3 className="font-semibold mb-3 text-sm text-muted-foreground">{category}</h3>
              <div className="space-y-2">
                {shortcuts.map((shortcut, index) => (
                  <div key={index} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30">
                    <span className="text-sm">{shortcut.description}</span>
                    <div className="flex gap-1">
                      {formatKey(shortcut.key, 'modifiers' in shortcut ? shortcut.modifiers : undefined).map((key, i) => (
                        <Badge key={i} variant="outline" className="font-mono text-xs">
                          {key}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {category !== Object.keys(shortcutsByCategory)[Object.keys(shortcutsByCategory).length - 1] && (
                <Separator className="mt-4" />
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
          <p><strong>Tip:</strong> Shortcuts won't work when typing in input fields. Press <Badge variant="outline" className="font-mono text-xs mx-1">Esc</Badge> to unfocus and use shortcuts.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
