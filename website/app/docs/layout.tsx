import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { getAllDocs } from "@/lib/docs";
import Link from "next/link";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const docs = getAllDocs();

  return (
    <>
      <Navbar />
      <div className="pt-16">
        <div className="mx-auto flex max-w-6xl">
          <aside className="hidden w-64 shrink-0 border-r border-zinc-200 dark:border-zinc-800 md:block">
            <nav className="sticky top-16 max-h-[calc(100vh-4rem)] overflow-y-auto p-6">
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                文档
              </h3>
              <ul className="space-y-1">
                {docs.map((doc) => (
                  <li key={doc.slug}>
                    <Link
                      href={`/docs/${doc.slug}`}
                      className="block rounded-lg px-3 py-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
                    >
                      {doc.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>
          <main className="min-w-0 flex-1 px-8 py-12">{children}</main>
        </div>
      </div>
      <Footer />
    </>
  );
}
