"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Signup() {
  const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:8080";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const router = useRouter();

  async function handleSignup() {
    try {
      setIsLoading(true);
      setErrorMessage("");
      const res = await fetch(`${BASE_URL}/auth/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          Email: email,
          Password: password,
          FirstName: firstName,
          LastName: lastName,
        }),
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
          data?.message || data?.error || data?.detail || data?.msg || "Signup failed";
        setErrorMessage(backendMessage);
        return;
      }

      console.log(data);
      router.push("/login");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Unexpected signup error");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 px-6 py-10 text-slate-100 sm:px-10">
      <div className="pointer-events-none absolute -left-16 top-24 h-44 w-44 rounded-full border border-indigo-400/25" />
      <div className="pointer-events-none absolute -right-20 bottom-12 h-56 w-56 rounded-full border border-cyan-400/20" />

      <div className="relative mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-slate-700 bg-slate-900/90 p-8 shadow-xl shadow-black/25 sm:p-10">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
            D2C Workspace
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-100 sm:text-4xl">
            Create your account
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-300 sm:text-base">
            Set up your profile to create and join private call rooms.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-700 bg-slate-900/90 p-6 shadow-xl shadow-black/25 sm:p-8">
          <h2 className="text-xl font-semibold text-slate-100">Sign Up</h2>
          <div className="mt-6 space-y-4">
            <input
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-4 py-2.5 text-slate-100 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
              placeholder="First Name"
              onChange={(e) => setFirstName(e.target.value)}
            />

            <input
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-4 py-2.5 text-slate-100 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
              placeholder="Last Name"
              onChange={(e) => setLastName(e.target.value)}
            />

            <input
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-4 py-2.5 text-slate-100 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
              placeholder="Email"
              type="email"
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-4 py-2.5 text-slate-100 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
              placeholder="Password"
              type="password"
              onChange={(e) => setPassword(e.target.value)}
            />

            <button
              onClick={() => {
                void handleSignup();
              }}
              disabled={isLoading}
              className="w-full rounded-md border border-indigo-300/80 bg-indigo-400 py-2.5 text-sm font-bold text-slate-950 transition hover:scale-[1.01] hover:bg-indigo-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Creating account..." : "Sign Up"}
            </button>

            <p className="text-sm text-slate-300">
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-indigo-200 underline decoration-indigo-400/70 underline-offset-2">
                Log In
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