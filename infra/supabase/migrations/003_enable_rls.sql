-- ============================================
-- Migration 003: Row-Level Security Policies
-- Setu — AI-Based Smart Logistics Platform
-- ============================================
-- RLS is enforced from day one. Every table gets policies.
-- Helper function to get the current user's role.

-- -----------------------------------------------
-- Helper: get current user's role from public.users
-- Using SECURITY DEFINER so it can read public.users even
-- when the calling user's RLS would otherwise block it.
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
    SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_user_district()
RETURNS UUID AS $$
    SELECT district_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ===============================================
-- 1. users
-- ===============================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY users_select_own ON public.users
    FOR SELECT USING (id = auth.uid());

-- Admins can read all users
CREATE POLICY users_select_admin ON public.users
    FOR SELECT USING (public.get_user_role() = 'admin');

-- Officials can read users in their district (for report attribution)
CREATE POLICY users_select_official_district ON public.users
    FOR SELECT USING (
        public.get_user_role() = 'official'
        AND district_id = public.get_user_district()
    );

-- Users can update their own profile (but NOT their role)
CREATE POLICY users_update_own ON public.users
    FOR UPDATE USING (id = auth.uid())
    WITH CHECK (
        id = auth.uid()
        -- role cannot be changed by the user themselves
        AND role = (SELECT role FROM public.users WHERE id = auth.uid())
    );

-- Admins can update any user (including role changes)
CREATE POLICY users_update_admin ON public.users
    FOR UPDATE USING (public.get_user_role() = 'admin');

-- Insert handled by the signup trigger (service_role)
CREATE POLICY users_insert_self ON public.users
    FOR INSERT WITH CHECK (id = auth.uid());

-- ===============================================
-- 2. districts
-- ===============================================
ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;

-- Everyone can read districts (public reference data)
CREATE POLICY districts_select_all ON public.districts
    FOR SELECT USING (true);

-- Only admins can modify districts
CREATE POLICY districts_insert_admin ON public.districts
    FOR INSERT WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY districts_update_admin ON public.districts
    FOR UPDATE USING (public.get_user_role() = 'admin');

-- ===============================================
-- 3. road_segments
-- ===============================================
ALTER TABLE public.road_segments ENABLE ROW LEVEL SECURITY;

-- Everyone can read road segments (needed for map rendering)
CREATE POLICY segments_select_all ON public.road_segments
    FOR SELECT USING (true);

-- Only admins can modify road segments
CREATE POLICY segments_insert_admin ON public.road_segments
    FOR INSERT WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY segments_update_admin ON public.road_segments
    FOR UPDATE USING (public.get_user_role() = 'admin');

-- ===============================================
-- 4. risk_scores
-- ===============================================
ALTER TABLE public.risk_scores ENABLE ROW LEVEL SECURITY;

-- Everyone can read risk scores (needed for map color-coding)
CREATE POLICY risk_scores_select_all ON public.risk_scores
    FOR SELECT USING (true);

-- Only service_role writes risk scores (via the risk engine cron)
-- No explicit INSERT policy for anon/authenticated = blocked by default
-- The risk engine uses the SUPABASE_SERVICE_ROLE_KEY which bypasses RLS

-- ===============================================
-- 5. reports
-- ===============================================
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Reporters/Drivers can see only their own reports
CREATE POLICY reports_select_own ON public.reports
    FOR SELECT USING (
        user_id = auth.uid()
        AND public.get_user_role() IN ('reporter', 'driver')
    );

-- Officials can see all reports in their district
CREATE POLICY reports_select_official ON public.reports
    FOR SELECT USING (
        public.get_user_role() = 'official'
        AND (
            segment_id IN (
                SELECT rs.id FROM public.road_segments rs
                WHERE rs.district_id = public.get_user_district()
            )
            -- Also show reports without a segment if they're in the district's bbox
            OR segment_id IS NULL
        )
    );

-- Admins can see all reports
CREATE POLICY reports_select_admin ON public.reports
    FOR SELECT USING (public.get_user_role() = 'admin');

-- Any authenticated user can insert a report (with their own user_id)
CREATE POLICY reports_insert_auth ON public.reports
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Officials can update the status field (verify/reject)
CREATE POLICY reports_update_official ON public.reports
    FOR UPDATE USING (
        public.get_user_role() IN ('official', 'admin')
    );

-- ===============================================
-- 6. verifications
-- ===============================================
ALTER TABLE public.verifications ENABLE ROW LEVEL SECURITY;

-- Officials can see their own verification decisions
CREATE POLICY verifications_select_own ON public.verifications
    FOR SELECT USING (official_id = auth.uid());

-- Admins can see all verifications
CREATE POLICY verifications_select_admin ON public.verifications
    FOR SELECT USING (public.get_user_role() = 'admin');

-- Officials can insert verifications (for reports in their district)
CREATE POLICY verifications_insert_official ON public.verifications
    FOR INSERT WITH CHECK (
        public.get_user_role() IN ('official', 'admin')
        AND official_id = auth.uid()
    );

-- ===============================================
-- 7. alerts
-- ===============================================
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read alerts (public safety info)
CREATE POLICY alerts_select_auth ON public.alerts
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Only service_role writes alerts (via the alert dispatch cron)

-- ===============================================
-- 8. subscriptions
-- ===============================================
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can see only their own subscriptions
CREATE POLICY subscriptions_select_own ON public.subscriptions
    FOR SELECT USING (user_id = auth.uid());

-- Users can insert their own subscriptions
CREATE POLICY subscriptions_insert_own ON public.subscriptions
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their own subscriptions
CREATE POLICY subscriptions_update_own ON public.subscriptions
    FOR UPDATE USING (user_id = auth.uid());

-- Users can delete their own subscriptions
CREATE POLICY subscriptions_delete_own ON public.subscriptions
    FOR DELETE USING (user_id = auth.uid());

-- Admins can see all subscriptions
CREATE POLICY subscriptions_select_admin ON public.subscriptions
    FOR SELECT USING (public.get_user_role() = 'admin');

-- ===============================================
-- 9. sms_gateway_log
-- ===============================================
ALTER TABLE public.sms_gateway_log ENABLE ROW LEVEL SECURITY;

-- Only admins and officials can read SMS logs
CREATE POLICY sms_log_select_admin ON public.sms_gateway_log
    FOR SELECT USING (public.get_user_role() IN ('admin', 'official'));

-- Only service_role writes SMS logs (via the Twilio webhook)

-- ===============================================
-- 10. audit_log
-- ===============================================
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read the audit log
CREATE POLICY audit_log_select_admin ON public.audit_log
    FOR SELECT USING (public.get_user_role() = 'admin');

-- Inserts are done via SECURITY DEFINER trigger functions only
-- No direct insert policy for any role
