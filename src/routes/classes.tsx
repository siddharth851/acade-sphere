import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Protected } from "@/components/app/Protected";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, GraduationCap } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/classes")({
  head: () => ({ meta: [{ title: "Classes — EduManage" }] }),
  component: () => <Protected><Classes /></Protected>,
});

type Klass = { id: string; name: string; grade: string | null };

function Classes() {
  const { profile, school } = useAuth();
  const isAdmin = profile?.role === "admin";
  const [rows, setRows] = useState<Klass[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("classes").select("id, name, grade").order("name");
    setRows((data as Klass[]) ?? []);
  };

  useEffect(() => { if (school) load(); }, [school]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!school) return;
    setBusy(true);
    const { error } = await supabase.from("classes").insert({ name, grade: grade || null, school_id: school.id });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Class created");
    setOpen(false); setName(""); setGrade(""); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this class? Students will be unassigned.")) return;
    const { error } = await supabase.from("classes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Class deleted");
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Classes</h1>
          <p className="text-muted-foreground mt-1">Organize students into class groups.</p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> New class</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create class</DialogTitle></DialogHeader>
              <form onSubmit={create} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cname">Class name</Label>
                  <Input id="cname" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Grade 10 - A" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="grade">Grade (optional)</Label>
                  <Input id="grade" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="10" />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={busy}>Create</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <GraduationCap className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No classes yet. {isAdmin ? "Create your first class to get started." : "Ask an admin to create classes."}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((c) => (
            <div key={c.id} className="rounded-xl border border-border bg-card p-5 shadow-sm flex items-center justify-between">
              <div>
                <div className="font-semibold">{c.name}</div>
                {c.grade && <div className="text-sm text-muted-foreground">Grade {c.grade}</div>}
              </div>
              {isAdmin && (
                <Button variant="ghost" size="icon" onClick={() => remove(c.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}