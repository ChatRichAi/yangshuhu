import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { Sprout } from "lucide-react";

export const metadata = {
  title: "更新日志 - 养薯户",
  description: "养薯户版本更新记录",
};

const releases = [
  {
    version: "v3.0.1",
    date: "2025年9月",
    tag: "修复",
    changes: ["修复系统已知问题", "优化AI评论生成稳定性"],
  },
  {
    version: "v3.0.0",
    date: "2025年8月",
    tag: "重大更新",
    changes: [
      "主页信息流自动化（浏览和互动）",
      "详细分析仪表板",
      "欢迎页改进UX",
      "应用评分提示",
      "卸载反馈收集",
      "增强安全性",
    ],
  },
  {
    version: "v2.0.0",
    date: "2025年7月",
    tag: "新功能",
    changes: [
      "评论区自动化（笔记互动）",
      "重复交互防止机制",
      "基于概率的触发条件",
    ],
  },
  {
    version: "v1.0.0",
    date: "2024年11月",
    tag: "正式发布",
    changes: ["核心账号养号功能", "发现页自动浏览互动"],
  },
  {
    version: "v0.4.1",
    date: "2024年10月",
    tag: "改进",
    changes: ["身份验证系统"],
  },
  {
    version: "v0.4.0",
    date: "2024年9月",
    tag: "新功能",
    changes: ["数据追踪和分析"],
  },
  {
    version: "v0.3.0",
    date: "2024年8月",
    tag: "新功能",
    changes: ["定时任务功能"],
  },
  {
    version: "v0.2.2",
    date: "2024年7月",
    tag: "新功能",
    changes: ["AI驱动评论生成"],
  },
  {
    version: "v0.1.0",
    date: "2024年6月",
    tag: "初始版本",
    changes: ["初始版本发布", "基础浏览和点赞功能"],
  },
];

const tagColors: Record<string, string> = {
  "重大更新": "bg-primary text-white",
  "新功能": "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  "修复": "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  "改进": "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  "正式发布": "bg-primary text-white",
  "初始版本": "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

export default function ChangelogPage() {
  return (
    <>
      <Navbar />
      <main className="pt-32 pb-24">
        <div className="mx-auto max-w-3xl px-4">
          <div className="mb-12 text-center">
            <h1 className="text-4xl font-bold">更新日志</h1>
            <p className="mt-4 text-zinc-600 dark:text-zinc-400">
              养薯户的版本更新记录
            </p>
          </div>

          <div className="relative">
            <div className="absolute top-0 bottom-0 left-6 w-px bg-zinc-200 dark:bg-zinc-800" />

            {releases.map((release) => (
              <div key={release.version} className="relative mb-12 pl-16">
                <div className="absolute left-0 flex h-12 w-12 items-center justify-center rounded-full border-2 border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                  <Sprout className="h-5 w-5 text-primary" />
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <h2 className="text-xl font-bold">{release.version}</h2>
                  <span className={`rounded-full px-3 py-0.5 text-xs font-medium ${tagColors[release.tag] || "bg-zinc-100"}`}>
                    {release.tag}
                  </span>
                  <span className="text-sm text-zinc-500">{release.date}</span>
                </div>

                <ul className="space-y-2">
                  {release.changes.map((change, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      {change}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
