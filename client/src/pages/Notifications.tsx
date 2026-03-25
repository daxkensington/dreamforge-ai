import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Users,
  Sparkles,
  MessageSquare,
  Info,
  CreditCard,
  Trash2,
} from "lucide-react";

const typeIcons: Record<string, any> = {
  collaboration: Users,
  generation: Sparkles,
  comment: MessageSquare,
  system: Info,
  payment: CreditCard,
};

const typeColors: Record<string, string> = {
  collaboration: "bg-blue-500/10 text-blue-500",
  generation: "bg-purple-500/10 text-purple-500",
  comment: "bg-green-500/10 text-green-500",
  system: "bg-blue-500/10 text-blue-500",
  payment: "bg-emerald-500/10 text-emerald-500",
};

export default function Notifications() {
  const { user } = useAuth() as any;
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const utils = trpc.useUtils();

  const { data } = trpc.notifications.list.useQuery(
    { unreadOnly: filter === "unread" },
    { enabled: !!user }
  );

  const { data: preferences } = trpc.notifications.getPreferences.useQuery(
    undefined,
    { enabled: !!user }
  );

  const markRead = trpc.notifications.markAsRead.useMutation({
    onSuccess: () => utils.notifications.list.invalidate(),
  });

  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      toast.success("All notifications marked as read");
    },
  });

  const updatePref = trpc.notifications.updatePreference.useMutation({
    onSuccess: () => {
      utils.notifications.getPreferences.invalidate();
      toast.success("Preference updated");
    },
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader className="text-center">
            <Bell className="w-12 h-12 mx-auto text-primary mb-2" />
            <CardTitle>Sign in to view notifications</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild>
              <a href={getLoginUrl()}>Sign In</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10">
              <Bell className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Notifications</h1>
              <p className="text-muted-foreground">
                {data?.unreadCount || 0} unread notification
                {data?.unreadCount !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          {(data?.unreadCount || 0) > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              <CheckCheck className="w-4 h-4 mr-2" />
              Mark all read
            </Button>
          )}
        </div>

        <Tabs defaultValue="notifications" className="space-y-6">
          <TabsList>
            <TabsTrigger value="notifications">
              <Bell className="w-4 h-4 mr-2" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="preferences">
              <BellOff className="w-4 h-4 mr-2" />
              Preferences
            </TabsTrigger>
          </TabsList>

          <TabsContent value="notifications">
            {/* Filter */}
            <div className="flex gap-2 mb-4">
              <Button
                variant={filter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("all")}
              >
                All
              </Button>
              <Button
                variant={filter === "unread" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("unread")}
              >
                Unread
                {data?.unreadCount ? (
                  <Badge variant="secondary" className="ml-2">
                    {data.unreadCount}
                  </Badge>
                ) : null}
              </Button>
            </div>

            {/* Notification List */}
            {!data?.notifications || data.notifications.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center text-muted-foreground">
                  <Bell className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">No notifications</p>
                  <p className="text-sm">
                    {filter === "unread"
                      ? "You're all caught up!"
                      : "Notifications will appear here"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {data.notifications.map((n) => {
                  const Icon = typeIcons[n.type] || Info;
                  const colorClass =
                    typeColors[n.type] || "bg-muted text-muted-foreground";
                  return (
                    <Card
                      key={n.id}
                      className={`transition-all ${
                        !n.read
                          ? "border-primary/30 bg-primary/5"
                          : "opacity-75"
                      }`}
                    >
                      <CardContent className="py-4">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${colorClass}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">
                                {n.title}
                              </span>
                              {!n.read && (
                                <Badge
                                  variant="default"
                                  className="text-[10px] px-1.5 py-0"
                                >
                                  New
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {n.message}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(n.createdAt).toLocaleString()}
                            </p>
                          </div>
                          {!n.read && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="shrink-0"
                              onClick={() => markRead.mutate({ id: n.id })}
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Preferences Tab */}
          <TabsContent value="preferences">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>
                  Choose which notifications you want to receive
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {preferences?.map((pref) => {
                  const Icon = typeIcons[pref.type] || Info;
                  const labels: Record<string, { title: string; desc: string }> = {
                    collaboration: {
                      title: "Collaboration",
                      desc: "When someone edits your shared project or joins via invite link",
                    },
                    generation: {
                      title: "Generation Complete",
                      desc: "When long-running generation jobs finish processing",
                    },
                    comment: {
                      title: "Comments",
                      desc: "When someone comments on your gallery items",
                    },
                    system: {
                      title: "System",
                      desc: "Platform announcements and important updates",
                    },
                    payment: {
                      title: "Payments",
                      desc: "Credit purchase confirmations and low balance alerts",
                    },
                  };
                  const label = labels[pref.type] || {
                    title: pref.type,
                    desc: "",
                  };
                  return (
                    <div
                      key={pref.type}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{label.title}</div>
                          <div className="text-sm text-muted-foreground">
                            {label.desc}
                          </div>
                        </div>
                      </div>
                      <Switch
                        checked={pref.enabled}
                        onCheckedChange={(enabled) =>
                          updatePref.mutate({
                            type: pref.type as any,
                            enabled,
                          })
                        }
                      />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
