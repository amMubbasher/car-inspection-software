"use client";

import { signIn, getSession } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AlertTriangle, Eye, EyeOff, Loader2 } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import logo from "../../../logo.png";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await signIn("credentials", {
        redirect: false,
        email: email.trim().toLowerCase(),
        password,
      });

      if (res?.ok) {
        const session = await getSession();
        const destination =
          session?.user?.role === "admin"
            ? "/admin/dashboard"
            : "/team/dashboard";
        router.push(destination);
        return;
      }

      setError(
        res?.error === "CredentialsSignin"
          ? "Invalid email or password"
          : res?.error || "Login failed. Please try again."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Login failed. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative -mt-20 flex min-h-screen bg-gray-50 md:-mt-16 dark:bg-gray-950">
      <div className="absolute right-4 top-4 z-20 md:right-6 md:top-6">
        <ThemeToggle />
      </div>
      <section className="relative hidden w-[46%] overflow-hidden bg-gray-900 text-white lg:flex lg:items-center dark:bg-black">
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-8 opacity-50 blur-[3px]"
          style={{
            backgroundImage:
              "linear-gradient(to right, transparent calc(50% - 1.5px), rgba(255,255,255,0.22) 50%, transparent calc(50% + 1.5px)), linear-gradient(to bottom, transparent calc(50% - 1.5px), rgba(255,255,255,0.22) 50%, transparent calc(50% + 1.5px))",
            backgroundSize: "112px 112px",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 32% 42%, transparent 0%, rgba(0,0,0,0.42) 78%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute left-[12%] top-[10%] h-80 w-80 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.08) 36%, rgba(255,255,255,0.02) 58%, transparent 72%)",
          }}
        />
        <div className="relative z-10 px-12">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white">
            <Image src={logo} alt="Motor Expert" width={44} height={44} />
          </div>
          <p className="mt-10 text-xs font-medium uppercase tracking-[0.28em] text-gray-400">
            Motor Expert
          </p>
          <h1 className="mt-4 max-w-sm text-5xl font-semibold leading-[1.05] tracking-tight">
            Inspection desk
          </h1>
          <p className="mt-5 max-w-sm text-base leading-relaxed text-gray-300">
            Chassis, paint, OBD, and full vehicle reports for the team on shift.
          </p>
        </div>
      </section>

      <section className="flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full max-w-[420px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white dark:bg-gray-900">
              <Image src={logo} alt="Motor Expert" width={32} height={32} />
            </div>
            <p className="text-sm font-medium uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400">
              Motor Expert
            </p>
          </div>

          <h2 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">
            Sign in
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Use your staff email and password.
          </p>

          <form onSubmit={handleLogin} className="mt-8 space-y-5">
            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-gray-900 dark:text-white">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="name@motorexpert.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 outline-none transition focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-gray-900 dark:text-white">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 pr-12 text-sm text-gray-900 outline-none transition focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isLoading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
