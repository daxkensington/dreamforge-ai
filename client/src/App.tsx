// @ts-nocheck — Dead code: routing now handled by Next.js App Router
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
import ToolColorPalette from "./pages/ToolColorPalette";
import ToolVariations from "./pages/ToolVariations";
import ToolInpainting from "./pages/ToolInpainting";
import ToolFaceEnhancer from "./pages/ToolFaceEnhancer";
import ToolImageToPrompt from "./pages/ToolImageToPrompt";
import ToolOutpainting from "./pages/ToolOutpainting";
import ToolObjectEraser from "./pages/ToolObjectEraser";
import ToolTextEffects from "./pages/ToolTextEffects";
import ToolImageBlender from "./pages/ToolImageBlender";
import ToolSketchToImage from "./pages/ToolSketchToImage";
import ToolColorGrading from "./pages/ToolColorGrading";
import BatchStudio from "./pages/BatchStudio";
import Pricing from "./pages/Pricing";
import VideoStudio from "./pages/VideoStudio";
import ToolStoryboard from "./pages/ToolStoryboard";
import ToolSceneDirector from "./pages/ToolSceneDirector";
import ToolVideoStyleTransfer from "./pages/ToolVideoStyleTransfer";
import ToolVideoUpscaler from "./pages/ToolVideoUpscaler";
import ToolSoundtrackSuggester from "./pages/ToolSoundtrackSuggester";
import ToolTextToVideoScript from "./pages/ToolTextToVideoScript";
import ProjectDetail from "./pages/ProjectDetail";
import JoinProject from "./pages/JoinProject";
import Characters from "./pages/Characters";
import BrandKits from "./pages/BrandKits";
import ApiKeys from "./pages/ApiKeys";
import SearchGenerations from "./pages/SearchGenerations";
import ModelComparison from "./pages/ModelComparison";
import ApiDocs from "./pages/ApiDocs";
import Credits from "./pages/Credits";
import Notifications from "./pages/Notifications";
import AdminDashboard from "./pages/AdminDashboard";
import TimelineEditor from "./pages/TimelineEditor";
import KeyboardShortcutsModal from "./components/KeyboardShortcutsModal";

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
      <Route path="/tools/color-palette" component={ToolColorPalette} />
      <Route path="/tools/variations" component={ToolVariations} />
      <Route path="/tools/inpainting" component={ToolInpainting} />
      <Route path="/tools/face-enhancer" component={ToolFaceEnhancer} />
      <Route path="/tools/image-to-prompt" component={ToolImageToPrompt} />
      <Route path="/tools/outpainting" component={ToolOutpainting} />
      <Route path="/tools/object-eraser" component={ToolObjectEraser} />
      <Route path="/tools/text-effects" component={ToolTextEffects} />
      <Route path="/tools/image-blender" component={ToolImageBlender} />
      <Route path="/tools/sketch-to-image" component={ToolSketchToImage} />
      <Route path="/tools/color-grading" component={ToolColorGrading} />
      <Route path="/batch" component={BatchStudio} />
      <Route path="/video-studio" component={VideoStudio} />
      <Route path="/video-studio/storyboard" component={ToolStoryboard} />
      <Route path="/video-studio/scene-director" component={ToolSceneDirector} />
      <Route path="/video-studio/style-transfer" component={ToolVideoStyleTransfer} />
      <Route path="/video-studio/upscaler" component={ToolVideoUpscaler} />
      <Route path="/video-studio/soundtrack" component={ToolSoundtrackSuggester} />
      <Route path="/video-studio/script" component={ToolTextToVideoScript} />
      <Route path="/video-studio/project/:id" component={ProjectDetail} />
      <Route path="/video-studio/join/:token" component={JoinProject} />
      <Route path="/timeline/:projectId" component={TimelineEditor} />
      <Route path="/characters" component={Characters} />
      <Route path="/brand-kits" component={BrandKits} />
      <Route path="/api-keys" component={ApiKeys} />
      <Route path="/api-docs" component={ApiDocs} />
      <Route path="/search" component={SearchGenerations} />
      <Route path="/models" component={ModelComparison} />
      <Route path="/credits" component={Credits} />
      <Route path="/notifications" component={Notifications} />
      <Route path="/admin" component={AdminDashboard} />
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
          <KeyboardShortcutsModal />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
