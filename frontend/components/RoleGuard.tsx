"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser, type UserRole } from "@/hooks/useUser";

interface Props {
  children: React.ReactNode;
  roles: UserRole[];
  redirect?: string;
}

export default function RoleGuard({ children, roles, redirect = "/unauthorized" }: Props) {
  const { profile, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    // Middleware already redirects unauthenticated users to /auth/login.
    // Here we only handle the wrong-role case.
    if (profile && !roles.includes(profile.role)) {
      router.replace(redirect);
    }
  }, [loading, profile, roles, redirect, router]);

  // Show spinner while loading or while we have no profile yet.
  // Never redirect to login from here — that causes the flash.
  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!roles.includes(profile.role)) {
    return null;
  }

  return <>{children}</>;
}
