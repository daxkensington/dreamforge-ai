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
import { toast } from "sonner";
import { Plus, Trash2, Edit, Sparkles, User, ImageIcon, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function Characters() {
  const { user } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [styleNotes, setStyleNotes] = useState("");
  const [genPrompt, setGenPrompt] = useState("");
  const [genCharId, setGenCharId] = useState<number | null>(null);

  const characters = trpc.character.list.useQuery(undefined, { enabled: !!user });
  const createMut = trpc.character.create.useMutation({
    onSuccess: () => { characters.refetch(); setShowCreate(false); resetForm(); toast.success("Character created"); },
  });
  const updateMut = trpc.character.update.useMutation({
    onSuccess: () => { characters.refetch(); setEditId(null); resetForm(); toast.success("Character updated"); },
  });
  const deleteMut = trpc.character.delete.useMutation({
    onSuccess: () => { characters.refetch(); toast.success("Character deleted"); },
  });
  const generateMut = trpc.character.generateWithCharacter.useMutation({
    onSuccess: (data) => { toast.success("Image generated!"); setGenCharId(null); },
  });

  function resetForm() {
    setName(""); setDescription(""); setStyleNotes("");
  }

  function startEdit(char: any) {
    setEditId(char.id);
    setName(char.name);
    setDescription(char.description || "");
    setStyleNotes(char.styleNotes || "");
  }

  if (!user) {
    return (
      <div className="container py-20 text-center">
        <User className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
        <h1 className="text-3xl font-bold mb-4">Character Library</h1>
        <p className="text-muted-foreground mb-6">Create consistent characters across all your generations.</p>
        <a href={getLoginUrl()}><Button size="lg">Sign In to Get Started</Button></a>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/workspace"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div>
          <h1 className="text-3xl font-bold">Character Library</h1>
          <p className="text-muted-foreground">Create and manage consistent characters for your generations</p>
        </div>
      </div>

      <div className="flex justify-end mb-6">
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setShowCreate(true); }}>
              <Plus className="w-4 h-4 mr-2" /> New Character
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Character</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <Input placeholder="Character name" value={name} onChange={(e) => setName(e.target.value)} />
              <Textarea placeholder="Physical description (hair, eyes, build, clothing...)" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
              <Textarea placeholder="Style notes (art style, color palette, mood...)" value={styleNotes} onChange={(e) => setStyleNotes(e.target.value)} rows={3} />
              <Button className="w-full" onClick={() => createMut.mutate({ name, description, styleNotes })} disabled={!name || createMut.isPending}>
                {createMut.isPending ? "Creating..." : "Create Character"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {characters.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : characters.data?.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <User className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Characters Yet</h3>
            <p className="text-muted-foreground mb-4">Create your first character to maintain consistency across generations.</p>
            <Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-2" /> Create Character</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {characters.data?.map((char) => (
            <Card key={char.id} className="group hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{char.name}</CardTitle>
                    <CardDescription className="text-xs mt-1">
                      Created {new Date(char.createdAt).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary"><User className="w-3 h-3 mr-1" /> Character</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {char.description && (
                  <p className="text-sm text-muted-foreground line-clamp-3">{char.description}</p>
                )}
                {char.styleNotes && (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">Style: {(char.styleNotes as string).substring(0, 40)}...</Badge>
                  </div>
                )}
                {(char.referenceImages as string[] || []).length > 0 && (
                  <div className="flex gap-1">
                    {(char.referenceImages as string[]).slice(0, 3).map((url, i) => (
                      <div key={i} className="w-10 h-10 rounded bg-muted overflow-hidden">
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      </div>
                    ))}
                    <Badge variant="outline" className="text-xs"><ImageIcon className="w-3 h-3 mr-1" /> {(char.referenceImages as string[]).length} refs</Badge>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="default" onClick={() => setGenCharId(char.id)}>
                        <Sparkles className="w-3 h-3 mr-1" /> Generate
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Generate with {char.name}</DialogTitle></DialogHeader>
                      <div className="space-y-4">
                        <Textarea placeholder="Describe the scene for this character..." value={genPrompt} onChange={(e) => setGenPrompt(e.target.value)} rows={4} />
                        <Button className="w-full" onClick={() => generateMut.mutate({ characterId: char.id, prompt: genPrompt })} disabled={!genPrompt || generateMut.isPending}>
                          {generateMut.isPending ? "Generating..." : "Generate Image"}
                        </Button>
                        {generateMut.data?.url && (
                          <img src={generateMut.data.url} alt="Generated" className="w-full rounded-lg" />
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Button size="sm" variant="outline" onClick={() => startEdit(char)}>
                    <Edit className="w-3 h-3" />
                  </Button>
                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => deleteMut.mutate({ id: char.id })}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editId !== null} onOpenChange={(open) => { if (!open) setEditId(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Character</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Character name" value={name} onChange={(e) => setName(e.target.value)} />
            <Textarea placeholder="Physical description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
            <Textarea placeholder="Style notes" value={styleNotes} onChange={(e) => setStyleNotes(e.target.value)} rows={3} />
            <Button className="w-full" onClick={() => editId && updateMut.mutate({ id: editId, name, description, styleNotes })} disabled={!name || updateMut.isPending}>
              {updateMut.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
