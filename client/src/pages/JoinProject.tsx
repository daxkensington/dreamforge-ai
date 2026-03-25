import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Loader2,
  Users,
  Check,
  AlertTriangle,
  ArrowRight,
  LogIn,
} from "lucide-react";

export default function JoinProject() {
  const params = useParams<{ token: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [joined, setJoined] = useState(false);

  const acceptLink = trpc.videoProject.acceptShareLink.useMutation({
    onSuccess: (data) => {
      setJoined(true);
      if (data.alreadyOwner) {
        toast.info("You already own this project");
      } else {
        toast.success(`Joined as ${data.role}!`);
      }
      // Navigate to the project after a short delay
      setTimeout(() => {
        navigate(`/video-studio/project/${data.projectId}`);
      }, 1500);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to join project");
    },
  });

  useEffect(() => {
    if (user && params.token && !joined && !acceptLink.isPending && !acceptLink.isError) {
      acceptLink.mutate({ token: params.token });
    }
  }, [user, params.token]);

  if (!user) {
    return (
      <PageLayout>
        <div className="container max-w-md py-20 text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center mx-auto mb-6">
            <Users className="w-10 h-10 text-violet-400" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">
            You've Been Invited
          </h1>
          <p className="text-muted-foreground mb-6">
            Sign in to join this video project and start collaborating.
          </p>
          <Button
            asChild
            className="bg-gradient-to-r from-violet-600 to-purple-600"
          >
            <a href={getLoginUrl()}>
              <LogIn className="w-4 h-4 mr-2" /> Sign In to Join
            </a>
          </Button>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="container max-w-md py-20 text-center">
        {acceptLink.isPending && (
          <>
            <Loader2 className="w-12 h-12 animate-spin text-violet-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-foreground mb-2">
              Joining Project...
            </h1>
            <p className="text-sm text-muted-foreground">
              Setting up your access
            </p>
          </>
        )}

        {joined && (
          <>
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-emerald-400" />
            </div>
            <h1 className="text-xl font-bold text-foreground mb-2">
              Successfully Joined!
            </h1>
            <p className="text-sm text-muted-foreground mb-4">
              Redirecting you to the project...
            </p>
            <Loader2 className="w-5 h-5 animate-spin text-violet-500 mx-auto" />
          </>
        )}

        {acceptLink.isError && (
          <>
            <AlertTriangle className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-foreground mb-2">
              Unable to Join
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              {acceptLink.error?.message ||
                "This invite link may be expired or invalid."}
            </p>
            <Button
              variant="outline"
              onClick={() => navigate("/video-studio")}
            >
              Go to Video Studio <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </>
        )}
      </div>
    </PageLayout>
  );
}
