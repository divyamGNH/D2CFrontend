"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Login() {
  const BASE_URL =
    process.env.NEXT_PUBLIC_BASE_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:8080";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  async function handleLogin() {
    try {
      setIsLoading(true);
      setErrorMessage("");
      const res = await fetch(`${BASE_URL}/auth/login`,{
        method : "POST",
        headers : {
            "Content-Type" : "application/json",
        },
        body : JSON.stringify({
            Email : email,
            Password : password
        })
      });

      const contentType = res.headers.get("content-type") || "";
      let data = null;

      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const responseText = await res.text();
        data = { message: responseText };
      }

      if (!res.ok) {
        const backendMessage =
          data?.message || data?.error || data?.detail || data?.msg || "";

        const statusMessages: Record<number, string> = {
          400: "Bad request",
          401: "Unauthorized",
          403: "Forbidden",
          404: "Not found",
          409: "Conflict",
          422: "Validation failed",
          429: "Too many requests",
          500: "Internal server error",
          502: "Bad gateway",
          503: "Service unavailable",
        };

        const statusMessage =
          statusMessages[res.status] || `Request failed with status ${res.status}`;
        const finalMessage = backendMessage
          ? `${statusMessage}: ${backendMessage}`
          : statusMessage;

        setErrorMessage(finalMessage);
        console.error("Login failed:", finalMessage, data);
        return;
      }

      if (res.status === 200) {
        if (!data?.accessToken || !data?.refreshToken) {
          setErrorMessage("Login succeeded but tokens are missing in response");
          console.error("Login response missing tokens:", data);
          return;
        }

        router.push("/dashboard");
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
      }

      console.log(data);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Unexpected login error");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 px-6 py-10 text-slate-100 sm:px-10">
      <div className="pointer-events-none absolute -left-16 top-24 h-44 w-44 rounded-full border border-cyan-400/25" />
      <div className="pointer-events-none absolute -right-20 bottom-12 h-56 w-56 rounded-full border border-indigo-400/20" />

      <div className="relative mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-slate-700 bg-slate-900/90 p-8 shadow-xl shadow-black/25 sm:p-10">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
            D2C Workspace
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-100 sm:text-4xl">
            Welcome back
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-300 sm:text-base">
            Sign in to create rooms, join your team, and continue your calls.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-700 bg-slate-900/90 p-6 shadow-xl shadow-black/25 sm:p-8">
          <h2 className="text-xl font-semibold text-slate-100">Login</h2>
          <div className="mt-6 space-y-4">
            <input
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-4 py-2.5 text-slate-100 placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none"
              placeholder="Email"
              type="email"
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-4 py-2.5 text-slate-100 placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none"
              placeholder="Password"
              type="password"
              onChange={(e) => setPassword(e.target.value)}
            />

            <button
              onClick={() => {
                void handleLogin();
              }}
              disabled={isLoading}
              className="w-full rounded-md border border-cyan-300/80 bg-cyan-400 py-2.5 text-sm font-bold text-slate-950 transition hover:scale-[1.01] hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Logging in..." : "Log In"}
            </button>

            <p className="text-sm text-slate-300">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="font-medium text-cyan-200 underline decoration-cyan-400/70 underline-offset-2">
                Sign Up
              </Link>
            </p>

            {errorMessage && (
              <p className="rounded-md border border-[#6d2f3a] bg-[#26161a] px-3 py-2 text-sm text-[#f1b7c0]">
                {errorMessage}
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}