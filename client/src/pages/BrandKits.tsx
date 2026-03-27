import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Trash2, Edit, Palette, ArrowLeft, Paintbrush, Copy } from "lucide-react";
import { Link } from "wouter";

export default function BrandKits() {
  const { user } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [stylePrompt, setStylePrompt] = useState("");
  const [typography, setTypography] = useState("");
  const [colors, setColors] = useState<string[]>(["#000000", "#ffffff", "#3b82f6"]);

  const kits = trpc.brandKit.list.useQuery(undefined, { enabled: !!user });
  const presets = trpc.brandKit.presets.useQuery();
  const createMut = trpc.brandKit.create.useMutation({
    onSuccess: () => { kits.refetch(); setShowCreate(false); resetForm(); toast.success("Brand kit created"); },
  });
  const updateMut = trpc.brandKit.update.useMutation({
    onSuccess: () => { kits.refetch(); setEditId(null); resetForm(); toast.success("Brand kit updated"); },
  });
  const deleteMut = trpc.brandKit.delete.useMutation({
    onSuccess: () => { kits.refetch(); toast.success("Brand kit deleted"); },
  });

  function resetForm() {
    setName(""); setStylePrompt(""); setTypography(""); setColors(["#000000", "#ffffff", "#3b82f6"]);
  }

  function startEdit(kit: any) {
    setEditId(kit.id);
    setName(kit.name);
    setStylePrompt(kit.stylePrompt || "");
    setTypography(kit.typography || "");
    setColors((kit.colorPalette as string[]) || ["#000000", "#ffffff", "#3b82f6"]);
  }

  function applyPreset(preset: any) {
    setStylePrompt(preset.prompt);
    setColors(preset.colors);
    setName(preset.name + " Kit");
    toast.info(`Applied "${preset.name}" preset`);
  }

  if (!user) {
    return (
      <div className="container py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center mx-auto mb-4">
          <Palette className="w-8 h-8 text-cyan-400" />
        </div>
        <h1 className="text-3xl font-bold mb-4">Brand Kits</h1>
        <p className="text-muted-foreground mb-6">Create reusable style presets for consistent branding.</p>
        <a href={getLoginUrl()}><Button size="lg" className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white">Sign In to Get Started</Button></a>
      </div>
    );
  }

  const KitForm = ({ onSubmit, submitLabel, isPending }: { onSubmit: () => void; submitLabel: string; isPending: boolean }) => (
    <div className="space-y-4">
      <Input placeholder="Kit name" value={name} onChange={(e) => setName(e.target.value)} />
      <Textarea placeholder="Style prompt (e.g., cinematic lighting, film grain, dramatic shadows...)" value={stylePrompt} onChange={(e) => setStylePrompt(e.target.value)} rows={3} />
      <Input placeholder="Typography (e.g., Inter, Playfair Display)" value={typography} onChange={(e) => setTypography(e.target.value)} />
      <div>
        <label className="text-sm font-medium mb-2 block">Color Palette</label>
        <div className="flex gap-2 items-center flex-wrap">
          {colors.map((c, i) => (
            <div key={i} className="flex items-center gap-1">
              <input type="color" value={c} onChange={(e) => { const nc = [...colors]; nc[i] = e.target.value; setColors(nc); }} className="w-8 h-8 rounded cursor-pointer border-0" />
              <span className="text-xs font-mono text-muted-foreground">{c}</span>
            </div>
          ))}
          {colors.length < 8 && (
            <Button size="sm" variant="outline" onClick={() => setColors([...colors, "#888888"])}>
              <Plus className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>
      <Button className="w-full" onClick={onSubmit} disabled={!name || isPending}>
        {isPending ? "Saving..." : submitLabel}
      </Button>
    </div>
  );

  return (
    <div>
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/15 via-transparent to-purple-900/10" />
        <div className="absolute top-0 right-0 w-72 h-72 bg-blue-500/5 rounded-full blur-[100px]" />
        <div className="container max-w-5xl relative py-10 md:py-14">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <Link href="/workspace">
                <Button variant="ghost" size="sm" className="mb-3 gap-1.5 text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to Studio
                </Button>
              </Link>
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                  <Palette className="h-5 w-5 text-white" />
                </div>
                <h1 className="text-3xl font-bold">
                  Brand{" "}
                  <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
                    Kits
                  </span>
                </h1>
              </div>
              <p className="text-muted-foreground max-w-md">
                Create reusable style presets and brand identities for consistent, on-brand AI output.
              </p>
            </div>
            <div className="flex gap-2">
              {["/showcase/hero-brandkit-1.jpg", "/showcase/hero-brandkit-2.jpg", "/showcase/hero-brandkit-3.jpg"].map((img, i) => (
                <div key={i} className="h-20 w-20 rounded-xl overflow-hidden border border-white/10 opacity-70">
                  <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8 max-w-5xl mx-auto">

      <Tabs defaultValue="kits">
        <TabsList className="mb-6">
          <TabsTrigger value="kits">My Kits</TabsTrigger>
          <TabsTrigger value="presets">Style Presets</TabsTrigger>
        </TabsList>

        <TabsContent value="kits">
          <div className="flex justify-end mb-4">
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
              <DialogTrigger asChild>
                <Button onClick={() => { resetForm(); setShowCreate(true); }}>
                  <Plus className="w-4 h-4 mr-2" /> New Brand Kit
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create Brand Kit</DialogTitle></DialogHeader>
                <KitForm onSubmit={() => createMut.mutate({ name, stylePrompt, typography, colorPalette: colors })} submitLabel="Create Kit" isPending={createMut.isPending} />
              </DialogContent>
            </Dialog>
          </div>

          {kits.isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map(i => <Skeleton key={i} className="h-40" />)}
            </div>
          ) : kits.data?.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <Palette className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Brand Kits Yet</h3>
                <p className="text-muted-foreground mb-4">Create a kit or start from a preset.</p>
                <Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-2" /> Create Kit</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {kits.data?.map((kit) => (
                <Card key={kit.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg">{kit.name}</CardTitle>
                      <Badge variant="secondary"><Palette className="w-3 h-3 mr-1" /> Kit</Badge>
                    </div>
                    {kit.typography && <CardDescription>Font: {kit.typography}</CardDescription>}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex gap-1">
                      {((kit.colorPalette as string[]) || []).map((c, i) => (
                        <div key={i} className="w-8 h-8 rounded-md border" style={{ backgroundColor: c }} title={c} />
                      ))}
                    </div>
                    {kit.stylePrompt && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{kit.stylePrompt}</p>
                    )}
                    <div className="flex gap-2 pt-2">
                      <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(kit.stylePrompt || ""); toast.success("Style prompt copied"); }}>
                        <Copy className="w-3 h-3 mr-1" /> Copy Prompt
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => startEdit(kit)}>
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="outline" className="text-destructive" onClick={() => deleteMut.mutate({ id: kit.id })}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="presets">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {presets.data?.map((preset) => (
              <Card key={preset.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => { applyPreset(preset); setShowCreate(true); }}>
                <CardContent className="pt-6 space-y-3">
                  <div className="flex gap-1 mb-3">
                    {preset.colors.map((c, i) => (
                      <div key={i} className="flex-1 h-8 first:rounded-l-md last:rounded-r-md" style={{ backgroundColor: c }} />
                    ))}
                  </div>
                  <h3 className="font-semibold">{preset.name}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2">{preset.prompt}</p>
                  <Button size="sm" variant="outline" className="w-full">
                    <Paintbrush className="w-3 h-3 mr-1" /> Use Preset
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={editId !== null} onOpenChange={(open) => { if (!open) setEditId(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Brand Kit</DialogTitle></DialogHeader>
          <KitForm onSubmit={() => editId && updateMut.mutate({ id: editId, name, stylePrompt, typography, colorPalette: colors })} submitLabel="Save Changes" isPending={updateMut.isPending} />
        </DialogContent>
      </Dialog>
    </div>
    </div>
  );
}
