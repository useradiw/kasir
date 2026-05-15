import { requireAuth } from "@/lib/admin-auth";
import { Container } from "@/components/shared/container";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { readFile } from "fs/promises";
import path from "path";
import { BackToTop } from "../back-to-top";

export const metadata = { title: "Panduan COGS & Stok Bahan" };

export default async function CogsGuidePage() {
  const staff = await requireAuth();
  const isAdmin = staff.role === "OWNER" || staff.role === "MANAGER";

  const filePath = path.join(process.cwd(), "docs", "cogs-feature.md");
  const content = await readFile(filePath, "utf-8");

  return (
    <Container id="top" sectionStyle="min-h-screen" className="py-8 max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/petunjuk#admin-stok-bahan"
          className="text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          ← Petunjuk Penggunaan
        </Link>
        {!isAdmin && (
          <span className="text-xs text-muted-foreground italic">
            — halaman ini diperuntukkan untuk Admin
          </span>
        )}
      </div>

      <ReactMarkdown
        components={{
          h1({ children }) {
            return (
              <h1 className="text-2xl font-bold mb-2 mt-0">{children}</h1>
            );
          },
          h2({ children }) {
            return (
              <h2 className="text-lg font-semibold mt-10 mb-3 border-b border-border pb-2 scroll-mt-28">
                {children}
              </h2>
            );
          },
          h3({ children }) {
            return (
              <h3 className="text-base font-semibold mt-6 mb-2">{children}</h3>
            );
          },
          p({ children }) {
            return (
              <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
                {children}
              </p>
            );
          },
          ul({ children }) {
            return (
              <ul className="list-disc list-outside ml-5 space-y-1 text-sm text-muted-foreground mb-4">
                {children}
              </ul>
            );
          },
          ol({ children }) {
            return (
              <ol className="list-decimal list-outside ml-5 space-y-1.5 text-sm text-muted-foreground mb-4">
                {children}
              </ol>
            );
          },
          li({ children }) {
            return <li className="leading-relaxed">{children}</li>;
          },
          strong({ children }) {
            return (
              <strong className="font-semibold text-foreground">
                {children}
              </strong>
            );
          },
          em({ children }) {
            return <em className="italic">{children}</em>;
          },
          hr() {
            return <hr className="border-border my-8" />;
          },
          pre({ children }) {
            return (
              <pre className="bg-muted rounded-lg p-4 mb-4 overflow-x-auto text-xs font-mono leading-relaxed">
                {children}
              </pre>
            );
          },
          code({ children, className }) {
            const isBlock = Boolean(className?.startsWith("language-"));
            if (isBlock) {
              return <code className={className}>{children}</code>;
            }
            return (
              <code className="bg-muted text-foreground px-1.5 py-0.5 rounded text-xs font-mono">
                {children}
              </code>
            );
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-2 border-primary pl-4 italic text-sm text-muted-foreground my-4">
                {children}
              </blockquote>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>

      <p className="text-xs text-muted-foreground mt-10 pt-6 border-t border-border">
        Sumber: <code className="font-mono">docs/cogs-feature.md</code>
      </p>

      <BackToTop />
    </Container>
  );
}
