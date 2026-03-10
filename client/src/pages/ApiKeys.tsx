import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, Trash2, Key, Copy, Shield, ArrowLeft, AlertTriangle } from "lucide-react";
import { Link } from "wouter";

export default function ApiKeys() {
  const { user } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);

  const keys = trpc.apiKey.list.useQuery(undefined, { enabled: !!user });
  const createMut = trpc.apiKey.create.useMutation({
    onSuccess: (data) => { keys.refetch(); setNewKey(data.key); setName(""); toast.success("API key created"); },
  });
  const revokeMut = trpc.apiKey.revoke.useMutation({
    onSuccess: () => { keys.refetch(); toast.success("API key revoked"); },
  });
  const deleteMut = trpc.apiKey.delete.useMutation({
    onSuccess: () => { keys.refetch(); toast.success("API key deleted"); },
  });

  if (!user) {
    return (
      <div className="container py-20 text-center">
        <Key className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
        <h1 className="text-3xl font-bold mb-4">API Access</h1>
        <p className="text-muted-foreground mb-6">Manage API keys for programmatic access to DreamForge.</p>
        <a href={getLoginUrl()}><Button size="lg">Sign In to Get Started</Button></a>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/profile"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div>
          <h1 className="text-3xl font-bold">API Keys</h1>
          <p className="text-muted-foreground">Manage your API keys for programmatic access</p>
        </div>
      </div>

      {/* API Documentation Card */}
      <Card className="mb-6 border-blue-500/20 bg-blue-500/5">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-2 flex items-center gap-2"><Shield className="w-4 h-4" /> API Documentation</h3>
          <p className="text-sm text-muted-foreground mb-3">Use your API key to access DreamForge programmatically. Include it in the Authorization header:</p>
          <div className="bg-background rounded-lg p-3 font-mono text-sm">
            <span className="text-muted-foreground">Authorization:</span> Bearer df_your_api_key_here
          </div>
          <div className="mt-3 space-y-1 text-sm text-muted-foreground">
            <p><strong>Base URL:</strong> <code className="text-xs bg-muted px-1 rounded">/api/v1</code></p>
            <p><strong>Endpoints:</strong> <code className="text-xs bg-muted px-1 rounded">POST /generate</code>, <code className="text-xs bg-muted px-1 rounded">POST /tools/*</code></p>
            <p><strong>Rate Limit:</strong> 100 requests/hour (default)</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end mb-4">
        <Dialog open={showCreate} onOpenChange={(open) => { setShowCreate(open); if (!open) setNewKey(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => { setName(""); setNewKey(null); setShowCreate(true); }}>
              <Plus className="w-4 h-4 mr-2" /> Create API Key
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{newKey ? "API Key Created" : "Create API Key"}</DialogTitle></DialogHeader>
            {newKey ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />
                  <p className="text-sm">Copy this key now. You won't be able to see it again.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Input value={newKey} readOnly className="font-mono text-xs" />
                  <Button size="icon" variant="outline" onClick={() => { navigator.clipboard.writeText(newKey); toast.success("Copied!"); }}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <Button className="w-full" onClick={() => { setShowCreate(false); setNewKey(null); }}>Done</Button>
              </div>
            ) : (
              <div className="space-y-4">
                <Input placeholder="Key name (e.g., Production, Testing)" value={name} onChange={(e) => setName(e.target.value)} />
                <Button className="w-full" onClick={() => createMut.mutate({ name })} disabled={!name || createMut.isPending}>
                  {createMut.isPending ? "Creating..." : "Create Key"}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {keys.isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : keys.data?.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Key className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No API Keys</h3>
            <p className="text-muted-foreground mb-4">Create an API key to start using the DreamForge API.</p>
            <Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-2" /> Create Key</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {keys.data?.map((key) => (
            <Card key={key.id}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Key className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <h3 className="font-semibold">{key.name}</h3>
                      <p className="text-sm text-muted-foreground font-mono">{key.keyPrefix}...{'•'.repeat(20)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={key.active ? "default" : "secondary"}>
                      {key.active ? "Active" : "Revoked"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {key.lastUsedAt ? `Last used ${new Date(key.lastUsedAt).toLocaleDateString()}` : "Never used"}
                    </span>
                    {key.active && (
                      <Button size="sm" variant="outline" onClick={() => revokeMut.mutate({ id: key.id })}>
                        Revoke
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="text-destructive" onClick={() => deleteMut.mutate({ id: key.id })}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
