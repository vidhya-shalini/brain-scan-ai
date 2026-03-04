
-- Drop all RESTRICTIVE policies and recreate as PERMISSIVE

-- PATIENTS
DROP POLICY IF EXISTS "Authenticated users can view patients" ON public.patients;
DROP POLICY IF EXISTS "Authenticated users can create patients" ON public.patients;
DROP POLICY IF EXISTS "Authenticated users can update patients" ON public.patients;
DROP POLICY IF EXISTS "Authenticated users can delete patients" ON public.patients;

CREATE POLICY "Auth users can view patients" ON public.patients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert patients" ON public.patients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update patients" ON public.patients FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth users can delete patients" ON public.patients FOR DELETE TO authenticated USING (true);

-- MRI_UPLOADS
DROP POLICY IF EXISTS "Authenticated users can view uploads" ON public.mri_uploads;
DROP POLICY IF EXISTS "Authenticated users can create uploads" ON public.mri_uploads;
DROP POLICY IF EXISTS "Authenticated users can delete uploads" ON public.mri_uploads;

CREATE POLICY "Auth users can view uploads" ON public.mri_uploads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert uploads" ON public.mri_uploads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can delete uploads" ON public.mri_uploads FOR DELETE TO authenticated USING (true);

-- PREDICTIONS
DROP POLICY IF EXISTS "Authenticated users can view predictions" ON public.predictions;
DROP POLICY IF EXISTS "Authenticated users can create predictions" ON public.predictions;
DROP POLICY IF EXISTS "Authenticated users can update predictions" ON public.predictions;

CREATE POLICY "Auth users can view predictions" ON public.predictions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert predictions" ON public.predictions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update predictions" ON public.predictions FOR UPDATE TO authenticated USING (true);

-- METRICS
DROP POLICY IF EXISTS "Authenticated users can view metrics" ON public.metrics;
DROP POLICY IF EXISTS "Authenticated users can create metrics" ON public.metrics;

CREATE POLICY "Auth users can view metrics" ON public.metrics FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert metrics" ON public.metrics FOR INSERT TO authenticated WITH CHECK (true);

-- PROFILES
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "View own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- USER_ROLES
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

CREATE POLICY "View own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- CONTACT_MESSAGES
DROP POLICY IF EXISTS "Authenticated users can create messages" ON public.contact_messages;
DROP POLICY IF EXISTS "Users can view own messages" ON public.contact_messages;

CREATE POLICY "Insert messages" ON public.contact_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "View own messages" ON public.contact_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
