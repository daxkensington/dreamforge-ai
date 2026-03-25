import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Code, Key, Zap, Shield } from "lucide-react";
import { Link } from "wouter";

const endpoints = [
  {
    method: "POST",
    path: "/api/v1/generate",
    description: "Generate an image from a text prompt",
    auth: true,
    body: `{
  "prompt": "A serene mountain landscape at sunset",
  "width": 1024,
  "height": 1024,
  "model": "default"
}`,
    response: `{
  "id": 123,
  "url": "https://cdn.example.com/generated/abc.png",
  "prompt": "A serene mountain landscape at sunset",
  "status": "completed"
}`,
  },
  {
    method: "POST",
    path: "/api/v1/tools/upscale",
    description: "Upscale an image to higher resolution",
    auth: true,
    body: `{
  "imageUrl": "https://example.com/image.png",
  "scale": 2
}`,
    response: `{
  "url": "https://cdn.example.com/upscaled/abc.png",
  "originalSize": { "width": 512, "height": 512 },
  "newSize": { "width": 1024, "height": 1024 }
}`,
  },
  {
    method: "POST",
    path: "/api/v1/tools/style-transfer",
    description: "Apply an artistic style to an image",
    auth: true,
    body: `{
  "imageUrl": "https://example.com/image.png",
  "style": "watercolor"
}`,
    response: `{
  "url": "https://cdn.example.com/styled/abc.png",
  "style": "watercolor"
}`,
  },
  {
    method: "POST",
    path: "/api/v1/tools/background-remove",
    description: "Remove or replace image background",
    auth: true,
    body: `{
  "imageUrl": "https://example.com/image.png",
  "replacement": "A tropical beach at sunset"
}`,
    response: `{
  "url": "https://cdn.example.com/bg-removed/abc.png"
}`,
  },
  {
    method: "POST",
    path: "/api/v1/prompt/improve",
    description: "Improve a prompt using AI",
    auth: true,
    body: `{
  "prompt": "a cat",
  "style": "cinematic",
  "mood": "dramatic"
}`,
    response: `{
  "improved": "A majestic cat with piercing amber eyes, cinematic lighting...",
  "suggestions": ["Add specific breed details", "Specify background"]
}`,
  },
  {
    method: "GET",
    path: "/api/v1/models",
    description: "List available generation models",
    auth: false,
    body: null,
    response: `[
  { "id": "default", "name": "DreamForge Standard", "speed": "fast", "quality": "high" },
  { "id": "hd", "name": "DreamForge HD", "speed": "slow", "quality": "ultra" }
]`,
  },
];

export default function ApiDocs() {
  return (
    <div>
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/15 via-transparent to-purple-900/10" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-cyan-500/5 rounded-full blur-[120px]" />
        <div className="container max-w-5xl relative py-12 md:py-16">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-4 gap-1.5 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </Button>
          </Link>
          <div className="flex items-center gap-3 mb-3">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <Code className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold">
                API{" "}
                <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
                  Documentation
                </span>
              </h1>
            </div>
          </div>
          <p className="text-muted-foreground max-w-lg">
            Integrate DreamForge's 53+ AI tools into your applications with our REST API. Generate images, videos, and more programmatically.
          </p>
          <div className="flex items-center gap-4 mt-6 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
              <Zap className="h-3 w-3 text-cyan-400" /> REST API
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
              <Key className="h-3 w-3 text-cyan-400" /> Bearer Auth
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
              <Shield className="h-3 w-3 text-cyan-400" /> Rate Limited
            </span>
          </div>
        </div>
      </div>

      <div className="container py-8 max-w-5xl mx-auto">

      {/* Quick Start */}
      <Card className="mb-8 border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Zap className="w-5 h-5" /> Quick Start</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">1. Get your API key from <Link href="/api-keys" className="text-primary underline">API Keys</Link></p>
            <p className="text-sm font-medium">2. Make your first request:</p>
          </div>
          <div className="bg-background rounded-lg p-4 font-mono text-sm overflow-x-auto">
            <pre className="text-xs">{`curl -X POST https://your-app.manus.space/api/v1/generate \\
  -H "Authorization: Bearer df_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"prompt": "A beautiful sunset over mountains"}'`}</pre>
          </div>
        </CardContent>
      </Card>

      {/* Auth */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5" /> Authentication</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">All authenticated endpoints require a Bearer token in the Authorization header:</p>
          <div className="bg-muted rounded-lg p-3 font-mono text-sm">
            Authorization: Bearer df_your_api_key_here
          </div>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant="default">Rate Limit</Badge>
              <span className="text-muted-foreground">100 requests/hour (default)</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">Format</Badge>
              <span className="text-muted-foreground">JSON request/response</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Endpoints */}
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><Code className="w-6 h-6" /> Endpoints</h2>
      <div className="space-y-4">
        {endpoints.map((ep, i) => (
          <Card key={i}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <Badge variant={ep.method === "GET" ? "secondary" : "default"} className="font-mono">
                  {ep.method}
                </Badge>
                <code className="text-sm font-mono">{ep.path}</code>
                {ep.auth && <Badge variant="outline" className="text-xs"><Key className="w-3 h-3 mr-1" /> Auth</Badge>}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{ep.description}</p>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="request">
                <TabsList className="mb-3">
                  {ep.body && <TabsTrigger value="request">Request</TabsTrigger>}
                  <TabsTrigger value="response">Response</TabsTrigger>
                </TabsList>
                {ep.body && (
                  <TabsContent value="request">
                    <div className="bg-muted rounded-lg p-4 font-mono text-xs overflow-x-auto">
                      <pre>{ep.body}</pre>
                    </div>
                  </TabsContent>
                )}
                <TabsContent value="response">
                  <div className="bg-muted rounded-lg p-4 font-mono text-xs overflow-x-auto">
                    <pre>{ep.response}</pre>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* SDKs */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>SDK & Libraries</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg border">
              <h3 className="font-semibold mb-1">JavaScript / TypeScript</h3>
              <code className="text-xs bg-muted px-2 py-1 rounded">npm install dreamforge-sdk</code>
              <Badge variant="outline" className="mt-2 text-xs">Coming Soon</Badge>
            </div>
            <div className="p-4 rounded-lg border">
              <h3 className="font-semibold mb-1">Python</h3>
              <code className="text-xs bg-muted px-2 py-1 rounded">pip install dreamforge</code>
              <Badge variant="outline" className="mt-2 text-xs">Coming Soon</Badge>
            </div>
            <div className="p-4 rounded-lg border">
              <h3 className="font-semibold mb-1">REST API</h3>
              <p className="text-xs text-muted-foreground">Use any HTTP client</p>
              <Badge variant="default" className="mt-2 text-xs">Available Now</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
    </div>
  );
}
