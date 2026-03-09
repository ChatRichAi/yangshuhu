import { Download, BookOpen, Sparkles } from "lucide-react";
import Link from "next/link";

export default function Hero() {
  return (
    <section className="hero-gradient pt-32 pb-20">
      <div className="mx-auto max-w-6xl px-4 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary">
          <Sparkles className="h-4 w-4" />
          新功能: AI智能生成热门评论
        </div>

        <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight tracking-tight md:text-5xl lg:text-6xl">
          自动小红书养号
          <br />
          <span className="gradient-text">每天为你节省三十分钟</span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
          养薯户是一款浏览器扩展，通过模拟真实用户行为——浏览、点赞、收藏、评论，帮你自动完成小红书账号养号任务。
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="#"
            className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-base font-medium text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary-dark hover:shadow-xl hover:shadow-primary/30"
          >
            <BookOpen className="h-5 w-5" />
            查看文档
          </Link>
          <Link
            href="#"
            className="flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-6 py-3 text-base font-medium text-zinc-800 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <Download className="h-5 w-5" />
            Chrome 商店安装
          </Link>
        </div>

        <p className="mt-4 text-sm text-zinc-500">
          或直接下载安装包 v3.0.1 (2MB)
        </p>
      </div>
    </section>
  );
}
