import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BLOG_POSTS, getBlogPost } from "../../../shared/blogPosts";
import { BlogShell } from "../BlogShell";

/**
 * Static params for every post. Combined with dynamicParams = false, an unknown
 * slug is a real 404 rather than a 200 shell — the soft-404 trap that a
 * loading.tsx on a dynamic route creates. Do not add a loading.tsx here.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return { title: "Not found | DreamForgeX" };

  const url = `https://dreamforgex.ai/blog/${post.slug}`;
  return {
    title: post.metaTitle,
    description: post.description,
    alternates: { canonical: url },
    openGraph: {
      title: post.metaTitle,
      description: post.description,
      url,
      siteName: "DreamForgeX",
      type: "article",
      publishedTime: post.published,
      modifiedTime: post.updated ?? post.published,
      tags: post.tags,
    },
  };
}

const formatDate = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  const url = `https://dreamforgex.ai/blog/${post.slug}`;

  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        "@id": `${url}#article`,
        headline: post.title,
        description: post.description,
        datePublished: post.published,
        dateModified: post.updated ?? post.published,
        author: { "@type": "Organization", name: "DreamForgeX", url: "https://dreamforgex.ai" },
        publisher: {
          "@type": "Organization",
          name: "DreamForgeX",
          url: "https://dreamforgex.ai",
        },
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
        keywords: post.tags.join(", "),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://dreamforgex.ai" },
          { "@type": "ListItem", position: 2, name: "Blog", item: "https://dreamforgex.ai/blog" },
          { "@type": "ListItem", position: 3, name: post.title, item: url },
        ],
      },
      ...(post.faq.length
        ? [
            {
              "@type": "FAQPage",
              "@id": `${url}#faq`,
              mainEntity: post.faq.map((f) => ({
                "@type": "Question",
                name: f.q,
                acceptedAnswer: { "@type": "Answer", text: f.a },
              })),
            },
          ]
        : []),
    ],
  };

  return (
    <BlogShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <article className="pt-24 pb-20 md:pt-32">
        <div className="max-w-3xl mx-auto px-6">
          <nav aria-label="Breadcrumb" className="mb-8 text-sm text-foreground/50">
            <Link href="/blog" className="hover:text-foreground transition-colors">
              Blog
            </Link>
          </nav>

          <header className="mb-10">
            <h1 className="text-3xl md:text-5xl font-bold leading-tight mb-5">{post.title}</h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-foreground/50">
              <time dateTime={post.published}>{formatDate(post.published)}</time>
              <span aria-hidden="true">·</span>
              <span>{post.readingMinutes} min read</span>
            </div>
          </header>

          <div className="space-y-5 mb-12">
            {post.intro.map((p, i) => (
              <p key={i} className="text-lg leading-relaxed text-foreground/85">
                {p}
              </p>
            ))}
          </div>

          <div className="space-y-12">
            {post.sections.map((section, i) => (
              <section key={i}>
                <h2 className="text-2xl md:text-3xl font-bold mb-5">{section.heading}</h2>

                {section.paragraphs?.map((p, j) => (
                  <p key={j} className="mb-4 leading-relaxed text-foreground/80">
                    {p}
                  </p>
                ))}

                {section.bullets && (
                  <ul className="space-y-3 my-5">
                    {section.bullets.map((b, j) => (
                      <li key={j} className="flex gap-3">
                        <span className="size-1.5 mt-2.5 rounded-full bg-primary flex-shrink-0" />
                        <span className="leading-relaxed text-foreground/80">{b}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {section.table && (
                  <div className="my-6 overflow-x-auto rounded-xl border border-border/40">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/40 bg-card/40">
                          {section.table.headers.map((h, j) => (
                            <th key={j} className="px-4 py-3 text-left font-semibold">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {section.table.rows.map((row, j) => (
                          <tr key={j} className="border-b border-border/20 last:border-0">
                            {row.map((cell, k) => (
                              <td key={k} className="px-4 py-3 text-foreground/80">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            ))}
          </div>

          {post.faq.length > 0 && (
            <section className="mt-16">
              <h2 className="text-2xl md:text-3xl font-bold mb-6">Frequently asked questions</h2>
              <div className="space-y-4">
                {post.faq.map((item, i) => (
                  <div key={i} className="rounded-xl border border-border/30 bg-card/30 p-5">
                    <h3 className="font-medium mb-2">{item.q}</h3>
                    <p className="text-sm leading-relaxed text-foreground/75">{item.a}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {post.relatedTools.length > 0 && (
            <section className="mt-16 pt-8 border-t border-border/30">
              <h2 className="text-lg font-semibold mb-4">Try it</h2>
              <div className="flex flex-wrap gap-3">
                {post.relatedTools.map((tool) => (
                  <Link
                    key={tool.href}
                    href={tool.href}
                    className="px-4 py-2 rounded-lg border border-border/50 bg-card/40 text-sm hover:border-primary/50 hover:text-primary transition-colors"
                  >
                    {tool.label}
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </article>
    </BlogShell>
  );
}
