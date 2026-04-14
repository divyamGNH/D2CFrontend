"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const PUBLIC_ROUTES = new Set(["/login", "/signup"]);

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:8080";

  const isPublicRoute = useMemo(() => {
    return PUBLIC_ROUTES.has(pathname || "");
  }, [pathname]);

  useEffect(() => {
    let active = true;

    const runAuthCheck = async () => {
      if (isPublicRoute) {
        if (active) setIsChecking(false);
        return;
      }

      const accessToken = localStorage.getItem("accessToken");
      const refreshToken = localStorage.getItem("refreshToken");

      if (!accessToken) {
        router.replace("/login");
        if (active) setIsChecking(false);
        return;
      }

      const verifyWithToken = async (token: string) => {
        return fetch(`${baseUrl}/auth/me`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
      };

      let verifyRes = await verifyWithToken(accessToken);

      if (verifyRes.status === 401 && refreshToken) {
        const refreshRes = await fetch(`${baseUrl}/auth/refresh`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ refreshToken }),
        });

        if (refreshRes.ok) {
          const refreshed = await refreshRes.json();
          if (refreshed?.accessToken && refreshed?.refreshToken) {
            localStorage.setItem("accessToken", refreshed.accessToken);
            localStorage.setItem("refreshToken", refreshed.refreshToken);
            verifyRes = await verifyWithToken(refreshed.accessToken);
          }
        }
      }

      if (!verifyRes.ok) {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        router.replace("/login");
      }

      if (active) setIsChecking(false);
    };

    void runAuthCheck();

    return () => {
      active = false;
    };
  }, [baseUrl, isPublicRoute, router]);

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-gray-600">Checking session...</div>
      </div>
    );
  }

  return <>{children}</>;
}
