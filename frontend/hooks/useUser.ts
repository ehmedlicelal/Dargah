"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type UserRole = "citizen" | "operator" | "admin";

export interface UserProfile {
  id: string;
  email: string | undefined;
  full_name: string | null;
  role: UserRole;
}

export function useUser() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading]  = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!mounted) return;
        if (!user) {
          // Truly signed out — clear profile and stop loading
          setProfile(null);
          setLoading(false);
          return;
        }

        const { data } = await supabase
          .from("users")
          .select("role, full_name")
          .eq("id", user.id)
          .single();

        if (!mounted) return;
        setProfile({
          id: user.id,
          email: user.email,
          full_name: data?.full_name ?? null,
          role: (data?.role as UserRole) ?? "citizen",
        });
      } catch {
        // Network error — don't clear an existing profile, just stop loading.
        // The user stays on the page; they'll hit the middleware redirect on
        // the next navigation if the session is truly gone.
        if (mounted && profile === null) setProfile(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      // On sign-out clear immediately; on other events just refresh silently.
      if (event === "SIGNED_OUT") {
        setProfile(null);
        setLoading(false);
        return;
      }
      // Don't set loading=true here — avoids the spinner flash during
      // token refresh while navigating between admin pages.
      load();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    profile,
    loading,
    isLoggedIn:  !!profile,
    isAdmin:     profile?.role === "admin",
    isOperator:  profile?.role === "operator",
    isCitizen:   profile?.role === "citizen",
    isStaff:     profile?.role === "admin" || profile?.role === "operator",
  };
}
