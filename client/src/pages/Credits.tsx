import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Coins,
  CreditCard,
  Sparkles,
  Zap,
  Building2,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle,
  Star,
  TrendingUp,
} from "lucide-react";

export default function Credits() {
  const { user, isLoading: authLoading } = useAuth() as any;
  const [purchasingId, setPurchasingId] = useState<string | null>(null);

  const { data: balance } = trpc.credits.getBalance.useQuery(undefined, {
    enabled: !!user,
  });
  const { data: packages } = trpc.credits.getPackages.useQuery();
  const { data: costs } = trpc.credits.getCosts.useQuery();
  const { data: history } = trpc.credits.getHistory.useQuery(undefined, {
    enabled: !!user,
  });

  const checkout = trpc.credits.createCheckout.useMutation({
    onSuccess: (data) => {
      if (data.url) {
      toast.success("Redirecting to Stripe checkout...");
        window.open(data.url, "_blank");
      }
      setPurchasingId(null);
    },
    onError: (err) => {
      toast.error(err.message || "Checkout failed");
      setPurchasingId(null);
    },
  });

  const handlePurchase = (packageId: string) => {
    if (!user) return;
    setPurchasingId(packageId);
    checkout.mutate({
      packageId,
      origin: window.location.origin,
    });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader className="text-center">
            <Coins className="w-12 h-12 mx-auto text-primary mb-2" />
            <CardTitle>Sign in to manage credits</CardTitle>
            <CardDescription>
              Purchase generation credits to use DreamForge tools
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button asChild>
              <a href={getLoginUrl()}>Sign In</a>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const packageIcons = [Zap, Star, Sparkles, Building2];

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-6xl py-12">
        {/* Balance Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 rounded-xl bg-primary/10">
              <Coins className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Credits</h1>
              <p className="text-muted-foreground">
                Purchase and manage your generation credits
              </p>
            </div>
          </div>

          {balance && (
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground mb-1">
                    Available Balance
                  </div>
                  <div className="text-4xl font-bold text-primary">
                    {balance.balance}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    credits
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground mb-1">
                    Lifetime Used
                  </div>
                  <div className="text-4xl font-bold">
                    {balance.lifetimeSpent}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    credits spent
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground mb-1">
                    Estimated Remaining
                  </div>
                  <div className="text-4xl font-bold">
                    ~{balance.balance}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    image generations
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        <Tabs defaultValue="packages" className="space-y-6">
          <TabsList>
            <TabsTrigger value="packages">
              <CreditCard className="w-4 h-4 mr-2" />
              Buy Credits
            </TabsTrigger>
            <TabsTrigger value="history">
              <Clock className="w-4 h-4 mr-2" />
              Transaction History
            </TabsTrigger>
            <TabsTrigger value="pricing">
              <TrendingUp className="w-4 h-4 mr-2" />
              Credit Costs
            </TabsTrigger>
          </TabsList>

          {/* Packages Tab */}
          <TabsContent value="packages">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {packages?.map((pkg, i) => {
                const Icon = packageIcons[i] || Zap;
                return (
                  <Card
                    key={pkg.id}
                    className={`relative overflow-hidden transition-all hover:shadow-lg ${
                      pkg.popular
                        ? "border-primary shadow-primary/10 shadow-md"
                        : ""
                    }`}
                  >
                    {pkg.popular && (
                      <div className="absolute top-0 right-0">
                        <Badge className="rounded-none rounded-bl-lg bg-primary text-primary-foreground">
                          Most Popular
                        </Badge>
                      </div>
                    )}
                    <CardHeader>
                      <div className="p-2 w-fit rounded-lg bg-primary/10 mb-2">
                        <Icon className="w-6 h-6 text-primary" />
                      </div>
                      <CardTitle className="text-xl">{pkg.name}</CardTitle>
                      <CardDescription>{pkg.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="mb-4">
                        <span className="text-4xl font-bold">
                          {pkg.priceDisplay}
                        </span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span>
                            <strong>{pkg.credits}</strong> credits
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span>{pkg.perCredit} per credit</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span>Never expires</span>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button
                        className="w-full"
                        variant={pkg.popular ? "default" : "outline"}
                        onClick={() => handlePurchase(pkg.id)}
                        disabled={purchasingId === pkg.id}
                      >
                        {purchasingId === pkg.id ? (
                          "Processing..."
                        ) : (
                          <>
                            Buy Now
                            <ArrowUpRight className="w-4 h-4 ml-1" />
                          </>
                        )}
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>

            <p className="text-xs text-muted-foreground text-center mt-6">
              Payments are processed securely via Stripe. Test with card number
              4242 4242 4242 4242.
            </p>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Transaction History</CardTitle>
                <CardDescription>
                  Your credit purchases and usage
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!history || history.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No transactions yet</p>
                    <p className="text-sm">
                      Purchase credits to start generating
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {history.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`p-2 rounded-lg ${
                              tx.amount > 0
                                ? "bg-green-500/10"
                                : "bg-orange-500/10"
                            }`}
                          >
                            {tx.amount > 0 ? (
                              <ArrowUpRight className="w-4 h-4 text-green-500" />
                            ) : (
                              <ArrowDownRight className="w-4 h-4 text-orange-500" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-sm">
                              {tx.description}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(tx.createdAt).toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <div
                          className={`font-bold ${
                            tx.amount > 0 ? "text-green-500" : "text-orange-500"
                          }`}
                        >
                          {tx.amount > 0 ? "+" : ""}
                          {tx.amount}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pricing Tab */}
          <TabsContent value="pricing">
            <Card>
              <CardHeader>
                <CardTitle>Credit Costs per Tool</CardTitle>
                <CardDescription>
                  How many credits each tool uses per generation
                </CardDescription>
              </CardHeader>
              <CardContent>
                {costs && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {Object.entries(costs).map(([tool, cost]) => (
                      <div
                        key={tool}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <span className="text-sm capitalize">
                          {tool.replace(/-/g, " ")}
                        </span>
                        <Badge variant={cost === 0 ? "secondary" : "default"}>
                          {cost === 0 ? "Free" : `${cost} credit${cost > 1 ? "s" : ""}`}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
