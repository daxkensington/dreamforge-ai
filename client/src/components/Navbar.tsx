import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Wand2,
  Menu,
  X,
  Sparkles,
  Image,
  Shield,
  User,
  LogOut,
  Wrench,
  Layers,
  CreditCard,
  Film,
  Users,
  Search,
  Palette,
  Key,
  Bell,
  Coins,
  BarChart3,
  ShoppingBag,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const navLinks = [
  { href: "/tools", label: "AI Tools", icon: Wrench },
  { href: "/video-studio", label: "Video Studio", icon: Film, auth: true },
  { href: "/gallery", label: "Gallery", icon: Image },
  { href: "/marketplace", label: "Marketplace", icon: ShoppingBag },
  { href: "/workspace", label: "Studio", icon: Sparkles, auth: true },
  { href: "/pricing", label: "Pricing", icon: CreditCard },
];

const dropdownOnlyLinks = [
  { href: "/batch", label: "Batch Studio", icon: Layers, auth: true },
  { href: "/characters", label: "Characters", icon: Users, auth: true },
];

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const welcomeShown = useRef(false);

  // Scroll-aware navbar background
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    handleScroll(); // check initial state
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Fetch credit balance for authenticated users
  const { data: balanceData } = trpc.credits.getBalance.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 30000, // refresh every 30s
  });

  // Fetch unread notification count
  const { data: notifData } = trpc.notifications.list.useQuery(
    { unreadOnly: true, limit: 1 },
    {
      enabled: isAuthenticated,
      refetchInterval: 15000, // refresh every 15s
    }
  );

  const unreadCount = notifData?.unreadCount || 0;
  const creditBalance = balanceData?.balance ?? null;

  // Low credit warning state
  const lowCreditWarned = useRef(false);

  // Auto-apply referral code mutation
  const autoApplyReferral = trpc.autoReferral.autoApply.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Referral Bonus Applied!", {
          description: data.message,
          duration: 8000,
        });
        if (data.tierAwarded) {
          toast.success(`${data.tierAwarded.name} Tier Unlocked!`, {
            description: `Your referrer earned ${data.tierAwarded.bonus} bonus credits!`,
            duration: 6000,
          });
        }
      }
      sessionStorage.removeItem("dreamforge_referral");
    },
    onError: () => {
      sessionStorage.removeItem("dreamforge_referral");
    },
  });

  // Capture ?ref=CODE from URL and store in sessionStorage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) {
      sessionStorage.setItem("dreamforge_referral", ref);
      // Clean URL but keep other params
      params.delete("ref");
      const newUrl = params.toString() ? `${window.location.pathname}?${params}` : window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
  }, []);

  // Show welcome toast for new users + auto-apply referral
  const referralApplied = useRef(false);
  useEffect(() => {
    if (welcomeShown.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("welcome") === "true" && isAuthenticated) {
      welcomeShown.current = true;
      toast.success("Welcome to DreamForgeX!", {
        description: "You've received 50 free credits to start creating. Explore our AI tools and bring your ideas to life!",
        duration: 8000,
      });
      // Clean URL
      window.history.replaceState({}, "", "/");

      // Auto-apply referral code if stored
      const storedRef = sessionStorage.getItem("dreamforge_referral");
      if (storedRef && !referralApplied.current) {
        referralApplied.current = true;
        autoApplyReferral.mutate({ code: storedRef });
      }
    }
  }, [isAuthenticated]);

  // Also try to apply referral for returning users who had a ref link
  useEffect(() => {
    if (referralApplied.current) return;
    const storedRef = sessionStorage.getItem("dreamforge_referral");
    if (storedRef && isAuthenticated) {
      referralApplied.current = true;
      autoApplyReferral.mutate({ code: storedRef });
    }
  }, [isAuthenticated]);

  // Low credit warning toast
  useEffect(() => {
    if (lowCreditWarned.current) return;
    if (creditBalance !== null && creditBalance > 0 && creditBalance < 10) {
      lowCreditWarned.current = true;
      toast.warning("Low Credit Balance", {
        description: `You have ${creditBalance} credits remaining. Purchase more to keep creating.`,
        duration: 10000,
        action: {
          label: "Buy Credits",
          onClick: () => (window.location.href = "/credits"),
        },
      });
    }
  }, [creditBalance]);

  const isToolsActive = location.startsWith("/tools");
  const isVideoStudioActive = location.startsWith("/video-studio");
  const isBatchActive = location === "/batch";
  const isCharactersActive = location === "/characters";

  return (
    <header className={`sticky top-0 z-50 w-full border-b transition-all duration-300 ${scrolled ? "bg-black/80 backdrop-blur-xl border-white/5" : "bg-transparent border-transparent"}`}>
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <img src="/logo.png" alt="DreamForgeX" className="h-9 w-9 rounded-lg shadow-lg shadow-cyan-500/20 group-hover:shadow-cyan-500/30 transition-all" />
          <span className="text-sm font-bold tracking-tight bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
            DreamForgeX
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => {
            if (link.auth && !isAuthenticated) return null;
            const isActive =
              link.href === "/tools"
                ? isToolsActive
                : link.href === "/video-studio"
                ? isVideoStudioActive
                : location === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-cyan-500/10 text-cyan-400 border-b-2 border-cyan-500"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}

          {/* Credit Balance Pill */}
          {isAuthenticated && creditBalance !== null && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href="/credits"
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-all ${
                      creditBalance <= 10
                        ? "bg-destructive/10 text-destructive border border-destructive/20 animate-pulse"
                        : creditBalance <= 30
                        ? "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20"
                        : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    }`}
                  >
                    <Coins className="h-3.5 w-3.5" />
                    {creditBalance.toLocaleString()}
                  </Link>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {creditBalance} credits remaining
                    {creditBalance <= 10 && " — Running low! Buy more credits."}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Notification Bell with Badge */}
          {isAuthenticated && (
            <Link
              href="/notifications"
              className={`relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                location === "/notifications"
                  ? "bg-cyan-500/10 text-cyan-400 border-b-2 border-cyan-500"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 text-[10px] font-bold flex items-center justify-center rounded-full"
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </Badge>
              )}
            </Link>
          )}

          {/* Admin Link */}
          {isAuthenticated && user?.role === "admin" && (
            <Link
              href="/admin"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                location === "/admin"
                  ? "bg-cyan-500/10 text-cyan-400 border-b-2 border-cyan-500"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              Admin
            </Link>
          )}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full p-1 hover:bg-accent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-8 w-8 border border-border">
                    <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
                      {user?.name?.charAt(0)?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <div className="px-3 py-2">
                  <p className="text-sm font-medium truncate">{user?.name || "Creator"}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email || ""}</p>
                  {creditBalance !== null && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <Coins className="h-3 w-3 text-primary" />
                      <span className="text-xs font-semibold text-primary">
                        {creditBalance.toLocaleString()} credits
                      </span>
                    </div>
                  )}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="flex items-center gap-2 cursor-pointer">
                    <User className="h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/workspace" className="flex items-center gap-2 cursor-pointer">
                    <Sparkles className="h-4 w-4" />
                    Studio
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/tools" className="flex items-center gap-2 cursor-pointer">
                    <Wrench className="h-4 w-4" />
                    AI Tools
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/batch" className="flex items-center gap-2 cursor-pointer">
                    <Layers className="h-4 w-4" />
                    Batch Studio
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/video-studio" className="flex items-center gap-2 cursor-pointer">
                    <Film className="h-4 w-4" />
                    Video Studio
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/characters" className="flex items-center gap-2 cursor-pointer">
                    <Users className="h-4 w-4" />
                    Characters
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/brand-kits" className="flex items-center gap-2 cursor-pointer">
                    <Palette className="h-4 w-4" />
                    Brand Kits
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/search" className="flex items-center gap-2 cursor-pointer">
                    <Search className="h-4 w-4" />
                    Search History
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/api-keys" className="flex items-center gap-2 cursor-pointer">
                    <Key className="h-4 w-4" />
                    API Keys
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/credits" className="flex items-center gap-2 cursor-pointer">
                    <Coins className="h-4 w-4" />
                    Credits & Billing
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/notifications" className="flex items-center gap-2 cursor-pointer">
                    <Bell className="h-4 w-4" />
                    Notifications
                    {unreadCount > 0 && (
                      <Badge variant="destructive" className="ml-auto h-5 min-w-5 px-1 text-[10px]">
                        {unreadCount}
                      </Badge>
                    )}
                  </Link>
                </DropdownMenuItem>
                {user?.role === "admin" && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin" className="flex items-center gap-2 cursor-pointer">
                      <BarChart3 className="h-4 w-4" />
                      Admin Dashboard
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="text-destructive focus:text-destructive cursor-pointer"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              onClick={() => (window.location.href = getLoginUrl())}
              size="sm"
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold rounded-full px-6 border-0 shadow-lg shadow-cyan-500/20"
            >
              Sign in
            </Button>
          )}

          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-accent transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/5 bg-black/95 backdrop-blur-xl">
          <nav className="container py-4 flex flex-col gap-1">
            {/* Mobile Credit Balance */}
            {isAuthenticated && creditBalance !== null && (
              <Link
                href="/credits"
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-between px-4 py-3 rounded-lg bg-cyan-500/5 border border-cyan-500/10 mb-2"
              >
                <div className="flex items-center gap-2">
                  <Coins className="h-4 w-4 text-cyan-400" />
                  <span className="text-sm font-semibold text-cyan-400">
                    {creditBalance.toLocaleString()} credits
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">Tap to manage</span>
              </Link>
            )}
            {[...navLinks, ...dropdownOnlyLinks].map((link) => {
              if (link.auth && !isAuthenticated) return null;
              const isActive =
                link.href === "/tools"
                  ? isToolsActive
                  : link.href === "/video-studio"
                  ? isVideoStudioActive
                  : link.href === "/batch"
                  ? isBatchActive
                  : link.href === "/characters"
                  ? isCharactersActive
                  : location === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-cyan-500/10 text-cyan-400 border-l-2 border-cyan-500"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  }`}
                >
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}
            {isAuthenticated && (
              <Link
                href="/notifications"
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  location === "/notifications"
                    ? "bg-cyan-500/10 text-cyan-400 border-l-2 border-cyan-500"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                }`}
              >
                <Bell className="h-4 w-4" />
                Notifications
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="ml-auto h-5 min-w-5 px-1 text-[10px]">
                    {unreadCount}
                  </Badge>
                )}
              </Link>
            )}
            {isAuthenticated && user?.role === "admin" && (
              <Link
                href="/admin"
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  location === "/admin"
                    ? "bg-cyan-500/10 text-cyan-400 border-l-2 border-cyan-500"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                }`}
              >
                <Shield className="h-4 w-4" />
                Admin
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
