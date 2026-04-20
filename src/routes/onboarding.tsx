import { createFileRoute } from "@tanstack/react-router";
import { Protected } from "@/components/app/Protected";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Welcome — EduManage" }] }),
  component: () => (
    <Protected>
      <Onboarding />
    </Protected>
  ),
});

function Onboarding() {
  const { profile, signOut } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--gradient-subtle)" }}>
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 shadow-lg text-center">
        <h1 className="text-2xl font-semibold">No school assigned</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Hi {profile?.full_name || profile?.email}, your account isn't linked to a school yet. Ask your administrator to send you an invite.
        </p>
        <Button variant="outline" className="mt-6" onClick={() => signOut()}>Sign out</Button>
      </div>
    </div>
  );
}