-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'teacher');
CREATE TYPE public.attendance_status AS ENUM ('present', 'absent', 'late');

-- =========================================================
-- SHARED: updated_at trigger function
-- =========================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =========================================================
-- SCHOOLS
-- =========================================================
CREATE TABLE public.schools (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  owner_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER schools_updated_at
BEFORE UPDATE ON public.schools
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- PROFILES (one per auth user)
-- =========================================================
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  role public.app_role NOT NULL DEFAULT 'teacher',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- SECURITY DEFINER HELPERS (avoid recursive RLS)
-- =========================================================
CREATE OR REPLACE FUNCTION public.current_school_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT school_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_role()
RETURNS public.app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- =========================================================
-- INVITES (pending teacher/admin invites)
-- =========================================================
CREATE TABLE public.invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role public.app_role NOT NULL DEFAULT 'teacher',
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  invited_by UUID NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
CREATE INDEX invites_school_id_idx ON public.invites(school_id);
CREATE INDEX invites_token_idx ON public.invites(token);

-- =========================================================
-- CLASSES
-- =========================================================
CREATE TABLE public.classes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  grade TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, name)
);
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
CREATE INDEX classes_school_id_idx ON public.classes(school_id);

CREATE TRIGGER classes_updated_at
BEFORE UPDATE ON public.classes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- STUDENTS
-- =========================================================
CREATE TABLE public.students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  roll_no TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, class_id, roll_no)
);
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE INDEX students_school_id_idx ON public.students(school_id);
CREATE INDEX students_class_id_idx ON public.students(class_id);

CREATE TRIGGER students_updated_at
BEFORE UPDATE ON public.students
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- ATTENDANCE
-- =========================================================
CREATE TABLE public.attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  status public.attendance_status NOT NULL DEFAULT 'present',
  marked_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, date)
);
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE INDEX attendance_school_id_idx ON public.attendance(school_id);
CREATE INDEX attendance_date_idx ON public.attendance(date);
CREATE INDEX attendance_class_date_idx ON public.attendance(class_id, date);

CREATE TRIGGER attendance_updated_at
BEFORE UPDATE ON public.attendance
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- RLS POLICIES
-- =========================================================

-- SCHOOLS: members can read their school; owner created via signup function (bypasses RLS).
CREATE POLICY "Members can view their school"
ON public.schools FOR SELECT
TO authenticated
USING (id = public.current_school_id());

CREATE POLICY "Admins can update their school"
ON public.schools FOR UPDATE
TO authenticated
USING (id = public.current_school_id() AND public.is_admin());

-- PROFILES: a user can see their own profile + others in same school.
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "Users can view profiles in their school"
ON public.profiles FOR SELECT
TO authenticated
USING (school_id IS NOT NULL AND school_id = public.current_school_id());

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid());

-- INVITES: admins manage invites in their school.
CREATE POLICY "Admins manage invites in their school"
ON public.invites FOR ALL
TO authenticated
USING (school_id = public.current_school_id() AND public.is_admin())
WITH CHECK (school_id = public.current_school_id() AND public.is_admin());

-- CLASSES
CREATE POLICY "Members read classes"
ON public.classes FOR SELECT
TO authenticated
USING (school_id = public.current_school_id());

CREATE POLICY "Admins insert classes"
ON public.classes FOR INSERT
TO authenticated
WITH CHECK (school_id = public.current_school_id() AND public.is_admin());

CREATE POLICY "Admins update classes"
ON public.classes FOR UPDATE
TO authenticated
USING (school_id = public.current_school_id() AND public.is_admin());

CREATE POLICY "Admins delete classes"
ON public.classes FOR DELETE
TO authenticated
USING (school_id = public.current_school_id() AND public.is_admin());

-- STUDENTS
CREATE POLICY "Members read students"
ON public.students FOR SELECT
TO authenticated
USING (school_id = public.current_school_id());

CREATE POLICY "Admins insert students"
ON public.students FOR INSERT
TO authenticated
WITH CHECK (school_id = public.current_school_id() AND public.is_admin());

CREATE POLICY "Admins update students"
ON public.students FOR UPDATE
TO authenticated
USING (school_id = public.current_school_id() AND public.is_admin());

CREATE POLICY "Admins delete students"
ON public.students FOR DELETE
TO authenticated
USING (school_id = public.current_school_id() AND public.is_admin());

-- ATTENDANCE: any member can mark and read; only admins can delete.
CREATE POLICY "Members read attendance"
ON public.attendance FOR SELECT
TO authenticated
USING (school_id = public.current_school_id());

CREATE POLICY "Members insert attendance"
ON public.attendance FOR INSERT
TO authenticated
WITH CHECK (school_id = public.current_school_id());

CREATE POLICY "Members update attendance"
ON public.attendance FOR UPDATE
TO authenticated
USING (school_id = public.current_school_id());

CREATE POLICY "Admins delete attendance"
ON public.attendance FOR DELETE
TO authenticated
USING (school_id = public.current_school_id() AND public.is_admin());

-- =========================================================
-- SIGNUP FLOW: profile auto-creation + tenant assignment
-- =========================================================

-- When a school signs up, raw_user_meta_data carries:
--   { signup_kind: 'school', school_name: '...', full_name: '...' }
-- When a teacher accepts an invite, raw_user_meta_data carries:
--   { signup_kind: 'invite', invite_token: '...', full_name: '...' }
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind TEXT := NEW.raw_user_meta_data ->> 'signup_kind';
  v_full_name TEXT := COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1));
  v_school_name TEXT := NEW.raw_user_meta_data ->> 'school_name';
  v_token TEXT := NEW.raw_user_meta_data ->> 'invite_token';
  v_school_id UUID;
  v_role public.app_role := 'teacher';
  v_slug TEXT;
  v_invite RECORD;
BEGIN
  IF v_kind = 'school' AND v_school_name IS NOT NULL THEN
    -- Build a unique slug
    v_slug := regexp_replace(lower(v_school_name), '[^a-z0-9]+', '-', 'g');
    v_slug := trim(both '-' from v_slug);
    IF v_slug = '' THEN v_slug := 'school'; END IF;
    v_slug := v_slug || '-' || substr(replace(NEW.id::text, '-', ''), 1, 6);

    INSERT INTO public.schools (name, slug, owner_id)
    VALUES (v_school_name, v_slug, NEW.id)
    RETURNING id INTO v_school_id;

    v_role := 'admin';

  ELSIF v_kind = 'invite' AND v_token IS NOT NULL THEN
    SELECT * INTO v_invite
    FROM public.invites
    WHERE token = v_token AND accepted_at IS NULL
    LIMIT 1;

    IF FOUND AND lower(v_invite.email) = lower(NEW.email) THEN
      v_school_id := v_invite.school_id;
      v_role := v_invite.role;
      UPDATE public.invites SET accepted_at = now() WHERE id = v_invite.id;
    END IF;
  END IF;

  INSERT INTO public.profiles (id, full_name, email, school_id, role)
  VALUES (NEW.id, v_full_name, NEW.email, v_school_id, v_role);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();