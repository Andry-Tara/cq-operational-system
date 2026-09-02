"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

function RestaurantMark() {
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-100 bg-red-50 text-red-700 shadow-sm">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="h-6 w-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 11h16" />
        <path d="M6 11a6 6 0 0 1 12 0" />
        <path d="M3 15h18" />
        <path d="M5 15l1.5 4h11L19 15" />
        <path d="M12 5V3" />
      </svg>
    </div>
  );
}

export function LoginForm() {
  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [isLoading, setIsLoading] =
    useState(false);

  const router = useRouter();

  async function handleLogin(
    event: React.FormEvent
  ) {
    event.preventDefault();

    const supabase =
      createClient();

    setIsLoading(true);
    setError(null);

    try {
      const {
        error: loginError,
      } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (loginError) {
        throw loginError;
      }

      router.push("/protected");
      router.refresh();
    } catch (error) {
      console.error(
        "Login error:",
        error
      );

      setError(
        "Invalid email or password. Please check your credentials and try again."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="w-full">

      {/* ======================================================
          RESTAURANT SYMBOL
      ====================================================== */}

      <div className="mb-5 flex justify-center">
        <RestaurantMark />
      </div>

      {/* ======================================================
          BRAND LOGOS
      ====================================================== */}

      <div className="mb-7 grid grid-cols-2 gap-3">
        <div className="flex h-[76px] items-center justify-start rounded-2xl border border-neutral-200 bg-white px-5 shadow-[0_6px_20px_rgba(0,0,0,0.035)]">
          <Image
            src="/brand/chongqing-hotpot.png"
            alt="Chong Qing Hot Pot"
            width={170}
            height={55}
            className="max-h-[48px] max-w-full object-contain object-left"
            priority
          />
        </div>

        <div className="flex h-[76px] items-center justify-end rounded-2xl border border-neutral-200 bg-white px-5 shadow-[0_6px_20px_rgba(0,0,0,0.035)]">
          <Image
            src="/brand/dingding-hotpot.png"
            alt="Ding Ding Hot Pot"
            width={170}
            height={55}
            className="max-h-[48px] max-w-full object-contain object-right"
            priority
          />
        </div>
      </div>

      {/* ======================================================
          HEADING
      ====================================================== */}

      <div className="mb-6 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-red-700">
          Authorized Access
        </p>

        <h1 className="mt-3 text-[32px] font-bold tracking-[-0.035em] text-neutral-950 sm:text-4xl">
          Welcome back
        </h1>

        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-neutral-500">
          Sign in to access the restaurant operations portal.
        </p>
      </div>

      {/* ======================================================
          LOGIN CARD
      ====================================================== */}

      <div className="rounded-[26px] border border-neutral-200/90 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)] sm:p-8">

        <form
          onSubmit={handleLogin}
          className="space-y-5"
        >

          {/* EMAIL */}
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-[11px] font-bold uppercase tracking-[0.1em] text-neutral-600"
            >
              Email Address
            </label>

            <input
              id="email"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              value={email}
              disabled={isLoading}
              onChange={(event) =>
                setEmail(
                  event.target.value
                )
              }
              placeholder="name@company.com"
              className="w-full rounded-2xl border border-neutral-200 bg-[#fafafa] px-4 py-3.5 text-sm font-medium text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-red-300 focus:bg-white focus:ring-4 focus:ring-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          {/* PASSWORD */}
          <div>
            <div className="mb-2 flex items-center justify-between gap-4">
              <label
                htmlFor="password"
                className="text-[11px] font-bold uppercase tracking-[0.1em] text-neutral-600"
              >
                Password
              </label>

              <Link
                href="/auth/forgot-password"
                className="text-xs font-medium text-neutral-400 transition hover:text-red-700"
              >
                Forgot password?
              </Link>
            </div>

            <div className="relative">
              <input
                id="password"
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                autoComplete="current-password"
                required
                value={password}
                disabled={isLoading}
                onChange={(event) =>
                  setPassword(
                    event.target.value
                  )
                }
                placeholder="Enter your password"
                className="w-full rounded-2xl border border-neutral-200 bg-[#fafafa] px-4 py-3.5 pr-20 text-sm font-medium text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-red-300 focus:bg-white focus:ring-4 focus:ring-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              />

              <button
                type="button"
                disabled={isLoading}
                onClick={() =>
                  setShowPassword(
                    (current) =>
                      !current
                  )
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-3 py-1.5 text-xs font-bold text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-50"
              >
                {showPassword
                  ? "Hide"
                  : "Show"}
              </button>
            </div>
          </div>

          {/* ERROR */}
          {error && (
            <div
              role="alert"
              className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3.5"
            >
              <p className="text-xs font-bold uppercase tracking-wide text-red-700">
                Sign in failed
              </p>

              <p className="mt-1 text-xs leading-5 text-red-600">
                {error}
              </p>
            </div>
          )}

          {/* SIGN IN */}
          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-700 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-red-800 focus:outline-none focus:ring-4 focus:ring-red-100 disabled:cursor-not-allowed disabled:bg-red-400"
          >
            {isLoading && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            )}

            {isLoading
              ? "Signing in..."
              : "Sign In"}
          </button>
        </form>

        {/* SECURITY NOTE */}
        <div className="mt-6 flex items-center justify-center gap-2 border-t border-neutral-100 pt-5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />

          <p className="text-center text-[11px] text-neutral-400">
            Secure access for authorized operational users
          </p>
        </div>
      </div>

      {/* FOOTER */}
      <div className="mt-5 text-center">
        <p className="text-[11px] text-neutral-400">
          Internal Restaurant Operations Portal
        </p>

        <p className="mt-1 text-[10px] text-neutral-300">
          Chong Qing Hot Pot · Ding Ding Hot Pot
        </p>
      </div>
    </div>
  );
}
