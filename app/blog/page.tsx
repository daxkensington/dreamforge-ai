import type { Metadata } from "next";
import Link from "next/link";
import { BLOG_POSTS } from "../../shared/blogPosts";
import { BlogShell } from "./BlogShell";

export const metadata: Metadata = {
  title: "Blog — Guides and Comparisons | DreamForgeX",
  description:
    "Practical guides to AI image, video, and audio generation: model comparisons, full workflows, and honest assessments of what these tools can and cannot do.",
  alternates: { canonical: "https://dreamforgex.ai/blog" },
  openGraph: {
    title: "DreamForgeX Blog — AI Creative Guides",
    description:
      "Model comparisons and step-by-step workflows for AI image, video, and audio generation.",
    url: "https://dreamforgex.ai/blog",
    siteName: "DreamForgeX",
    type: "website",
  },
};

const formatDate = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

export default function BlogIndexPage() {
  const posts = [...BLOG_POSTS].sort((a, b) => b.published.localeCompare(a.published));

  const listSchema = {
    "@context": "https://schema.org",
    "@type": "Blog",
    "@id": "https://dreamforgex.ai/blog#blog",
    name: "DreamForgeX Blog",
    url: "https://dreamforgex.ai/blog",
    description: metadata.description,
    blogPost: posts.map((p) => ({
      "@type": "BlogPosting",
      headline: p.title,
      url: `https://dreamforgex.ai/blog/${p.slug}`,
      datePublished: p.published,
      description: p.description,
    })),
  };

  return (
    <BlogShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(listSchema) }}
      />
      <section className="pt-24 pb-16 md:pt-32">
        <div className="max-w-4xl mx-auto px-6">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Guides &amp; comparisons</h1>
          <p className="text-lg text-foreground/70 mb-12 max-w-2xl">
            Workflows and model comparisons for AI image, video, and audio generation —
            including where these tools fall short.
          </p>

          <div className="space-y-6">
            {posts.map((post) => (
              <article
                key={post.slug}
                className="rounded-2xl border border-border/40 bg-card/30 p-6 md:p-8 transition-colors hover:border-primary/40"
              >
                <div className="flex flex-wrap items-center gap-3 text-xs text-foreground/50 mb-3">
                  <time dateTime={post.published}>{formatDate(post.published)}</time>
                  <span aria-hidden="true">·</span>
                  <span>{post.readingMinutes} min read</span>
                </div>
                <h2 className="text-2xl font-semibold mb-3">
                  <Link href={`/blog/${post.slug}`} className="hover:text-primary transition-colors">
                    {post.title}
                  </Link>
                </h2>
                <p className="text-foreground/75 leading-relaxed mb-4">{post.excerpt}</p>
                <div className="flex flex-wrap gap-2">
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs px-2.5 py-1 rounded-full border border-border/40 text-foreground/60"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </BlogShell>
  );
}
