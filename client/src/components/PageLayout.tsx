import Navbar from "./Navbar";
import Footer from "./Footer";
import { ChevronUp } from "lucide-react";
import { useState, useEffect } from "react";

function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 500);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <button
      onClick={scrollToTop}
      aria-label="Back to top"
      className={`fixed bottom-24 right-6 z-50 h-12 w-12 rounded-full bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-center shadow-lg hover:bg-white/20 transition-all duration-300 ${
        visible
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 translate-y-4 pointer-events-none"
      }`}
    >
      <ChevronUp className="h-5 w-5 text-white/80" />
    </button>
  );
}

export default function PageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen flex flex-col bg-background selection:bg-cyan-500/30 selection:text-cyan-100">
      {/* Global ambient lighting & subtle architectural grid across all pages */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-32 left-1/4 h-[480px] w-[480px] rounded-full bg-cyan-500/[0.07] blur-[140px]" />
        <div className="absolute top-1/4 -right-24 h-[520px] w-[520px] rounded-full bg-purple-600/[0.07] blur-[150px]" />
        <div className="absolute -bottom-32 left-1/3 h-[460px] w-[560px] rounded-full bg-rose-500/[0.05] blur-[160px]" />
        <div
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>
      <Navbar />
      <main className="relative z-10 flex-1">{children}</main>
      <Footer />
      <ScrollToTopButton />
    </div>
  );
}
