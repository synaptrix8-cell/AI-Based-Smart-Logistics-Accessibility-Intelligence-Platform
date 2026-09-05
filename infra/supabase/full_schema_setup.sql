-- =====================================================================
-- SETU PLATFORM — FULL CONSOLIDATED SUPABASE SCHEMA SETUP
-- Idempotent script: Safe to run on fresh or existing databases.
-- Contains Migrations 001 through 005.
-- =====================================================================

-- ============================================
-- 1. EXTENSIONS
-- ============================================
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================
-- 2. TABLES (with IF NOT EXISTS)
-- ============================================

-- 1. districts
CREATE TABLE IF NOT EXISTS public.districts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    state TEXT NOT NULL,
    geometry GEOMETRY(MultiPolygon, 4326),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_districts_geom ON public.districts USING GIST(geometry);
CREATE INDEX IF NOT EXISTS idx_districts_state ON public.districts(state);

-- 2. users (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'reporter'
        CHECK (role IN ('driver', 'reporter', 'official', 'admin')),
    district_id UUID REFERENCES public.districts(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_district ON public.users(district_id);

-- 3. road_segments
CREATE TABLE IF NOT EXISTS public.road_segments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    district_id UUID NOT NULL REFERENCES public.districts(id),
    geometry GEOMETRY(LineString, 4326) NOT NULL,
    name TEXT,
    highway_ref TEXT,
    base_risk REAL NOT NULL DEFAULT 0.3
        CHECK (base_risk >= 0.0 AND base_risk <= 1.0),
    length_km REAL,
    surface_type TEXT DEFAULT 'paved',
    elevation_gain_m REAL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_road_segments_geom ON public.road_segments USING GIST(geometry);
CREATE INDEX IF NOT EXISTS idx_road_segments_district ON public.road_segments(district_id);
CREATE INDEX IF NOT EXISTS idx_road_segments_highway_ref ON public.road_segments(highway_ref);

-- 4. risk_scores
CREATE TABLE IF NOT EXISTS public.risk_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    segment_id UUID NOT NULL REFERENCES public.road_segments(id) ON DELETE CASCADE,
    score REAL NOT NULL CHECK (score >= 0.0 AND score <= 1.0),
    computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    factors JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_risk_scores_segment ON public.risk_scores(segment_id);
CREATE INDEX IF NOT EXISTS idx_risk_scores_time ON public.risk_scores(computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_risk_scores_segment_time ON public.risk_scores(segment_id, computed_at DESC);

-- 5. reports (field hazard reports)
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id),
    segment_id UUID REFERENCES public.road_segments(id),
    category TEXT NOT NULL
        CHECK (category IN ('landslide', 'flood', 'road_damage', 'congestion', 'other')),
    encrypted_payload TEXT,
    iv TEXT,
    status TEXT NOT NULL DEFAULT 'unverified'
        CHECK (status IN ('unverified', 'verified', 'rejected')),
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    point GEOMETRY(Point, 4326),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_segment ON public.reports(segment_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_user ON public.reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_point ON public.reports USING GIST(point);
CREATE INDEX IF NOT EXISTS idx_reports_created ON public.reports(created_at DESC);

-- Trigger: auto-populate PostGIS point from lat/lng on insert
CREATE OR REPLACE FUNCTION set_report_point()
RETURNS TRIGGER AS $$
BEGIN
    NEW.point := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_set_report_point ON public.reports;
CREATE TRIGGER tr_set_report_point
    BEFORE INSERT OR UPDATE OF lat, lng ON public.reports
    FOR EACH ROW EXECUTE FUNCTION set_report_point();

-- 6. verifications
CREATE TABLE IF NOT EXISTS public.verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
    official_id UUID NOT NULL REFERENCES public.users(id),
    decision TEXT NOT NULL CHECK (decision IN ('verified', 'rejected')),
    notes TEXT,
    decided_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verifications_report ON public.verifications(report_id);
CREATE INDEX IF NOT EXISTS idx_verifications_official ON public.verifications(official_id);

-- 7. alerts
CREATE TABLE IF NOT EXISTS public.alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    segment_id UUID REFERENCES public.road_segments(id),
    district_id UUID REFERENCES public.districts(id),
    risk_score REAL,
    message TEXT NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    channel TEXT NOT NULL CHECK (channel IN ('sms', 'whatsapp', 'push', 'in_app'))
);

CREATE INDEX IF NOT EXISTS idx_alerts_segment ON public.alerts(segment_id);
CREATE INDEX IF NOT EXISTS idx_alerts_sent ON public.alerts(sent_at DESC);

-- 8. subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    district_id UUID REFERENCES public.districts(id),
    segment_id UUID REFERENCES public.road_segments(id),
    channel TEXT NOT NULL DEFAULT 'in_app'
        CHECK (channel IN ('sms', 'whatsapp', 'push', 'in_app')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (district_id IS NOT NULL OR segment_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_district ON public.subscriptions(district_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_segment ON public.subscriptions(segment_id);

-- 9. sms_gateway_log
CREATE TABLE IF NOT EXISTS public.sms_gateway_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    raw_message TEXT NOT NULL,
    parsed_category TEXT,
    parsed_segment UUID REFERENCES public.road_segments(id),
    sender_phone TEXT,
    processing_status TEXT DEFAULT 'pending'
        CHECK (processing_status IN ('pending', 'processed', 'failed', 'ignored')),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sms_log_created ON public.sms_gateway_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_log_status ON public.sms_gateway_log(processing_status);

-- 10. audit_log
CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID REFERENCES public.users(id),
    action TEXT NOT NULL,
    table_name TEXT NOT NULL,
    row_id UUID,
    before JSONB,
    after JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON public.audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_table ON public.audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_time ON public.audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_row ON public.audit_log(table_name, row_id);

-- ============================================
-- 3. HELPER FUNCTIONS FOR RLS
-- ============================================
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
    SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_user_district()
RETURNS UUID AS $$
    SELECT district_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================
-- 4. ROW-LEVEL SECURITY POLICIES
-- ============================================

-- 1. users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_select_own ON public.users;
CREATE POLICY users_select_own ON public.users FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS users_select_admin ON public.users;
CREATE POLICY users_select_admin ON public.users FOR SELECT USING (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS users_select_official_district ON public.users;
CREATE POLICY users_select_official_district ON public.users FOR SELECT USING (
    public.get_user_role() = 'official' AND district_id = public.get_user_district()
);

DROP POLICY IF EXISTS users_update_own ON public.users;
CREATE POLICY users_update_own ON public.users FOR UPDATE USING (id = auth.uid())
    WITH CHECK (id = auth.uid() AND role = (SELECT role FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS users_update_admin ON public.users;
CREATE POLICY users_update_admin ON public.users FOR UPDATE USING (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS users_insert_self ON public.users;
CREATE POLICY users_insert_self ON public.users FOR INSERT WITH CHECK (id = auth.uid());

-- 2. districts
ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS districts_select_all ON public.districts;
CREATE POLICY districts_select_all ON public.districts FOR SELECT USING (true);

DROP POLICY IF EXISTS districts_insert_admin ON public.districts;
CREATE POLICY districts_insert_admin ON public.districts FOR INSERT WITH CHECK (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS districts_update_admin ON public.districts;
CREATE POLICY districts_update_admin ON public.districts FOR UPDATE USING (public.get_user_role() = 'admin');

-- 3. road_segments
ALTER TABLE public.road_segments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS segments_select_all ON public.road_segments;
CREATE POLICY segments_select_all ON public.road_segments FOR SELECT USING (true);

DROP POLICY IF EXISTS segments_insert_admin ON public.road_segments;
CREATE POLICY segments_insert_admin ON public.road_segments FOR INSERT WITH CHECK (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS segments_update_admin ON public.road_segments;
CREATE POLICY segments_update_admin ON public.road_segments FOR UPDATE USING (public.get_user_role() = 'admin');

-- 4. risk_scores
ALTER TABLE public.risk_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS risk_scores_select_all ON public.risk_scores;
CREATE POLICY risk_scores_select_all ON public.risk_scores FOR SELECT USING (true);

-- 5. reports
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reports_select_own ON public.reports;
CREATE POLICY reports_select_own ON public.reports FOR SELECT USING (
    user_id = auth.uid() AND public.get_user_role() IN ('reporter', 'driver')
);

DROP POLICY IF EXISTS reports_select_official ON public.reports;
CREATE POLICY reports_select_official ON public.reports FOR SELECT USING (
    public.get_user_role() = 'official' AND (
        segment_id IN (
            SELECT rs.id FROM public.road_segments rs
            WHERE rs.district_id = public.get_user_district()
        )
        OR segment_id IS NULL
    )
);

DROP POLICY IF EXISTS reports_select_admin ON public.reports;
CREATE POLICY reports_select_admin ON public.reports FOR SELECT USING (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS reports_insert_auth ON public.reports;
CREATE POLICY reports_insert_auth ON public.reports FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS reports_update_official ON public.reports;
CREATE POLICY reports_update_official ON public.reports FOR UPDATE USING (
    public.get_user_role() IN ('official', 'admin')
);

-- 6. verifications
ALTER TABLE public.verifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS verifications_select_own ON public.verifications;
CREATE POLICY verifications_select_own ON public.verifications FOR SELECT USING (official_id = auth.uid());

DROP POLICY IF EXISTS verifications_select_admin ON public.verifications;
CREATE POLICY verifications_select_admin ON public.verifications FOR SELECT USING (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS verifications_insert_official ON public.verifications;
CREATE POLICY verifications_insert_official ON public.verifications FOR INSERT WITH CHECK (
    public.get_user_role() IN ('official', 'admin') AND official_id = auth.uid()
);

-- 7. alerts
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS alerts_select_auth ON public.alerts;
CREATE POLICY alerts_select_auth ON public.alerts FOR SELECT USING (auth.uid() IS NOT NULL);

-- 8. subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS subscriptions_select_own ON public.subscriptions;
CREATE POLICY subscriptions_select_own ON public.subscriptions FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS subscriptions_insert_own ON public.subscriptions;
CREATE POLICY subscriptions_insert_own ON public.subscriptions FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS subscriptions_update_own ON public.subscriptions;
CREATE POLICY subscriptions_update_own ON public.subscriptions FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS subscriptions_delete_own ON public.subscriptions;
CREATE POLICY subscriptions_delete_own ON public.subscriptions FOR DELETE USING (user_id = auth.uid());

DROP POLICY IF EXISTS subscriptions_select_admin ON public.subscriptions;
CREATE POLICY subscriptions_select_admin ON public.subscriptions FOR SELECT USING (public.get_user_role() = 'admin');

-- 9. sms_gateway_log
ALTER TABLE public.sms_gateway_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sms_log_select_admin ON public.sms_gateway_log;
CREATE POLICY sms_log_select_admin ON public.sms_gateway_log FOR SELECT USING (public.get_user_role() IN ('admin', 'official'));

-- 10. audit_log
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_log_select_admin ON public.audit_log;
CREATE POLICY audit_log_select_admin ON public.audit_log FOR SELECT USING (public.get_user_role() = 'admin');

-- ============================================
-- 5. AUDIT & AUTOMATION TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.audit_log (
        actor_id,
        action,
        table_name,
        row_id,
        before,
        after,
        created_at
    ) VALUES (
        auth.uid(),
        TG_OP,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        CASE WHEN TG_OP IN ('DELETE', 'UPDATE') THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
        now()
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_audit_reports ON public.reports;
CREATE TRIGGER tr_audit_reports
    AFTER INSERT OR UPDATE OR DELETE ON public.reports
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS tr_audit_verifications ON public.verifications;
CREATE TRIGGER tr_audit_verifications
    AFTER INSERT OR UPDATE OR DELETE ON public.verifications
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS tr_audit_risk_scores ON public.risk_scores;
CREATE TRIGGER tr_audit_risk_scores
    AFTER INSERT ON public.risk_scores
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS tr_audit_road_segments ON public.road_segments;
CREATE TRIGGER tr_audit_road_segments
    AFTER INSERT OR UPDATE OR DELETE ON public.road_segments
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS tr_audit_users ON public.users;
CREATE TRIGGER tr_audit_users
    AFTER UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- Auto-create profile on auth.users signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, role, created_at)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'role', 'reporter'),
        now()
    )
    ON CONFLICT DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_on_auth_user_created ON auth.users;
CREATE TRIGGER tr_on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update report status on verification
CREATE OR REPLACE FUNCTION public.apply_verification()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.reports
    SET status = NEW.decision
    WHERE id = NEW.report_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_apply_verification ON public.verifications;
CREATE TRIGGER tr_apply_verification
    AFTER INSERT ON public.verifications
    FOR EACH ROW EXECUTE FUNCTION public.apply_verification();

-- Auto-update updated_at on users
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_users_updated_at ON public.users;
CREATE TRIGGER tr_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =====================================================================
-- 6. SEED DATA — EAST KHASI HILLS (MEGHALAYA)
-- Uses WHERE NOT EXISTS so it never fails on conflict constraints.
-- =====================================================================

-- 1. Insert East Khasi Hills District
INSERT INTO public.districts (id, name, state, geometry)
SELECT
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
    'East Khasi Hills',
    'Meghalaya',
    ST_GeomFromText('MULTIPOLYGON(((91.6 25.1, 92.1 25.1, 92.1 25.7, 91.6 25.7, 91.6 25.1)))', 4326)
WHERE NOT EXISTS (
    SELECT 1 FROM public.districts WHERE id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid
);

-- 2. Insert Road Segments (NH6 & NH40 Shillong Corridor)
INSERT INTO public.road_segments (id, district_id, geometry, name, highway_ref, base_risk, length_km)
SELECT v.id, v.district_id, v.geometry, v.name, v.highway_ref, v.base_risk, v.length_km
FROM (VALUES
    ('b0000001-0000-0000-0000-000000000001'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
     ST_GeomFromText('LINESTRING(91.765 25.891, 91.780 25.870, 91.795 25.848)', 4326),
     'Nongpoh – Umiam Approach', 'NH6', 0.35::real, 6.2::real),

    ('b0000002-0000-0000-0000-000000000002'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
     ST_GeomFromText('LINESTRING(91.795 25.848, 91.830 25.830, 91.860 25.815)', 4326),
     'Umiam Lake Bypass', 'NH6', 0.25::real, 7.8::real),

    ('b0000003-0000-0000-0000-000000000003'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
     ST_GeomFromText('LINESTRING(91.860 25.815, 91.875 25.795, 91.882 25.780)', 4326),
     'Umiam – Upper Shillong Descent', 'NH6', 0.65::real, 4.5::real),

    ('b0000004-0000-0000-0000-000000000004'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
     ST_GeomFromText('LINESTRING(91.882 25.780, 91.876 25.572, 91.884 25.565)', 4326),
     'Upper Shillong – Laitumkhrah', 'NH6', 0.30::real, 5.1::real),

    ('b0000005-0000-0000-0000-000000000005'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
     ST_GeomFromText('LINESTRING(91.884 25.565, 91.893 25.555, 91.900 25.548)', 4326),
     'Shillong Police Bazaar Bypass', 'NH6', 0.20::real, 3.0::real),

    ('b0000006-0000-0000-0000-000000000006'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
     ST_GeomFromText('LINESTRING(91.900 25.548, 91.920 25.530, 91.945 25.510)', 4326),
     'Shillong – Laitlyngkot', 'NH40', 0.45::real, 8.3::real),

    ('b0000007-0000-0000-0000-000000000007'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
     ST_GeomFromText('LINESTRING(91.945 25.510, 91.980 25.480, 92.010 25.450)', 4326),
     'Laitlyngkot – Pynursla', 'NH40', 0.55::real, 10.2::real),

    ('b0000008-0000-0000-0000-000000000008'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
     ST_GeomFromText('LINESTRING(92.010 25.450, 92.040 25.430, 92.060 25.410)', 4326),
     'Pynursla – Mawsynram Approach', 'NH40', 0.75::real, 9.1::real),

    ('b0000009-0000-0000-0000-000000000009'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
     ST_GeomFromText('LINESTRING(91.720 25.300, 91.735 25.290, 91.750 25.280)', 4326),
     'Mawsynram – Cherrapunji Road', 'NH40', 0.85::real, 7.6::real),

    ('b0000010-0000-0000-0000-000000000010'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
     ST_GeomFromText('LINESTRING(91.750 25.280, 91.765 25.265, 91.780 25.250)', 4326),
     'Cherrapunji – Nongriat Descent', 'NH40', 0.80::real, 5.4::real),

    ('b0000011-0000-0000-0000-000000000011'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
     ST_GeomFromText('LINESTRING(91.850 25.590, 91.865 25.580, 91.875 25.572)', 4326),
     'Mawlai – Nongthymmai Link', NULL, 0.40::real, 3.8::real),

    ('b0000012-0000-0000-0000-000000000012'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
     ST_GeomFromText('LINESTRING(91.880 25.560, 91.870 25.575, 91.860 25.585)', 4326),
     'Laban – Mawprem Road', NULL, 0.35::real, 3.2::real),

    ('b0000013-0000-0000-0000-000000000013'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
     ST_GeomFromText('LINESTRING(91.900 25.548, 91.930 25.550, 91.960 25.555)', 4326),
     'Shillong – Jowai Road Start', 'NH44', 0.40::real, 6.9::real),

    ('b0000014-0000-0000-0000-000000000014'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
     ST_GeomFromText('LINESTRING(91.840 25.600, 91.830 25.615, 91.820 25.630)', 4326),
     'Smit – Nongkrem Sacred Grove Road', NULL, 0.50::real, 4.5::real),

    ('b0000015-0000-0000-0000-000000000015'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
     ST_GeomFromText('LINESTRING(91.780 25.250, 91.800 25.230, 91.820 25.210)', 4326),
     'Sohra – Border Approach Road', NULL, 0.70::real, 6.3::real)
) AS v(id, district_id, geometry, name, highway_ref, base_risk, length_km)
WHERE NOT EXISTS (
    SELECT 1 FROM public.road_segments WHERE id = v.id
);

-- 3. Insert Initial Risk Scores
INSERT INTO public.risk_scores (segment_id, score, factors)
SELECT v.segment_id, v.score, v.factors::jsonb
FROM (VALUES
    ('b0000001-0000-0000-0000-000000000001'::uuid, 0.35::real, '{"rainfall_mm": 45, "slope_deg": 8, "report_count": 0, "historical_incidents": 2}'),
    ('b0000002-0000-0000-0000-000000000002'::uuid, 0.25::real, '{"rainfall_mm": 40, "slope_deg": 5, "report_count": 0, "historical_incidents": 1}'),
    ('b0000003-0000-0000-0000-000000000003'::uuid, 0.65::real, '{"rainfall_mm": 55, "slope_deg": 18, "report_count": 1, "historical_incidents": 8}'),
    ('b0000004-0000-0000-0000-000000000004'::uuid, 0.30::real, '{"rainfall_mm": 50, "slope_deg": 6, "report_count": 0, "historical_incidents": 1}'),
    ('b0000005-0000-0000-0000-000000000005'::uuid, 0.20::real, '{"rainfall_mm": 48, "slope_deg": 3, "report_count": 0, "historical_incidents": 0}'),
    ('b0000006-0000-0000-0000-000000000006'::uuid, 0.45::real, '{"rainfall_mm": 60, "slope_deg": 12, "report_count": 0, "historical_incidents": 4}'),
    ('b0000007-0000-0000-0000-000000000007'::uuid, 0.55::real, '{"rainfall_mm": 70, "slope_deg": 15, "report_count": 1, "historical_incidents": 6}'),
    ('b0000008-0000-0000-0000-000000000008'::uuid, 0.75::real, '{"rainfall_mm": 95, "slope_deg": 20, "report_count": 2, "historical_incidents": 12}'),
    ('b0000009-0000-0000-0000-000000000009'::uuid, 0.85::real, '{"rainfall_mm": 110, "slope_deg": 25, "report_count": 3, "historical_incidents": 18}'),
    ('b0000010-0000-0000-0000-000000000010'::uuid, 0.80::real, '{"rainfall_mm": 100, "slope_deg": 22, "report_count": 2, "historical_incidents": 15}'),
    ('b0000011-0000-0000-0000-000000000011'::uuid, 0.40::real, '{"rainfall_mm": 50, "slope_deg": 10, "report_count": 0, "historical_incidents": 3}'),
    ('b0000012-0000-0000-0000-000000000012'::uuid, 0.35::real, '{"rainfall_mm": 48, "slope_deg": 7, "report_count": 0, "historical_incidents": 2}'),
    ('b0000013-0000-0000-0000-000000000013'::uuid, 0.40::real, '{"rainfall_mm": 55, "slope_deg": 8, "report_count": 0, "historical_incidents": 3}'),
    ('b0000014-0000-0000-0000-000000000014'::uuid, 0.50::real, '{"rainfall_mm": 60, "slope_deg": 14, "report_count": 1, "historical_incidents": 5}'),
    ('b0000015-0000-0000-0000-000000000015'::uuid, 0.70::real, '{"rainfall_mm": 85, "slope_deg": 19, "report_count": 1, "historical_incidents": 10}')
) AS v(segment_id, score, factors)
WHERE NOT EXISTS (
    SELECT 1 FROM public.risk_scores WHERE segment_id = v.segment_id
);
