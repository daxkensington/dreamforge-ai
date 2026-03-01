import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Gallery from "./pages/Gallery";
import GalleryDetail from "./pages/GalleryDetail";
import Workspace from "./pages/Workspace";
import Moderation from "./pages/Moderation";
import Profile from "./pages/Profile";
import Tools from "./pages/Tools";
import ToolUpscaler from "./pages/ToolUpscaler";
import ToolStyleTransfer from "./pages/ToolStyleTransfer";
import ToolBackground from "./pages/ToolBackground";
import ToolPromptBuilder from "./pages/ToolPromptBuilder";
import BatchStudio from "./pages/BatchStudio";
import Pricing from "./pages/Pricing";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/gallery" component={Gallery} />
      <Route path="/gallery/:id" component={GalleryDetail} />
      <Route path="/workspace" component={Workspace} />
      <Route path="/tools" component={Tools} />
      <Route path="/tools/upscaler" component={ToolUpscaler} />
      <Route path="/tools/style-transfer" component={ToolStyleTransfer} />
      <Route path="/tools/background" component={ToolBackground} />
      <Route path="/tools/prompt-builder" component={ToolPromptBuilder} />
      <Route path="/batch" component={BatchStudio} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/moderation" component={Moderation} />
      <Route path="/profile" component={Profile} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
