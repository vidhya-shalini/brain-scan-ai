
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'doctor', 'radiologist');

-- Create headache severity enum
CREATE TYPE public.headache_severity AS ENUM ('Mild', 'Medium', 'Severe');

-- Create severity level enum  
CREATE TYPE public.severity_level AS ENUM ('RED', 'YELLOW', 'GREEN');

-- Create tumor type enum
CREATE TYPE public.tumor_type AS ENUM ('Glioma', 'Meningioma', 'Pituitary', 'NoTumor');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Patients table
CREATE TABLE public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id TEXT UNIQUE NOT NULL,
  patient_name TEXT NOT NULL,
  age INT NOT NULL,
  gender TEXT NOT NULL,
  seizure BOOLEAN NOT NULL DEFAULT false,
  headache_severity headache_severity NOT NULL DEFAULT 'Mild',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- MRI uploads table
CREATE TABLE public.mri_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  image_path TEXT NOT NULL,
  upload_order INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Predictions table
CREATE TABLE public.predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  tumor_present BOOLEAN NOT NULL DEFAULT false,
  tumor_type tumor_type NOT NULL DEFAULT 'NoTumor',
  probabilities JSONB,
  gradcam_path TEXT,
  severity_level severity_level NOT NULL DEFAULT 'GREEN',
  queue_rank INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Metrics table
CREATE TABLE public.metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id UUID REFERENCES public.predictions(id) ON DELETE CASCADE NOT NULL,
  precision FLOAT,
  recall FLOAT,
  f1_score FLOAT,
  support FLOAT,
  accuracy FLOAT,
  recall_sensitivity FLOAT,
  specificity FLOAT,
  roc_auc FLOAT,
  tp INT,
  tn INT,
  fp INT,
  fn INT,
  confusion_matrix_path TEXT,
  roc_curve_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Contact messages table
CREATE TABLE public.contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mri_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  -- Default role: doctor
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'doctor');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies

-- Profiles: users can read/update their own
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User roles: users can view their own roles
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- Patients: authenticated users can CRUD
CREATE POLICY "Authenticated users can view patients" ON public.patients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create patients" ON public.patients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update patients" ON public.patients FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete patients" ON public.patients FOR DELETE TO authenticated USING (true);

-- MRI uploads: authenticated users can CRUD
CREATE POLICY "Authenticated users can view uploads" ON public.mri_uploads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create uploads" ON public.mri_uploads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can delete uploads" ON public.mri_uploads FOR DELETE TO authenticated USING (true);

-- Predictions: authenticated users can CRUD
CREATE POLICY "Authenticated users can view predictions" ON public.predictions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create predictions" ON public.predictions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update predictions" ON public.predictions FOR UPDATE TO authenticated USING (true);

-- Metrics: authenticated users can view/create
CREATE POLICY "Authenticated users can view metrics" ON public.metrics FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create metrics" ON public.metrics FOR INSERT TO authenticated WITH CHECK (true);

-- Contact messages: authenticated users can create, admins can view all
CREATE POLICY "Authenticated users can create messages" ON public.contact_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own messages" ON public.contact_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('mri_images', 'mri_images', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('gradcam_images', 'gradcam_images', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('charts', 'charts', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('reports', 'reports', true);

-- Storage policies: authenticated users can upload/read
CREATE POLICY "Authenticated users can upload MRI images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'mri_images');
CREATE POLICY "Anyone can view MRI images" ON storage.objects FOR SELECT USING (bucket_id = 'mri_images');
CREATE POLICY "Authenticated users can upload gradcam" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'gradcam_images');
CREATE POLICY "Anyone can view gradcam" ON storage.objects FOR SELECT USING (bucket_id = 'gradcam_images');
CREATE POLICY "Authenticated users can upload charts" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'charts');
CREATE POLICY "Anyone can view charts" ON storage.objects FOR SELECT USING (bucket_id = 'charts');
CREATE POLICY "Authenticated users can upload reports" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'reports');
CREATE POLICY "Anyone can view reports" ON storage.objects FOR SELECT USING (bucket_id = 'reports');
