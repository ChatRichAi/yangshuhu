import fs from "fs";
import path from "path";
import matter from "gray-matter";

const docsDirectory = path.join(process.cwd(), "content/docs");

export interface DocMeta {
  slug: string;
  title: string;
  order: number;
  description: string;
}

export interface Doc extends DocMeta {
  content: string;
}

export function getAllDocs(): DocMeta[] {
  if (!fs.existsSync(docsDirectory)) return [];
  const files = fs.readdirSync(docsDirectory).filter((f) => f.endsWith(".mdx"));
  const docs = files.map((file) => {
    const slug = file.replace(/\.mdx$/, "");
    const fullPath = path.join(docsDirectory, file);
    const fileContents = fs.readFileSync(fullPath, "utf8");
    const { data } = matter(fileContents);
    return {
      slug,
      title: (data.title as string) || slug,
      order: (data.order as number) || 99,
      description: (data.description as string) || "",
    };
  });
  return docs.sort((a, b) => a.order - b.order);
}

export function getDoc(slug: string): Doc | null {
  const fullPath = path.join(docsDirectory, `${slug}.mdx`);
  if (!fs.existsSync(fullPath)) return null;
  const fileContents = fs.readFileSync(fullPath, "utf8");
  const { data, content } = matter(fileContents);
  return {
    slug,
    title: (data.title as string) || slug,
    order: (data.order as number) || 99,
    description: (data.description as string) || "",
    content,
  };
}
