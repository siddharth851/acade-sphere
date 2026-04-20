import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Protected } from "@/components/app/Protected";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/students")({
  head: () => ({ meta: [{ title: "Students — EduManage" }] }),
  component: () => <Protected><Students /></Protected>,
});

type Klass = { id: string; name: string };
type Student = { id: string; full_name: string; roll_no: string; class_id: string | null };

function Students() {
  const { profile, school } = useAuth();
  const isAdmin = profile?.role === "admin";
  const [classes, setClasses] = useState<Klass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState({ full_name: "", roll_no: "", class_id: "" });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [c, s] = await Promise.all([
      supabase.from("classes").select("id, name").order("name"),
      supabase.from("students").select("id, full_name, roll_no, class_id").order("full_name"),
    ]);
    setClasses((c.data as Klass[]) ?? []);
    setStudents((s.data as Student[]) ?? []);
  };

  useEffect(() => { if (school) load(); }, [school]);

  const openCreate = () => {
    setEditing(null);
    setForm({ full_name: "", roll_no: "", class_id: classes[0]?.id ?? "" });
    setOpen(true);
  };
  const openEdit = (st: Student) => {
    setEditing(st);
    setForm({ full_name: st.full_name, roll_no: st.roll_no, class_id: st.class_id ?? "" });
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!school) return;
    setBusy(true);
    const payload = {
      full_name: form.full_name,
      roll_no: form.roll_no,
      class_id: form.class_id || null,
      school_id: school.id,
    };
    const { error } = editing
      ? await supabase.from("students").update(payload).eq("id", editing.id)
      : await supabase.from("students").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Student updated" : "Student added");
    setOpen(false); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this student?")) return;
    const { error } = await supabase.from("students").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Student deleted");
    load();
  };

  const filtered = students.filter((s) => {
    if (filter !== "all" && s.class_id !== filter) return false;
    if (search && !`${s.full_name} ${s.roll_no}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const classMap = Object.fromEntries(classes.map((c) => [c.id, c.name]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Students</h1>
          <p className="text-muted-foreground mt-1">{students.length} student{students.length === 1 ? "" : "s"} in your school.</p>
        </div>
        {isAdmin && <Button onClick={openCreate} disabled={classes.length === 0}><Plus className="h-4 w-4 mr-2" /> Add student</Button>}
      </div>

      {classes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Create a class first before adding students.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-3">
            <Input placeholder="Search by name or roll no…" value={search} onChange={(e) => setSearch(e.target.value)} className="sm:max-w-xs" />
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All classes</SelectItem>
                {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Roll no</TableHead>
                  <TableHead>Class</TableHead>
                  {isAdmin && <TableHead className="w-24 text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={isAdmin ? 4 : 3} className="text-center text-muted-foreground py-12">No students match.</TableCell></TableRow>
                ) : filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.full_name}</TableCell>
                    <TableCell className="text-muted-foreground">{s.roll_no}</TableCell>
                    <TableCell className="text-muted-foreground">{s.class_id ? classMap[s.class_id] : "—"}</TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit student" : "Add student"}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fn">Full name</Label>
              <Input id="fn" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rn">Roll number</Label>
              <Input id="rn" required value={form.roll_no} onChange={(e) => setForm({ ...form, roll_no: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Class</Label>
              <Select value={form.class_id} onValueChange={(v) => setForm({ ...form, class_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>
                  {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter><Button type="submit" disabled={busy}>{editing ? "Save" : "Add"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}