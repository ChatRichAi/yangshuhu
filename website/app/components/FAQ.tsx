"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

const faqs = [
  {
    question: "如何取消订阅？",
    answer: "你可以随时在账户设置页面中取消订阅。取消后，当前计费周期结束前你仍可继续使用付费功能。",
  },
  {
    question: "可以更换套餐吗？",
    answer: "可以。你可以随时在账户设置中升级或降级套餐，费用会按比例计算。",
  },
  {
    question: "是否提供免费试用？",
    answer: "基础养号功能（浏览、点赞、收藏）完全免费。AI智能评论等高级功能需要付费订阅。",
  },
  {
    question: "养号会被小红书检测到吗？",
    answer: "养薯户通过模拟真实用户行为，包括随机间隔、自然浏览路径等方式运行，最大程度降低被检测的风险。",
  },
  {
    question: "支持哪些浏览器？",
    answer: "目前支持 Chrome 及基于 Chromium 的浏览器（如 Edge、Brave 等）。",
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="py-24">
      <div className="mx-auto max-w-3xl px-4">
        <div className="text-center">
          <h2 className="text-3xl font-bold md:text-4xl">
            常见 <span className="gradient-text">问题</span>
          </h2>
        </div>

        <div className="mt-12 space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
            >
              <button
                className="flex w-full items-center justify-between px-6 py-4 text-left"
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
              >
                <span className="font-medium">{faq.question}</span>
                <ChevronDown
                  className={`h-5 w-5 shrink-0 text-zinc-500 transition-transform ${
                    openIndex === index ? "rotate-180" : ""
                  }`}
                />
              </button>
              {openIndex === index && (
                <div className="border-t border-zinc-200 px-6 py-4 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
