import Link from "next/link";
import { Sprout } from "lucide-react";

const footerLinks = [
  {
    title: "产品",
    links: [
      { label: "功能介绍", href: "#features" },
      { label: "价格", href: "/pricing" },
      { label: "更新日志", href: "/changelog" },
    ],
  },
  {
    title: "资源",
    links: [
      { label: "文档", href: "/docs" },
      { label: "博客", href: "/blog" },
      { label: "Chrome 商店", href: "#" },
    ],
  },
  {
    title: "支持",
    links: [
      { label: "推广合作", href: "/affiliate" },
      { label: "隐私政策", href: "#" },
      { label: "服务协议", href: "#" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-zinc-200 bg-zinc-50 py-16 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <Link href="/" className="flex items-center gap-2 text-lg font-bold">
              <Sprout className="h-6 w-6 text-primary" />
              养薯户
            </Link>
            <p className="mt-3 text-sm text-zinc-500">
              小红书自动养号工具，让养号更轻松高效。
            </p>
          </div>

          {footerLinks.map((group) => (
            <div key={group.title}>
              <h4 className="mb-4 text-sm font-semibold">{group.title}</h4>
              <ul className="space-y-3">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 border-t border-zinc-200 pt-8 text-center text-sm text-zinc-500 dark:border-zinc-800">
          © {new Date().getFullYear()} 养薯户. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
