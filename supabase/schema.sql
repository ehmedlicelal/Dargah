-- ============================================================
-- Nərimanov Digital — Supabase Schema
-- Run this in your Supabase project SQL Editor
-- ============================================================

-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLE: users (extends Supabase auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
    id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name   text,
    role        text NOT NULL DEFAULT 'citizen'
                    CHECK (role IN ('citizen', 'operator', 'admin')),
    phone       text,
    fin_code    text,  -- ASAN FIN card number placeholder
    avatar_url  text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLE: district_zones
-- ============================================================
CREATE TABLE IF NOT EXISTS public.district_zones (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text NOT NULL,
    name_az     text NOT NULL,
    code        text UNIQUE,
    boundary    jsonb,  -- GeoJSON polygon
    population  integer,
    area_km2    numeric(8, 2),
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLE: monitoring_data
-- ============================================================
CREATE TABLE IF NOT EXISTS public.monitoring_data (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id     uuid REFERENCES public.district_zones(id) ON DELETE SET NULL,
    type        text NOT NULL
                    CHECK (type IN ('air_quality', 'traffic', 'utilities', 'incident')),
    value       jsonb NOT NULL,  -- flexible: {aqi:45, pm25:12} or {congestion_pct:72}
    source      text NOT NULL DEFAULT 'sensor',
    recorded_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLE: complaints
-- ============================================================
CREATE TABLE IF NOT EXISTS public.complaints (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid REFERENCES public.users(id) ON DELETE SET NULL,
    zone_id     uuid REFERENCES public.district_zones(id) ON DELETE SET NULL,
    title       text NOT NULL,
    description text NOT NULL,
    category    text,  -- AI-classified: road, utilities, environment, safety, other
    priority    text NOT NULL DEFAULT 'medium'
                    CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    status      text NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    ai_summary  text,  -- OpenRouter generated summary
    attachments text[],  -- Supabase Storage URLs
    lat         numeric(9, 6),
    lng         numeric(9, 6),
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLE: services
-- ============================================================
CREATE TABLE IF NOT EXISTS public.services (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name            text NOT NULL,
    name_az         text NOT NULL,
    description_az  text,
    category        text,
    contact_phone   text,
    contact_email   text,
    working_hours   text,
    zone_id         uuid REFERENCES public.district_zones(id) ON DELETE SET NULL,
    is_active       boolean NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLE: open_data_reports
-- ============================================================
CREATE TABLE IF NOT EXISTS public.open_data_reports (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title           text NOT NULL,
    title_az        text,
    type            text,
    data            jsonb,
    ai_summary      text,
    published_at    timestamptz NOT NULL DEFAULT now(),
    generated_by    text NOT NULL DEFAULT 'system'
);

-- ============================================================
-- TRIGGERS: updated_at auto-update
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER complaints_updated_at
    BEFORE UPDATE ON public.complaints
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_monitoring_type_recorded
    ON public.monitoring_data (type, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_monitoring_zone
    ON public.monitoring_data (zone_id);

CREATE INDEX IF NOT EXISTS idx_complaints_status_created
    ON public.complaints (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_complaints_zone
    ON public.complaints (zone_id);

CREATE INDEX IF NOT EXISTS idx_complaints_user
    ON public.complaints (user_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.district_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitoring_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.open_data_reports ENABLE ROW LEVEL SECURITY;

-- ---- users ----
CREATE POLICY "Users can view their own profile"
    ON public.users FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON public.users FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Admins can view all users"
    ON public.users FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid() AND u.role IN ('admin', 'operator')
        )
    );

-- ---- district_zones — public read ----
CREATE POLICY "Anyone can view district zones"
    ON public.district_zones FOR SELECT
    USING (true);

-- ---- monitoring_data ----
CREATE POLICY "Authenticated users can view monitoring data"
    ON public.monitoring_data FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can insert monitoring data"
    ON public.monitoring_data FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

-- ---- complaints ----
CREATE POLICY "Citizens can view their own complaints"
    ON public.complaints FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Operators and admins can view all complaints"
    ON public.complaints FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid() AND u.role IN ('admin', 'operator')
        )
    );

CREATE POLICY "Authenticated users can create complaints"
    ON public.complaints FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Operators and admins can update complaints"
    ON public.complaints FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid() AND u.role IN ('admin', 'operator')
        )
    );

CREATE POLICY "Citizens can update their own open complaints"
    ON public.complaints FOR UPDATE
    USING (auth.uid() = user_id AND status = 'open');

CREATE POLICY "Admins can delete complaints"
    ON public.complaints FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid() AND u.role = 'admin'
        )
    );

-- ---- services — public read ----
CREATE POLICY "Anyone can view services"
    ON public.services FOR SELECT
    USING (true);

-- ---- open_data_reports — public read ----
CREATE POLICY "Anyone can view open data reports"
    ON public.open_data_reports FOR SELECT
    USING (true);

-- ============================================================
-- REALTIME PUBLICATIONS
-- ============================================================
-- Enable realtime for live monitoring updates and complaint tracking
ALTER PUBLICATION supabase_realtime ADD TABLE public.monitoring_data;
ALTER PUBLICATION supabase_realtime ADD TABLE public.complaints;

-- ============================================================
-- FUNCTION: auto-create user profile on auth signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, full_name, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        'citizen'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- COMPLAINTS — extended citizen info + report storage
-- Run these ALTER statements if the table already exists
-- ============================================================
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS submission_type      TEXT DEFAULT 'Şikayət';
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS citizen_name          TEXT;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS citizen_father        TEXT;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS citizen_phone         TEXT;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS report_content        TEXT;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS deadline              TIMESTAMPTZ;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS assigned_service_id  UUID REFERENCES public.services(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_complaints_deadline ON public.complaints (deadline) WHERE deadline IS NOT NULL;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- NAMED BUILDINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.named_buildings (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    feature_id  TEXT NOT NULL UNIQUE,   -- stable Mapbox/OSM feature id
    name        TEXT NOT NULL,
    lat         DOUBLE PRECISION,
    lng         DOUBLE PRECISION,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS named_buildings_feature_id_idx ON public.named_buildings (feature_id);

ALTER TABLE public.named_buildings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Named buildings readable by all"
    ON public.named_buildings FOR SELECT USING (true);

CREATE POLICY "Authenticated users can save buildings"
    ON public.named_buildings FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update buildings"
    ON public.named_buildings FOR UPDATE
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete buildings"
    ON public.named_buildings FOR DELETE
    USING (auth.role() = 'authenticated');
