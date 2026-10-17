import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain } from "lucide-react";
import { Link } from "wouter";

export default function ModelTraining() {
  return (
    <PageLayout>
      <div className="container max-w-3xl py-12">
        <h1 className="text-3xl font-bold flex items-center gap-3"><Brain className="h-8 w-8 text-violet-400" /> Train Your Own Model</h1>
        <Card className="mt-8">
          <CardHeader><CardTitle>Custom training is unavailable</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">Custom model training is not available yet. You cannot upload training images or start a training job from this page.</p>
            <p className="text-sm text-muted-foreground">You can create images with the existing models in Workspace.</p>
            <Button asChild><Link href="/workspace">Open Workspace</Link></Button>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
