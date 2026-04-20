import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Protected } from "@/components/app/Protected";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck, Save } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type AttStatus = "present" | "absent" | "late";
type Student = { id: string; full_name: string; roll_no: string; class_id: string | null };
type Klass = { id: string; name: string };
type AttRow = { id: string; student_id: string; class_id: string | null; date: string; status: AttStatus };

export const Route = createFileRoute("/attendance")({
  head: () => ({ meta: [{ title: "Attendance — EduManage" }] }),
  component: () => <Protected><Attendance /></Protected>,
});

function Attendance() {
  const { school } = useAuth();
  const [classes, setClasses] = useState<Klass[]>([]);
  const [classId, setClassId] = useState<string>("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [students, setStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<Record<string, AttStatus>>({});
  const [busy, setBusy] = useState(false);

  // History
  const [hClass, setHClass] = useState<string>("all");
  const [hFrom, setHFrom] = useState(format(new Date(Date.now() - 7 * 86400000), "yyyy-MM-dd"));
  const [hTo, setHTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [history, setHistory] = useState<AttRow[]>([]);
  const [historyStudents, setHistoryStudents] = useState<Record<string, Student>>({});

  useEffect(() => {
    if (!school) return;
    supabase.from("classes").select("id, name").order("name").then(({ data }) => {
      const list = (data as Klass[]) ?? [];
      setClasses(list);
      if (list[0] && !classId) setClassId(list[0].id);
    });
  }, [school]);

  useEffect(() => {
    if (!classId) return;
    (async () => {
      const { data: st } = await supabase.from("students").select("id, full_name, roll_no, class_id").eq("class_id", classId).order("roll_no");
      const list = (st as Student[]) ?? [];
      setStudents(list);
      const { data: existing } = await supabase
        .from("attendance").select("id, student_id, class_id, date, status").eq("date", date).eq("class_id", classId);
      const map: Record<string, AttStatus> = {};
      list.forEach((s) => { map[s.id] = "present"; });
      ((existing as AttRow[]) ?? []).forEach((r) => { map[r.student_id] = r.status; });
      setMarks(map);
    })();
  }, [classId, date]);

  const setMark = (id: string, status: AttStatus) => setMarks((m) => ({ ...m, [id]: status }));

  const save = async () => {
    if (!school || !classId) return;
    setBusy(true);
    const rows = students.map((s) => ({
      school_id: school.id,
      student_id: s.id,
      class_id: classId,
      date,
      status: marks[s.id] ?? "present",
    }));
    const { error } = await supabase.from("attendance").upsert(rows, { onConflict: "student_id,date" });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Attendance saved for ${rows.length} students`);
  };

  const loadHistory = async () => {
    let q = supabase.from("attendance").select("id, student_id, class_id, date, status").gte("date", hFrom).lte("date", hTo).order("date", { ascending: false });
    if (hClass !== "all") q = q.eq("class_id", hClass);
    const { data } = await q;
    const rows = (data as AttRow[]) ?? [];
    setHistory(rows);
    const ids = Array.from(new Set(rows.map((r) => r.student_id)));
    if (ids.length) {
      const { data: ss } = await supabase.from("students").select("id, full_name, roll_no, class_id").in("id", ids);
      const map: Record<string, Student> = {};
      ((ss as Student[]) ?? []).forEach((s) => { map[s.id] = s; });
      setHistoryStudents(map);
    } else setHistoryStudents({});
  };

  useEffect(() => { if (school) loadHistory(); }, [school, hClass, hFrom, hTo]);

  const summary = useMemo(() => {
    const present = Object.values(marks).filter((v) => v === "present").length;
    const absent = Object.values(marks).filter((v) => v === "absent").length;
    const late = Object.values(marks).filter((v) => v === "late").length;
    return { present, absent, late };
  }, [marks]);

  const classMap = Object.fromEntries(classes.map((c) => [c.id, c.name]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Attendance</h1>
        <p className="text-muted-foreground mt-1">Mark daily attendance and review history.</p>
      </div>

      <Tabs defaultValue="mark">
        <TabsList>
          <TabsTrigger value="mark">Mark</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="mark" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger className="sm:w-56"><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>
                {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="sm:w-48" />
            <div className="flex-1" />
            <Button onClick={save} disabled={busy || students.length === 0}><Save className="h-4 w-4 mr-2" /> Save attendance</Button>
          </div>

          {classes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
              <ClipboardCheck className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Create a class and add students to mark attendance.</p>
            </div>
          ) : students.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground">No students in this class.</div>
          ) : (
            <>
              <div className="flex gap-2 text-sm">
                <Badge variant="outline" className="border-success/30 text-success">Present {summary.present}</Badge>
                <Badge variant="outline" className="border-destructive/30 text-destructive">Absent {summary.absent}</Badge>
                <Badge variant="outline" className="border-warning/30 text-warning">Late {summary.late}</Badge>
              </div>
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Roll</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((s) => {
                      const status = marks[s.id] ?? "present";
                      return (
                        <TableRow key={s.id}>
                          <TableCell className="text-muted-foreground">{s.roll_no}</TableCell>
                          <TableCell className="font-medium">{s.full_name}</TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex rounded-md border border-border overflow-hidden">
                              {(["present", "absent", "late"] as AttStatus[]).map((opt) => (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => setMark(s.id, opt)}
                                  className={
                                    "px-3 py-1.5 text-xs capitalize transition-colors " +
                                    (status === opt
                                      ? opt === "present"
                                        ? "bg-success text-success-foreground"
                                        : opt === "absent"
                                          ? "bg-destructive text-destructive-foreground"
                                          : "bg-warning text-warning-foreground"
                                      : "bg-card hover:bg-muted text-muted-foreground")
                                  }
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={hClass} onValueChange={setHClass}>
              <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All classes</SelectItem>
                {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="date" value={hFrom} onChange={(e) => setHFrom(e.target.value)} className="sm:w-48" />
            <Input type="date" value={hTo} onChange={(e) => setHTo(e.target.value)} className="sm:w-48" />
          </div>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-12">No records in this range.</TableCell></TableRow>
                ) : history.map((r) => {
                  const s = historyStudents[r.student_id];
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-muted-foreground">{r.date}</TableCell>
                      <TableCell className="font-medium">{s ? `${s.full_name} (${s.roll_no})` : "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{r.class_id ? classMap[r.class_id] : "—"}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className={
                          r.status === "present" ? "border-success/30 text-success" :
                          r.status === "absent" ? "border-destructive/30 text-destructive" :
                          "border-warning/30 text-warning"
                        }>{r.status}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}