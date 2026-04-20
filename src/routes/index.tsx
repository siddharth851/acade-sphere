import { createFileRoute, Link } from "@tanstack/react-router";
import { GraduationCap, Users, ClipboardCheck, Shield, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EduManage — Modern School Management SaaS" },
      {
        name: "description",
        content: "Run your school or college on EduManage — multi-tenant student records, attendance, and class management with bank-grade isolation.",
      },
      { property: "og:title", content: "EduManage — Modern School Management SaaS" },
      { property: "og:description", content: "Multi-tenant student records, attendance, and classes — beautifully simple." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-subtle)" }}>
      <header className="border-b border-border/60 bg-background/70 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: "var(--gradient-primary)" }}>
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold">EduManage</span>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm"><Link to="/login">Sign in</Link></Button>
            <Button asChild size="sm"><Link to="/signup">Get started</Link></Button>
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 pt-20 pb-24 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground mb-6 shadow-sm">
          <Sparkles className="h-3 w-3 text-primary" /> Multi-tenant. Secure by design.
        </div>
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight max-w-3xl mx-auto leading-[1.05]">
          The school operating system, <span style={{ background: "var(--gradient-hero)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>reimagined.</span>
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
          EduManage gives your institution a clean, modern dashboard to manage students, classes, and attendance — with isolated data per school.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button asChild size="lg" className="shadow-lg" style={{ background: "var(--gradient-primary)" }}>
            <Link to="/signup">Create your school <ArrowRight className="h-4 w-4 ml-2" /></Link>
          </Button>
          <Button asChild size="lg" variant="outline"><Link to="/login">Sign in</Link></Button>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-24 grid md:grid-cols-3 gap-6">
        {[
          { icon: Users, title: "Student records", desc: "A clean roster per class, with roll numbers and instant search." },
          { icon: ClipboardCheck, title: "Daily attendance", desc: "Mark present, absent or late in seconds. Filter history by date and class." },
          { icon: Shield, title: "Tenant isolation", desc: "Row-level security ensures each school only ever sees its own data." },
        ].map((f) => (
          <div key={f.title} className="rounded-xl border border-border bg-card p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center mb-4">
              <f.icon className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-semibold mb-1">{f.title}</h3>
            <p className="text-sm text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} EduManage. Built for modern institutions.
      </footer>
    </div>
  );
}
