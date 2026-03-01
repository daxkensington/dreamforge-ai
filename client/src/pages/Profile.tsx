import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import PageLayout from "@/components/PageLayout";
import { Badge } from "@/components/ui/badge";
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
  Image,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Sparkles,
  Film,
  Calendar,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";

export default function Profile() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [institution, setInstitution] = useState("");

  const { data: generations, isLoading: gensLoading } = trpc.generation.list.useQuery(
    { limit: 20, offset: 0 },
    { enabled: isAuthenticated }
  );

  const updateProfile = trpc.user.updateProfile.useMutation({
    onSuccess: () => toast.success("Profile updated"),
    onError: (err: any) => toast.error(err.message),
  });

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setBio((user as any).bio || "");
      setInstitution((user as any).institution || "");
    }
  }, [user]);

  // Compute stats from generations
  const stats = useMemo(() => {
    if (!generations) return { total: 0, completed: 0, images: 0, videos: 0 };
    return {
      total: generations.length,
      completed: generations.filter((g: any) => g.status === "completed").length,
      images: generations.filter((g: any) => g.mediaType === "image" && g.status === "completed").length,
      videos: generations.filter((g: any) => g.mediaType === "video" && g.status === "completed").length,
    };
  }, [generations]);

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
          <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-bold mb-4">Sign in Required</h1>
          <p className="text-muted-foreground mb-6">Please sign in to view your profile.</p>
          <Button onClick={() => (window.location.href = getLoginUrl())}>Sign in</Button>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="container py-8 md:py-12">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-8 flex items-center gap-2">
          <User className="h-6 w-6 text-primary" />
          My Profile
        </h1>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Creations", value: stats.total, icon: Sparkles, color: "text-primary" },
            { label: "Completed", value: stats.completed, icon: CheckCircle, color: "text-emerald-500" },
            { label: "Images", value: stats.images, icon: Image, color: "text-blue-500" },
            { label: "Videos", value: stats.videos, icon: Film, color: "text-fuchsia-500" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="border-border/50 bg-card/50">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-muted/50 flex items-center justify-center">
                      <stat.icon className={`h-5 w-5 ${stat.color}`} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stat.value}</p>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Profile Form */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
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
                  <Label htmlFor="institution" className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" />
                    About
                  </Label>
                  <Input
                    id="institution"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    placeholder="e.g., Digital artist, 3D designer"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell us about yourself and what you create..."
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

            {/* Account Info */}
            <Card className="border-border/50 bg-card/50 mt-4">
              <CardContent className="pt-4 pb-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-mono text-xs">{user?.email || "—"}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Role</span>
                  <Badge variant="outline" className="bg-transparent text-xs capitalize">
                    {user?.role}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Joined</span>
                  <span className="text-xs">
                    {user?.createdAt ? new Date(user.createdAt).toLocaleDateString("en-US", {
                      year: "numeric", month: "long", day: "numeric",
                    }) : "—"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Recent Generations */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-2"
          >
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Image className="h-4 w-4 text-primary" />
                    Recent Creations
                  </CardTitle>
                  <Button asChild variant="outline" size="sm" className="bg-transparent">
                    <Link href="/workspace">Go to Studio</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {gensLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : !generations || generations.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Image className="h-8 w-8 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No creations yet</p>
                    <Button asChild variant="link" size="sm" className="mt-2">
                      <Link href="/workspace">Create your first artwork</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {generations.map((gen: any) => (
                      <div
                        key={gen.id}
                        className="flex items-center gap-4 p-3 rounded-lg border border-border/50 hover:bg-accent/50 transition-colors"
                      >
                        {gen.imageUrl ? (
                          <img
                            src={gen.imageUrl}
                            alt=""
                            className="h-14 w-14 rounded-lg object-cover bg-muted"
                          />
                        ) : (
                          <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center">
                            {gen.mediaType === "video" ? (
                              <Film className="h-5 w-5 text-muted-foreground" />
                            ) : (
                              <Image className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{gen.prompt}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(gen.createdAt).toLocaleDateString()}
                            </span>
                            <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              {gen.modelVersion}
                            </span>
                            <Badge variant="outline" className="bg-transparent text-[10px] capitalize">
                              {gen.mediaType}
                            </Badge>
                          </div>
                        </div>
                        <div>
                          {gen.status === "completed" && <CheckCircle className="h-4 w-4 text-emerald-500" />}
                          {gen.status === "failed" && <XCircle className="h-4 w-4 text-destructive" />}
                          {gen.status === "generating" && <Loader2 className="h-4 w-4 text-primary animate-spin" />}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>


          </motion.div>
        </div>
      </div>
    </PageLayout>
  );
}
