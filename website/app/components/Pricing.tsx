"use client";

import { useState } from "react";
import { Check, X as XIcon } from "lucide-react";
import Link from "next/link";

const plans = [
  {
    name: "免费版",
    monthlyPrice: "0",
    yearlyPrice: "0",
    period: "永久免费",
    description: "基础养号功能，适合个人使用",
    features: [
      { text: "无限任务创建", included: true },
      { text: "关键词搜索", included: true },
      { text: "自定义筛选", included: true },
      { text: "自动点赞", included: true },
      { text: "自动评论", included: true },
      { text: "自动收藏", included: true },
      { text: "自动关注", included: true },
      { text: "数据分析", included: true },
      { text: "自定义评论", included: false },
      { text: "AI多风格评论", included: false },
      { text: "定时任务", included: false },
    ],
    cta: "免费使用",
    popular: false,
  },
  {
    name: "专业版",
    monthlyPrice: "29",
    yearlyPrice: "19",
    period: "/月",
    description: "完整功能，适合运营人员",
    features: [
      { text: "无限任务创建", included: true },
      { text: "关键词搜索", included: true },
      { text: "自定义筛选", included: true },
      { text: "自动点赞", included: true },
      { text: "自动评论", included: true },
      { text: "自动收藏", included: true },
      { text: "自动关注", included: true },
      { text: "数据分析", included: true },
      { text: "自定义评论", included: true },
      { text: "AI多风格评论", included: true },
      { text: "AI人设评论", included: true },
      { text: "定时任务", included: true },
      { text: "自动回复 (即将推出)", included: true },
    ],
    cta: "升级专业版",
    popular: true,
  },
  {
    name: "团队版",
    monthlyPrice: "99",
    yearlyPrice: "79",
    period: "/月",
    description: "团队协作，批量管理",
    features: [
      { text: "包含专业版所有功能", included: true },
      { text: "最多10个账号", included: true },
      { text: "团队成员管理", included: true },
      { text: "API接口调用", included: true },
      { text: "自定义养号策略", included: true },
      { text: "数据导出", included: true },
      { text: "专属客服支持", included: true },
    ],
    cta: "联系我们",
    popular: false,
  },
];

export default function Pricing() {
  const [yearly, setYearly] = useState(false);

  return (
    <section id="pricing" className="bg-zinc-50 py-24 dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl px-4">
        <div className="text-center">
          <h2 className="text-3xl font-bold md:text-4xl">
            选择适合你的 <span className="gradient-text">套餐</span>
          </h2>
          <p className="mt-4 text-zinc-600 dark:text-zinc-400">
            灵活定价，随时升降级
          </p>

          <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-zinc-200 bg-white p-1 dark:border-zinc-700 dark:bg-zinc-900">
            <button
              onClick={() => setYearly(false)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                !yearly
                  ? "bg-primary text-white"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400"
              }`}
            >
              月付
            </button>
            <button
              onClick={() => setYearly(true)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                yearly
                  ? "bg-primary text-white"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400"
              }`}
            >
              年付 <span className="text-xs opacity-75">省35%</span>
            </button>
          </div>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {plans.map((plan) => {
            const price = yearly ? plan.yearlyPrice : plan.monthlyPrice;
            const period = plan.monthlyPrice === "0" ? "永久免费" : yearly ? "/月 (按年付)" : "/月";

            return (
              <div
                key={plan.name}
                className={`relative rounded-2xl border p-8 transition-all ${
                  plan.popular
                    ? "border-primary bg-white shadow-xl shadow-primary/10 dark:bg-zinc-900"
                    : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-medium text-white">
                    最受欢迎
                  </div>
                )}

                <h3 className="text-xl font-bold">{plan.name}</h3>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {plan.description}
                </p>

                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-bold">¥{price}</span>
                  <span className="text-zinc-500">{period}</span>
                </div>

                <Link
                  href="/auth/login"
                  className={`mt-6 block w-full rounded-full py-3 text-center text-sm font-medium transition-colors ${
                    plan.popular
                      ? "bg-primary text-white hover:bg-primary-dark"
                      : "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                  }`}
                >
                  {plan.cta}
                </Link>

                <ul className="mt-8 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature.text} className="flex items-start gap-3 text-sm">
                      {feature.included ? (
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      ) : (
                        <XIcon className="mt-0.5 h-4 w-4 shrink-0 text-zinc-300 dark:text-zinc-600" />
                      )}
                      <span className={feature.included ? "text-zinc-700 dark:text-zinc-300" : "text-zinc-400 dark:text-zinc-600"}>
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
