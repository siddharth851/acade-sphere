import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Protected } from "@/components/app/Protected";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Copy, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — EduManage" }] }),
  component: () => <Protected><Settings /></Protected>,
});

type Invite = { id: string; email: string; role: "admin" | "teacher"; token: string; accepted_at: string | null; created_at: string };
type Member = { id: string; full_name: string; email: string; role: "admin" | "teacher" };

function Settings() {
  const { profile, school } = useAuth();
  const isAdmin = profile?.role === "admin";
  const [invites, setInvites] = useState<Invite[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "teacher">("teacher");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [i, m] = await Promise.all([
      isAdmin ? supabase.from("invites").select("id, email, role, token, accepted_at, created_at").order("created_at", { ascending: false }) : Promise.resolve({ data: [] as Invite[] }),
      supabase.from("profiles").select("id, full_name, email, role").order("created_at"),
    ]);
    setInvites((i.data as Invite[]) ?? []);
    setMembers((m.data as Member[]) ?? []);
  };
  useEffect(() => { if (school) load(); }, [school, isAdmin]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!school || !profile) return;
    setBusy(true);
    const { error } = await supabase.from("invites").insert({ email, role, school_id: school.id, invited_by: profile.id });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Invite created");
    setEmail(""); load();
  };

  const revoke = async (id: string) => {
    const { error } = await supabase.from("invites").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Invite revoked");
    load();
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Invite link copied");
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your school and team.</p>
      </div>

      <section className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-2">
        <h2 className="font-semibold">School</h2>
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div><div className="text-muted-foreground">Name</div><div className="font-medium">{school?.name}</div></div>
          <div><div className="text-muted-foreground">Tenant slug</div><div className="font-mono text-xs">{school?.slug}</div></div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="font-semibold mb-4">Team members ({members.length})</h2>
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead></TableRow></TableHeader>
          <TableBody>
            {members.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.full_name || "—"}</TableCell>
                <TableCell className="text-muted-foreground">{m.email}</TableCell>
                <TableCell><Badge variant={m.role === "admin" ? "default" : "secondary"} className="capitalize">{m.role}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      {isAdmin && (
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="font-semibold mb-1">Invite teachers & admins</h2>
          <p className="text-sm text-muted-foreground mb-4">Generate an invite link they can use to join your school.</p>
          <form onSubmit={create} className="flex flex-col sm:flex-row gap-3 mb-6">
            <Input type="email" required placeholder="teacher@school.com" value={email} onChange={(e) => setEmail(e.target.value)} className="flex-1" />
            <Select value={role} onValueChange={(v) => setRole(v as "admin" | "teacher")}>
              <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="teacher">Teacher</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" disabled={busy}><Plus className="h-4 w-4 mr-2" /> Create invite</Button>
          </form>

          <Table>
            <TableHeader><TableRow><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {invites.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No invites yet.</TableCell></TableRow>
              ) : invites.map((i) => (
                <TableRow key={i.id}>
                  <TableCell>{i.email}</TableCell>
                  <TableCell className="capitalize">{i.role}</TableCell>
                  <TableCell>
                    {i.accepted_at
                      ? <Badge className="bg-success text-success-foreground">Accepted</Badge>
                      : <Badge variant="outline">Pending</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    {!i.accepted_at && (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => copyLink(i.token)}><Copy className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => revoke(i.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}
    </div>
  );
}