import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen px-6 py-10 sm:px-10 lg:px-16">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-16">
        <header className="flex items-center justify-between border-b border-(--border) pb-5">
          <div className="text-lg font-semibold tracking-tight">D2C Video Call</div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-md border border-(--border) px-4 py-2 text-sm text-(--text) hover:bg-(--surface)"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-(--accent) px-4 py-2 text-sm font-medium text-white hover:bg-(--accent-strong)"
            >
              Create Account
            </Link>
          </div>
        </header>

        <section className="grid gap-8 lg:grid-cols-[1.3fr_1fr] lg:items-end">
          <div className="space-y-6">
            <p className="inline-flex rounded-md border border-(--border) bg-(--surface) px-3 py-1 text-xs font-medium tracking-wide text-(--text-muted)">
              Remote Collaboration
            </p>
            <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-(--text) sm:text-5xl">
              Reliable video rooms for fast team communication.
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-(--text-muted) sm:text-lg">
              Start private rooms, share room IDs, and connect with low-latency
              audio and video from a clean workspace.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="rounded-md bg-(--accent) px-5 py-2.5 text-sm font-medium text-white hover:bg-(--accent-strong)"
              >
                Get Started
              </Link>
              <Link
                href="/login"
                className="rounded-md border border-(--border) bg-(--surface) px-5 py-2.5 text-sm font-medium text-(--text) hover:bg-(--surface-elevated)"
              >
                I already have an account
              </Link>
            </div>
          </div>

          <aside className="rounded-xl border border-(--border) bg-(--surface) p-6">
            <h2 className="text-lg font-semibold">What you get</h2>
            <ul className="mt-4 space-y-3 text-sm text-(--text-muted)">
              <li>Browser-based calling with secure authentication</li>
              <li>Quick room creation and one-step room joining</li>
              <li>Live peer updates as participants enter or leave</li>
            </ul>
          </aside>
        </section>
      </main>
    </div>
  );
}
