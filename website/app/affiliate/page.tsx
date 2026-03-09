import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { UserPlus, Share2, DollarSign, Infinity, BarChart3, Eye } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "推广合作 - 养薯户",
  description: "加入养薯户推广合作计划，每次成功销售获得30%佣金。",
};

const steps = [
  {
    icon: UserPlus,
    title: "注册",
    description: "成为推广合作伙伴，零门槛，任何人都可以加入。",
  },
  {
    icon: Share2,
    title: "分享",
    description: "获取你的专属推广链接和代码，分享给你的受众。",
  },
  {
    icon: DollarSign,
    title: "赚取",
    description: "每次成功转化获得30%佣金，每月通过PayPal结算。",
  },
];

const benefits = [
  {
    icon: DollarSign,
    title: "30% 佣金",
    description: "每次成功销售至少获得 $3 佣金",
  },
  {
    icon: Infinity,
    title: "永不过期",
    description: "推广代码永久有效，不会错过任何佣金",
  },
  {
    icon: BarChart3,
    title: "实时追踪",
    description: "查看收入、点击量和用户活动统计",
  },
  {
    icon: Eye,
    title: "透明佣金",
    description: "清晰的委佣结构和支付流程",
  },
];

export default function AffiliatePage() {
  return (
    <>
      <Navbar />
      <main className="pt-32 pb-24">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center">
            <h1 className="text-4xl font-bold md:text-5xl">
              推广 <span className="gradient-text">合作计划</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
              加入养薯户推广合作，分享给你的受众，每次成功销售获得 30% 佣金。
            </p>
            <Link
              href="#"
              className="mt-8 inline-flex rounded-full bg-primary px-8 py-3 text-base font-medium text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary-dark"
            >
              立即加入
            </Link>
          </div>

          {/* Steps */}
          <div className="mt-24 grid gap-8 md:grid-cols-3">
            {steps.map((step, i) => (
              <div key={step.title} className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                  <step.icon className="h-8 w-8 text-primary" />
                </div>
                <div className="mb-2 text-sm font-bold text-primary">
                  第 {i + 1} 步
                </div>
                <h3 className="text-xl font-bold">{step.title}</h3>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {step.description}
                </p>
              </div>
            ))}
          </div>

          {/* Benefits */}
          <div className="mt-24">
            <h2 className="text-center text-3xl font-bold">
              为什么选择 <span className="gradient-text">我们</span>
            </h2>
            <div className="mt-12 grid gap-6 md:grid-cols-2">
              {benefits.map((benefit) => (
                <div
                  key={benefit.title}
                  className="flex gap-4 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <benefit.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold">{benefit.title}</h3>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                      {benefit.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
