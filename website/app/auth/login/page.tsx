"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Sprout, Mail, Lock, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"magic" | "password">("magic");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
  const redirectTo = searchParams.get("next") || "/";

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const resp = await fetch(`${apiBase}/api/auth/magic-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!resp.ok) {
        throw new Error("发送失败，请稍后重试");
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const form = new URLSearchParams();
      form.set("username", email);
      form.set("password", password);

      const resp = await fetch(`${apiBase}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
      });
      if (!resp.ok) {
        throw new Error("邮箱或密码错误");
      }

      const data = await resp.json();
      if (!data?.access_token) {
        throw new Error("登录失败：未返回 token");
      }

      localStorage.setItem("auth_token", data.access_token);
      router.push(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-xl font-bold">
            <Sprout className="h-7 w-7 text-primary" />
            养薯户
          </Link>
          <p className="mt-2 text-sm text-zinc-500">登录你的账户</p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {sent ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <Mail className="h-6 w-6 text-green-600" />
              </div>
              <h2 className="text-lg font-bold">检查你的邮箱</h2>
              <p className="mt-2 text-sm text-zinc-500">
                我们已向 {email} 发送了登录链接
              </p>
              <button
                onClick={() => setSent(false)}
                className="mt-4 text-sm text-primary hover:underline"
              >
                重新发送
              </button>
            </div>
          ) : (
            <>
              {mode === "magic" ? (
                <form onSubmit={handleMagicLink}>
                  <div className="mb-4">
                    <label className="mb-1.5 block text-sm font-medium">邮箱地址</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        required
                        className="w-full rounded-lg border border-zinc-300 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition-colors focus:border-primary dark:border-zinc-700 dark:bg-zinc-800"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
                  >
                    {loading ? "发送中..." : "发送魔法链接"}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </form>
              ) : (
                <form onSubmit={handlePasswordLogin}>
                  <div className="mb-4">
                    <label className="mb-1.5 block text-sm font-medium">邮箱地址</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        required
                        className="w-full rounded-lg border border-zinc-300 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition-colors focus:border-primary dark:border-zinc-700 dark:bg-zinc-800"
                      />
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="mb-1.5 block text-sm font-medium">密码</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="输入密码"
                        required
                        className="w-full rounded-lg border border-zinc-300 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition-colors focus:border-primary dark:border-zinc-700 dark:bg-zinc-800"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
                  >
                    {loading ? "登录中..." : "登录"}
                  </button>
                </form>
              )}

              {error && (
                <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">
                  {error}
                </p>
              )}

              <div className="mt-4 text-center">
                <button
                  onClick={() => setMode(mode === "magic" ? "password" : "magic")}
                  className="text-xs text-zinc-500 hover:text-zinc-700"
                >
                  {mode === "magic" ? "使用密码登录" : "使用魔法链接登录"}
                </button>
              </div>

              <div className="relative mt-6 mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-zinc-200 dark:border-zinc-700" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-2 text-zinc-500 dark:bg-zinc-900">或</span>
                </div>
              </div>

              <div className="space-y-3">
                <button className="flex w-full items-center justify-center gap-3 rounded-lg border border-zinc-300 bg-white py-2.5 text-sm font-medium transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700">
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  使用 Google 继续
                </button>
                <button className="flex w-full items-center justify-center gap-3 rounded-lg border border-zinc-300 bg-white py-2.5 text-sm font-medium transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700">
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  使用 GitHub 继续
                </button>
              </div>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-zinc-500">
          还没有账户？{" "}
          <Link href="/auth/login" className="text-primary hover:underline">
            创建账户
          </Link>
        </p>

        <div className="mt-8 flex items-center justify-center gap-4 text-xs text-zinc-400">
          <Link href="#" className="hover:text-zinc-600">隐私政策</Link>
          <span>·</span>
          <Link href="#" className="hover:text-zinc-600">服务条款</Link>
        </div>
      </div>
    </div>
  );
}
