"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

interface BlogMeta {
  slug: string;
  title: string;
  description: string;
  category: string;
  date: string;
}

const categories = ["全部", "养号", "起号", "引流"];

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogMeta[]>([]);
  const [activeCategory, setActiveCategory] = useState("全部");

  useEffect(() => {
    fetch("/api/blog")
      .then((r) => r.json())
      .then(setPosts)
      .catch(() => {});
  }, []);

  const filtered =
    activeCategory === "全部"
      ? posts
      : posts.filter((p) => p.category === activeCategory);

  return (
    <>
      <Navbar />
      <main className="pt-32 pb-24">
        <div className="mx-auto max-w-4xl px-4">
          <div className="mb-12 text-center">
            <h1 className="text-4xl font-bold">博客</h1>
            <p className="mt-4 text-zinc-600 dark:text-zinc-400">
              小红书养号、起号、引流的实用技巧和策略
            </p>
          </div>

          <div className="mb-8 flex items-center justify-center gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  activeCategory === cat
                    ? "bg-primary text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid gap-6">
            {filtered.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="block rounded-xl border border-zinc-200 bg-white p-6 transition-all hover:border-primary/30 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="mb-2 flex items-center gap-3">
                  <span className="rounded-full bg-primary/10 px-3 py-0.5 text-xs font-medium text-primary">
                    {post.category}
                  </span>
                  <span className="text-xs text-zinc-500">{post.date}</span>
                </div>
                <h2 className="text-xl font-bold">{post.title}</h2>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {post.description}
                </p>
              </Link>
            ))}
            {filtered.length === 0 && (
              <p className="py-12 text-center text-zinc-500">暂无文章</p>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
