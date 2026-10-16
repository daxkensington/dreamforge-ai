"use client";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import ToolPoseTurnaround from "@/pages/ToolPoseTurnaround";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface BoundaryProps {
  children: (resetKey: number) => ReactNode;
}

interface BoundaryState {
  error: Error | null;
  resetKey: number;
}

// Route-local boundary so a render failure in the turnaround tool shows an
// inline, recoverable fallback instead of taking down the whole page.
class PoseTurnaroundErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  constructor(props: BoundaryProps) {
    super(props);
    this.state = { error: null, resetKey: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<BoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[DreamForgeX Error]", error, info.componentStack);
  }

  handleRetry = () => {
    // Bumping the key remounts the tool with fresh state.
    this.setState((s) => ({ error: null, resetKey: s.resetKey + 1 }));
  };

  render() {
    if (this.state.error) {
      return (
        <div className="container py-12">
          <div className="max-w-xl mx-auto space-y-4">
            <Alert variant="destructive">
              <AlertTriangle />
              <AlertTitle>Pose Turnaround ran into a problem</AlertTitle>
              <AlertDescription>
                <p>Something went wrong while displaying this tool. Your credits were not affected by this error. Try again to reload the tool.</p>
              </AlertDescription>
            </Alert>
            <Button onClick={this.handleRetry}>
              <RotateCcw className="h-4 w-4" />
              Try again
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children(this.state.resetKey);
  }
}

export default function Page() {
  return (
    <PoseTurnaroundErrorBoundary>
      {(resetKey) => <ToolPoseTurnaround key={resetKey} />}
    </PoseTurnaroundErrorBoundary>
  );
}
