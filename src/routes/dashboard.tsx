import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Protected } from "@/components/app/Protected";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Users, GraduationCap, ClipboardCheck, TrendingUp } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — EduManage" }] }),
  component: () => (
    <Protected>
      <Dashboard />
    </Protected>
  ),
});

type Stats = {
  students: number;
  classes: number;
  presentToday: number;
  absentToday: number;
};

function Dashboard() {
  const { school, profile } = useAuth();
  const [stats, setStats] = useState<Stats>({ students: 0, classes: 0, presentToday: 0, absentToday: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!school) return;
    (async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const [s, c, p, a] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }),
        supabase.from("classes").select("id", { count: "exact", head: true }),
        supabase.from("attendance").select("id", { count: "exact", head: true }).eq("date", today).eq("status", "present"),
        supabase.from("attendance").select("id", { count: "exact", head: true }).eq("date", today).eq("status", "absent"),
      ]);
      setStats({
        students: s.count ?? 0,
        classes: c.count ?? 0,
        presentToday: p.count ?? 0,
        absentToday: a.count ?? 0,
      });
      setLoading(false);
    })();
  }, [school]);

  const cards = [
    { label: "Total students", value: stats.students, icon: Users, accent: "text-primary" },
    { label: "Classes", value: stats.classes, icon: GraduationCap, accent: "text-primary" },
    { label: "Present today", value: stats.presentToday, icon: ClipboardCheck, accent: "text-success" },
    { label: "Absent today", value: stats.absentToday, icon: TrendingUp, accent: "text-destructive" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Welcome back, {profile?.full_name?.split(" ")[0] || "there"} 👋</h1>
        <p className="text-muted-foreground mt-1">Here's what's happening at {school?.name} today.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{c.label}</span>
              <c.icon className={`h-4 w-4 ${c.accent}`} />
            </div>
            <div className="mt-3 text-3xl font-semibold">{loading ? "—" : c.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="font-semibold mb-1">Quick start</h2>
        <p className="text-sm text-muted-foreground mb-4">Get your school set up in three steps.</p>
        <ol className="space-y-2 text-sm">
          <li>1. Create a class in <span className="text-primary font-medium">Classes</span>.</li>
          <li>2. Add students with their roll numbers in <span className="text-primary font-medium">Students</span>.</li>
          <li>3. Mark daily attendance in <span className="text-primary font-medium">Attendance</span>.</li>
        </ol>
      </div>
    </div>
  );
}