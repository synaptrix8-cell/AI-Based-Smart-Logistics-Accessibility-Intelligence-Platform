-- ============================================
-- Migration 002: Create All Tables
-- Setu — AI-Based Smart Logistics Platform
-- ============================================
-- Tables are created in dependency order.
-- RLS is enabled in a separate migration (003) for clarity.

-- -----------------------------------------------
-- 1. districts
-- -----------------------------------------------
CREATE TABLE public.districts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    state TEXT NOT NULL,
    geometry GEOMETRY(MultiPolygon, 4326),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_districts_geom ON public.districts USING GIST(geometry);
CREATE INDEX idx_districts_state ON public.districts(state);

COMMENT ON TABLE public.districts IS 'NER districts with PostGIS boundary polygons';

-- -----------------------------------------------
-- 2. users (extends Supabase auth.users)
-- -----------------------------------------------
CREATE TABLE public.users (
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

CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_users_district ON public.users(district_id);

COMMENT ON TABLE public.users IS 'Public user profiles linked to Supabase Auth. Role is the source of truth for RBAC.';

-- -----------------------------------------------
-- 3. road_segments
-- -----------------------------------------------
CREATE TABLE public.road_segments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    district_id UUID NOT NULL REFERENCES public.districts(id),
    geometry GEOMETRY(LineString, 4326) NOT NULL,
    name TEXT,
    highway_ref TEXT,           -- e.g. "NH6", "NH40"
    base_risk REAL NOT NULL DEFAULT 0.3
        CHECK (base_risk >= 0.0 AND base_risk <= 1.0),
    length_km REAL,
    surface_type TEXT DEFAULT 'paved',
    elevation_gain_m REAL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_road_segments_geom ON public.road_segments USING GIST(geometry);
CREATE INDEX idx_road_segments_district ON public.road_segments(district_id);
CREATE INDEX idx_road_segments_highway_ref ON public.road_segments(highway_ref);

COMMENT ON TABLE public.road_segments IS 'Road segments with PostGIS linestring geometry. Each represents a stretch of road with a base risk score.';

-- -----------------------------------------------
-- 4. risk_scores
-- -----------------------------------------------
CREATE TABLE public.risk_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    segment_id UUID NOT NULL REFERENCES public.road_segments(id) ON DELETE CASCADE,
    score REAL NOT NULL CHECK (score >= 0.0 AND score <= 1.0),
    computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    factors JSONB NOT NULL DEFAULT '{}'::jsonb
    -- factors schema: { rainfall_mm, slope_deg, report_count, historical_incidents, days_since_last_incident }
);

CREATE INDEX idx_risk_scores_segment ON public.risk_scores(segment_id);
CREATE INDEX idx_risk_scores_time ON public.risk_scores(computed_at DESC);
-- Composite index for "latest score per segment" queries
CREATE INDEX idx_risk_scores_segment_time ON public.risk_scores(segment_id, computed_at DESC);

COMMENT ON TABLE public.risk_scores IS 'Time-series risk scores per road segment. Latest row per segment = current risk.';

-- -----------------------------------------------
-- 5. reports (field hazard reports)
-- -----------------------------------------------
CREATE TABLE public.reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id),
    segment_id UUID REFERENCES public.road_segments(id),
    category TEXT NOT NULL
        CHECK (category IN ('landslide', 'flood', 'road_damage', 'congestion', 'other')),
    encrypted_payload TEXT,     -- AES-GCM encrypted report text + photo URL, base64
    iv TEXT,                    -- Initialization vector for AES-GCM, base64
    status TEXT NOT NULL DEFAULT 'unverified'
        CHECK (status IN ('unverified', 'verified', 'rejected')),
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    point GEOMETRY(Point, 4326),  -- Auto-populated from lat/lng via trigger
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reports_segment ON public.reports(segment_id);
CREATE INDEX idx_reports_status ON public.reports(status);
CREATE INDEX idx_reports_user ON public.reports(user_id);
CREATE INDEX idx_reports_point ON public.reports USING GIST(point);
CREATE INDEX idx_reports_created ON public.reports(created_at DESC);

COMMENT ON TABLE public.reports IS 'Citizen/driver hazard reports. encrypted_payload is AES-GCM encrypted client-side; only officials with the decryption key can read it.';

-- Trigger: auto-populate PostGIS point from lat/lng on insert
CREATE OR REPLACE FUNCTION set_report_point()
RETURNS TRIGGER AS $$
BEGIN
    NEW.point := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_set_report_point
    BEFORE INSERT OR UPDATE OF lat, lng ON public.reports
    FOR EACH ROW EXECUTE FUNCTION set_report_point();

-- -----------------------------------------------
-- 6. verifications
-- -----------------------------------------------
CREATE TABLE public.verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
    official_id UUID NOT NULL REFERENCES public.users(id),
    decision TEXT NOT NULL CHECK (decision IN ('verified', 'rejected')),
    notes TEXT,
    decided_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_verifications_report ON public.verifications(report_id);
CREATE INDEX idx_verifications_official ON public.verifications(official_id);

COMMENT ON TABLE public.verifications IS 'Official decisions on field reports. Each verification links an official to their decision on a report.';

-- -----------------------------------------------
-- 7. alerts
-- -----------------------------------------------
CREATE TABLE public.alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    segment_id UUID REFERENCES public.road_segments(id),
    district_id UUID REFERENCES public.districts(id),
    risk_score REAL,
    message TEXT NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    channel TEXT NOT NULL CHECK (channel IN ('sms', 'whatsapp', 'push', 'in_app'))
);

CREATE INDEX idx_alerts_segment ON public.alerts(segment_id);
CREATE INDEX idx_alerts_sent ON public.alerts(sent_at DESC);

COMMENT ON TABLE public.alerts IS 'Outbound alert log — tracks every alert sent via any channel.';

-- -----------------------------------------------
-- 8. subscriptions
-- -----------------------------------------------
CREATE TABLE public.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    district_id UUID REFERENCES public.districts(id),
    segment_id UUID REFERENCES public.road_segments(id),
    channel TEXT NOT NULL DEFAULT 'in_app'
        CHECK (channel IN ('sms', 'whatsapp', 'push', 'in_app')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Must subscribe to at least a district or a segment
    CHECK (district_id IS NOT NULL OR segment_id IS NOT NULL)
);

CREATE INDEX idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_district ON public.subscriptions(district_id);
CREATE INDEX idx_subscriptions_segment ON public.subscriptions(segment_id);

COMMENT ON TABLE public.subscriptions IS 'User alert subscriptions — which routes/districts a user wants notifications for.';

-- -----------------------------------------------
-- 9. sms_gateway_log
-- -----------------------------------------------
CREATE TABLE public.sms_gateway_log (
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

CREATE INDEX idx_sms_log_created ON public.sms_gateway_log(created_at DESC);
CREATE INDEX idx_sms_log_status ON public.sms_gateway_log(processing_status);

COMMENT ON TABLE public.sms_gateway_log IS 'Raw SMS/USSD messages received via Twilio webhook. Parsed into reports by the processing pipeline.';

-- -----------------------------------------------
-- 10. audit_log
-- -----------------------------------------------
CREATE TABLE public.audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID REFERENCES public.users(id),
    action TEXT NOT NULL,         -- 'INSERT', 'UPDATE', 'DELETE'
    table_name TEXT NOT NULL,
    row_id UUID,
    before JSONB,
    after JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_actor ON public.audit_log(actor_id);
CREATE INDEX idx_audit_log_table ON public.audit_log(table_name);
CREATE INDEX idx_audit_log_time ON public.audit_log(created_at DESC);
CREATE INDEX idx_audit_log_row ON public.audit_log(table_name, row_id);

COMMENT ON TABLE public.audit_log IS 'Immutable audit trail of all writes to sensitive tables. Required for government-facing compliance.';
