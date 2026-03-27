import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden">
      {/* Background showcase image */}
      <div className="absolute inset-0">
        <img
          src="/showcase/hero-forge.jpg"
          alt="DreamForgeX background"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-4">
        <h1 className="text-[10rem] md:text-[14rem] font-extrabold leading-none tracking-tighter gradient-text select-none">
          404
        </h1>

        <p className="text-xl md:text-2xl font-medium text-white/80 -mt-4 mb-8">
          Page not found
        </p>

        <Button
          onClick={() => setLocation("/")}
          size="lg"
          className="font-medium px-8"
        >
          <Home className="w-4 h-4 mr-2" />
          Go Home
        </Button>
      </div>
    </div>
  );
}
