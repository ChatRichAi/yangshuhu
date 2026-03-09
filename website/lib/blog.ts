import fs from "fs";
import path from "path";
import matter from "gray-matter";

const blogDirectory = path.join(process.cwd(), "content/blog");

export interface BlogMeta {
  slug: string;
  title: string;
  description: string;
  category: string;
  date: string;
}

export interface BlogPost extends BlogMeta {
  content: string;
}

export function getAllPosts(): BlogMeta[] {
  if (!fs.existsSync(blogDirectory)) return [];
  const files = fs.readdirSync(blogDirectory).filter((f) => f.endsWith(".mdx"));
  const posts = files.map((file) => {
    const slug = file.replace(/\.mdx$/, "");
    const fullPath = path.join(blogDirectory, file);
    const fileContents = fs.readFileSync(fullPath, "utf8");
    const { data } = matter(fileContents);
    return {
      slug,
      title: (data.title as string) || slug,
      description: (data.description as string) || "",
      category: (data.category as string) || "养号",
      date: (data.date as string) || "",
    };
  });
  return posts.sort((a, b) => (b.date > a.date ? 1 : -1));
}

export function getPost(slug: string): BlogPost | null {
  const fullPath = path.join(blogDirectory, `${slug}.mdx`);
  if (!fs.existsSync(fullPath)) return null;
  const fileContents = fs.readFileSync(fullPath, "utf8");
  const { data, content } = matter(fileContents);
  return {
    slug,
    title: (data.title as string) || slug,
    description: (data.description as string) || "",
    category: (data.category as string) || "养号",
    date: (data.date as string) || "",
    content,
  };
}

export function getCategories(): string[] {
  return ["养号", "起号", "引流"];
}
