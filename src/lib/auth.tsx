import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "teacher";

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  school_id: string | null;
  role: AppRole;
};

export type School = {
  id: string;
  name: string;
  slug: string;
};

type AuthContextValue = {
  loading: boolean;
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  school: School | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function loadProfileAndSchool(userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, school_id, role")
    .eq("id", userId)
    .maybeSingle();

  let school: School | null = null;
  if (profile?.school_id) {
    const { data: s } = await supabase
      .from("schools")
      .select("id, name, slug")
      .eq("id", profile.school_id)
      .maybeSingle();
    school = s ?? null;
  }
  return { profile: (profile as Profile) ?? null, school };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [school, setSchool] = useState<School | null>(null);

  const hydrate = async (s: Session | null) => {
    setSession(s);
    setUser(s?.user ?? null);
    if (s?.user) {
      const { profile, school } = await loadProfileAndSchool(s.user.id);
      setProfile(profile);
      setSchool(school);
    } else {
      setProfile(null);
      setSchool(null);
    }
  };

  useEffect(() => {
    // Set up listener FIRST
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      // Defer Supabase calls to avoid deadlock inside the callback
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => {
          loadProfileAndSchool(s.user.id).then(({ profile, school }) => {
            setProfile(profile);
            setSchool(school);
          });
        }, 0);
      } else {
        setProfile(null);
        setSchool(null);
      }
    });

    // THEN check existing session
    supabase.auth.getSession().then(async ({ data }) => {
      await hydrate(data.session);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const refresh = async () => {
    if (user) {
      const { profile, school } = await loadProfileAndSchool(user.id);
      setProfile(profile);
      setSchool(school);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ loading, user, session, profile, school, refresh, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}