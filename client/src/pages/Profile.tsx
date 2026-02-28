import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import DisclaimerBanner from "@/components/DisclaimerBanner";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  User,
  Building2,
  FileText,
  Image,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from "wouter";

export default function Profile() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [institution, setInstitution] = useState("");

  const { data: generations, isLoading: gensLoading } = trpc.generation.list.useQuery(
    { limit: 10, offset: 0 },
    { enabled: isAuthenticated }
  );

  const updateProfile = trpc.user.updateProfile.useMutation({
    onSuccess: () => toast.success("Profile updated"),
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setBio((user as any).bio || "");
      setInstitution((user as any).institution || "");
    }
  }, [user]);

  if (authLoading) {
    return (
      <PageLayout>
        <div className="container py-12">
          <Skeleton className="h-8 w-48 mb-8" />
          <div className="grid lg:grid-cols-3 gap-8">
            <Skeleton className="h-64" />
            <Skeleton className="h-64 lg:col-span-2" />
          </div>
        </div>
      </PageLayout>
    );
  }

  if (!isAuthenticated) {
    return (
      <PageLayout>
        <div className="container py-24 text-center">
          <h1 className="text-2xl font-bold mb-4">Sign in Required</h1>
          <p className="text-muted-foreground mb-6">Please sign in to view your profile.</p>
          <Button onClick={() => (window.location.href = getLoginUrl())}>Sign in</Button>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="container py-12">
        <h1 className="text-2xl font-bold tracking-tight mb-8">Researcher Profile</h1>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Profile Form */}
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                Profile Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Display Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="institution">Institution</Label>
                <Input
                  id="institution"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  placeholder="e.g., MIT Media Lab"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="bio">Research Bio</Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Brief description of your research interests..."
                  rows={4}
                  className="mt-1.5"
                />
              </div>
              <Button
                onClick={() => updateProfile.mutate({ name, bio, institution })}
                disabled={updateProfile.isPending}
                className="w-full"
              >
                {updateProfile.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Profile
              </Button>
            </CardContent>
          </Card>

          {/* Recent Generations */}
          <div className="lg:col-span-2">
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Image className="h-4 w-4 text-primary" />
                    Recent Generations
                  </CardTitle>
                  <Button asChild variant="outline" size="sm" className="bg-transparent">
                    <Link href="/workspace">View All</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {gensLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : !generations || generations.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Image className="h-8 w-8 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No generations yet</p>
                    <Button asChild variant="link" size="sm" className="mt-2">
                      <Link href="/workspace">Create your first generation</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {generations.map((gen) => (
                      <div
                        key={gen.id}
                        className="flex items-center gap-4 p-3 rounded-lg border border-border/50 hover:bg-accent/50 transition-colors"
                      >
                        {gen.imageUrl ? (
                          <img
                            src={gen.imageUrl}
                            alt=""
                            className="h-12 w-12 rounded-md object-cover bg-muted"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center">
                            <Image className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{gen.prompt}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(gen.createdAt).toLocaleDateString()}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {gen.modelVersion}
                            </span>
                          </div>
                        </div>
                        <div>
                          {gen.status === "completed" && (
                            <CheckCircle className="h-4 w-4 text-emerald-500" />
                          )}
                          {gen.status === "failed" && (
                            <XCircle className="h-4 w-4 text-destructive" />
                          )}
                          {gen.status === "generating" && (
                            <Loader2 className="h-4 w-4 text-primary animate-spin" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="mt-6">
              <DisclaimerBanner compact />
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
