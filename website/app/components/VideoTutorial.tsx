import { Play, BookOpen } from "lucide-react";
import Link from "next/link";

const tutorials = [
  {
    title: "安装与快速开始",
    description: "3分钟学会安装和配置养薯户",
    thumbnail: "https://placehold.co/640x360/e74c3c/white?text=安装教程",
  },
  {
    title: "发现页养号策略",
    description: "如何通过发现页高效养号",
    thumbnail: "https://placehold.co/640x360/ff8a65/white?text=养号策略",
  },
];

export default function VideoTutorial() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="text-center">
          <h2 className="text-3xl font-bold md:text-4xl">
            视频 <span className="gradient-text">教程</span>
          </h2>
          <p className="mt-4 text-zinc-600 dark:text-zinc-400">
            跟着教程，快速上手养薯户
          </p>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-2">
          {tutorials.map((tutorial) => (
            <div
              key={tutorial.title}
              className="group overflow-hidden rounded-2xl border border-zinc-200 bg-white transition-all hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="relative aspect-video bg-zinc-100 dark:bg-zinc-800">
                <div className="flex h-full items-center justify-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/90 text-white shadow-lg transition-transform group-hover:scale-110">
                    <Play className="ml-1 h-7 w-7" fill="currentColor" />
                  </div>
                </div>
              </div>
              <div className="p-6">
                <h3 className="text-lg font-bold">{tutorial.title}</h3>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {tutorial.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="mb-4 text-zinc-600 dark:text-zinc-400">
            需要更多学习资源？
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/docs"
              className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              <BookOpen className="h-4 w-4" />
              查看文档
            </Link>
            <Link
              href="/blog"
              className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              阅读博客
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
