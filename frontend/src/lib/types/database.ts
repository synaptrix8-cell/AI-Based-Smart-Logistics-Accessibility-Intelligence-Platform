/**
 * Database TypeScript Types
 * 
 * These types mirror the Supabase/Postgres schema defined in
 * infra/supabase/migrations/002_create_tables.sql
 * 
 * In production, generate these automatically using:
 *   npx supabase gen types typescript --project-id YOUR_PROJECT_ID > database.ts
 */

export type UserRole = "driver" | "reporter" | "official" | "admin";

export type ReportCategory =
  | "landslide"
  | "flood"
  | "road_damage"
  | "congestion"
  | "other";

export type ReportStatus = "unverified" | "verified" | "rejected";

export type VerificationDecision = "verified" | "rejected";

export type AlertChannel = "sms" | "whatsapp" | "push" | "in_app";

// -----------------------------------------------
// Table row types
// -----------------------------------------------

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  district_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface District {
  id: string;
  name: string;
  state: string;
  geometry: GeoJSON.MultiPolygon | null;
  created_at: string;
}

export interface RoadSegment {
  id: string;
  district_id: string;
  geometry: GeoJSON.LineString;
  name: string | null;
  highway_ref: string | null;
  base_risk: number;
  length_km: number | null;
  surface_type: string;
  elevation_gain_m: number | null;
  created_at: string;
}

export interface RiskScore {
  id: string;
  segment_id: string;
  score: number;
  computed_at: string;
  factors: RiskFactors;
}

export interface RiskFactors {
  rainfall_mm?: number;
  slope_deg?: number;
  report_count?: number;
  historical_incidents?: number;
  days_since_last_incident?: number;
}

export interface Report {
  id: string;
  user_id: string;
  segment_id: string | null;
  category: ReportCategory;
  encrypted_payload: string | null;
  iv: string | null;
  status: ReportStatus;
  lat: number;
  lng: number;
  created_at: string;
}

export interface Verification {
  id: string;
  report_id: string;
  official_id: string;
  decision: VerificationDecision;
  notes: string | null;
  decided_at: string;
}

export interface Alert {
  id: string;
  segment_id: string | null;
  district_id: string | null;
  risk_score: number | null;
  message: string;
  sent_at: string;
  channel: AlertChannel;
}

export interface Subscription {
  id: string;
  user_id: string;
  district_id: string | null;
  segment_id: string | null;
  channel: AlertChannel;
  created_at: string;
}

export interface SmsGatewayLog {
  id: string;
  raw_message: string;
  parsed_category: string | null;
  parsed_segment: string | null;
  sender_phone: string | null;
  processing_status: string;
  error_message: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  table_name: string;
  row_id: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

// -----------------------------------------------
// Supabase Database type definition
// -----------------------------------------------

export interface Database {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: Omit<User, "created_at" | "updated_at">;
        Update: Partial<Omit<User, "id" | "created_at">>;
      };
      districts: {
        Row: District;
        Insert: Omit<District, "id" | "created_at">;
        Update: Partial<Omit<District, "id">>;
      };
      road_segments: {
        Row: RoadSegment;
        Insert: Omit<RoadSegment, "id" | "created_at">;
        Update: Partial<Omit<RoadSegment, "id">>;
      };
      risk_scores: {
        Row: RiskScore;
        Insert: Omit<RiskScore, "id" | "computed_at">;
        Update: never;
      };
      reports: {
        Row: Report;
        Insert: Omit<Report, "id" | "created_at">;
        Update: Partial<Pick<Report, "status" | "segment_id">>;
      };
      verifications: {
        Row: Verification;
        Insert: Omit<Verification, "id" | "decided_at">;
        Update: never;
      };
      alerts: {
        Row: Alert;
        Insert: Omit<Alert, "id" | "sent_at">;
        Update: never;
      };
      subscriptions: {
        Row: Subscription;
        Insert: Omit<Subscription, "id" | "created_at">;
        Update: Partial<Pick<Subscription, "channel" | "district_id" | "segment_id">>;
      };
      sms_gateway_log: {
        Row: SmsGatewayLog;
        Insert: Omit<SmsGatewayLog, "id" | "created_at">;
        Update: Partial<Pick<SmsGatewayLog, "processing_status" | "error_message">>;
      };
      audit_log: {
        Row: AuditLog;
        Insert: Omit<AuditLog, "id" | "created_at">;
        Update: never;
      };
    };
  };
}
