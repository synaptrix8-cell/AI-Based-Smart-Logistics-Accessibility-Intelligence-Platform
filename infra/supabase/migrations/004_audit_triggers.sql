-- ============================================
-- Migration 004: Audit Triggers & User Sync
-- Setu — AI-Based Smart Logistics Platform
-- ============================================

-- -----------------------------------------------
-- Generic audit trigger function
-- Captures who changed what, when, with before/after snapshots.
-- Uses SECURITY DEFINER to bypass RLS when writing to audit_log.
-- -----------------------------------------------
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

-- -----------------------------------------------
-- Attach audit triggers to sensitive tables
-- -----------------------------------------------

-- reports: track all changes (create, verify, reject)
CREATE TRIGGER tr_audit_reports
    AFTER INSERT OR UPDATE OR DELETE ON public.reports
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- verifications: track official decisions
CREATE TRIGGER tr_audit_verifications
    AFTER INSERT OR UPDATE OR DELETE ON public.verifications
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- risk_scores: track recomputations
CREATE TRIGGER tr_audit_risk_scores
    AFTER INSERT ON public.risk_scores
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- road_segments: track segment changes
CREATE TRIGGER tr_audit_road_segments
    AFTER INSERT OR UPDATE OR DELETE ON public.road_segments
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- users: track role changes and profile updates
CREATE TRIGGER tr_audit_users
    AFTER UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- -----------------------------------------------
-- Auto-create public.users profile on Supabase Auth signup
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, role, created_at)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'role', 'reporter'),
        now()
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users (Supabase's internal auth table)
CREATE OR REPLACE TRIGGER tr_on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------
-- Auto-update report status when verification is inserted
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_verification()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.reports
    SET status = NEW.decision
    WHERE id = NEW.report_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_apply_verification
    AFTER INSERT ON public.verifications
    FOR EACH ROW EXECUTE FUNCTION public.apply_verification();

-- -----------------------------------------------
-- Auto-update updated_at on users table
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
