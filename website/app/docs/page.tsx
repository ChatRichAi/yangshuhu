import { getAllDocs } from "@/lib/docs";
import Link from "next/link";
import { BookOpen } from "lucide-react";

export const metadata = {
  title: "文档 - 养薯户",
  description: "养薯户使用文档，帮你快速上手小红书自动养号。",
};

export default function DocsIndex() {
  const docs = getAllDocs();

  return (
    <div>
      <h1 className="text-3xl font-bold">文档</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        快速上手养薯户，掌握所有功能
      </p>

      <div className="mt-8 grid gap-4">
        {docs.map((doc) => (
          <Link
            key={doc.slug}
            href={`/docs/${doc.slug}`}
            className="flex items-start gap-4 rounded-xl border border-zinc-200 bg-white p-5 transition-all hover:border-primary/30 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <h2 className="font-semibold">{doc.title}</h2>
              <p className="mt-1 text-sm text-zinc-500">{doc.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
