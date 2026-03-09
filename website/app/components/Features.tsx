import { Settings2, Play, BarChart3, Heart, MessageCircle, Star, Eye, UserPlus } from "lucide-react";

const steps = [
  {
    step: "01",
    icon: Settings2,
    title: "配置养号规则",
    description: "自定义互动触发条件。例如：浏览10条笔记后自动点赞5条。",
    tags: ["高自由度养号", "可重复使用"],
    details: [
      { icon: Eye, label: "自动浏览" },
      { icon: Heart, label: "智能点赞" },
      { icon: Star, label: "自动收藏" },
      { icon: MessageCircle, label: "AI评论" },
    ],
  },
  {
    step: "02",
    icon: Play,
    title: "自动执行养号任务",
    description: "一键启动，自动完成浏览、点赞、收藏、评论、关注等养号操作。",
    tags: ["智能模拟养号", "监控养号进度"],
    details: [
      { icon: Eye, label: "模拟浏览" },
      { icon: Heart, label: "随机点赞" },
      { icon: UserPlus, label: "智能关注" },
      { icon: MessageCircle, label: "热门评论" },
    ],
  },
  {
    step: "03",
    icon: BarChart3,
    title: "回顾养号数据",
    description: "完整记录每次互动行为，时间分析可视化，助你优化养号策略。",
    tags: ["数据可视化", "数据分析"],
    details: [
      { icon: BarChart3, label: "互动统计" },
      { icon: Eye, label: "浏览记录" },
      { icon: Heart, label: "点赞记录" },
      { icon: Star, label: "收藏记录" },
    ],
  },
];

export default function Features() {
  return (
    <section id="features" className="py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="text-center">
          <h2 className="text-3xl font-bold md:text-4xl">
            三步完成 <span className="gradient-text">自动养号</span>
          </h2>
          <p className="mt-4 text-zinc-600 dark:text-zinc-400">
            简单配置，智能执行，数据追踪
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {steps.map((step) => (
            <div
              key={step.step}
              className="group rounded-2xl border border-zinc-200 bg-white p-8 transition-all hover:border-primary/30 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-primary/30"
            >
              <div className="mb-4 flex items-center gap-3">
                <span className="text-sm font-bold text-primary">{step.step}</span>
                <step.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mb-2 text-xl font-bold">{step.title}</h3>
              <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
                {step.description}
              </p>

              <div className="mb-4 grid grid-cols-2 gap-3">
                {step.details.map((detail) => (
                  <div
                    key={detail.label}
                    className="flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-800"
                  >
                    <detail.icon className="h-4 w-4 text-primary" />
                    {detail.label}
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                {step.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
