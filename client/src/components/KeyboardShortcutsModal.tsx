import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { SHORTCUT_REFERENCE } from "@/hooks/useKeyboardShortcuts";
import { Keyboard } from "lucide-react";

export default function KeyboardShortcutsModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(prev => !prev);
    document.addEventListener("toggle-shortcuts-modal", handler);
    return () => document.removeEventListener("toggle-shortcuts-modal", handler);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="w-5 h-5" /> Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6 mt-2">
          {SHORTCUT_REFERENCE.map(group => (
            <div key={group.scope}>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">{group.scope}</h3>
              <div className="space-y-2">
                {group.shortcuts.map(s => (
                  <div key={s.keys} className="flex items-center justify-between">
                    <span className="text-sm">{s.description}</span>
                    <div className="flex gap-1">
                      {s.keys.split(" + ").map(k => (
                        <Badge key={k} variant="outline" className="font-mono text-xs px-2">{k.trim()}</Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
