import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { AppShell } from "./AppShell";
import { Loader2 } from "lucide-react";

export function Protected({ children }: { children: React.ReactNode }) {
  const { loading, user, profile } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login", search: { redirect: path } });
      return;
    }
    if (user && profile && !profile.school_id) {
      // User exists but no school — bounce them to onboarding
      if (path !== "/onboarding") navigate({ to: "/onboarding" });
    }
  }, [loading, user, profile, navigate, path]);

  if (loading || !user || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile.school_id) {
    return <>{children}</>;
  }

  return <AppShell>{children}</AppShell>;
}