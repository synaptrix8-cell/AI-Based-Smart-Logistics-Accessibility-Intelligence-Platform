"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/types/database";
import styles from "./auth.module.css";

const ROLE_OPTIONS: { value: UserRole; label: string; description: string; icon: string }[] = [
  {
    value: "reporter",
    label: "Citizen Reporter",
    description: "Report road hazards and receive alerts",
    icon: "📋",
  },
  {
    value: "driver",
    label: "Driver",
    description: "Get safe routes and real-time alerts",
    icon: "🚛",
  },
  {
    value: "official",
    label: "Government Official",
    description: "Verify reports and manage your district",
    icon: "🏛️",
  },
];

export default function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>("reporter");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [useOtp, setUseOtp] = useState(false);

  const supabase = createClient();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (useOtp) {
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: true,
            data: {
              full_name: fullName,
              role: role,
            },
          },
        });

        if (otpError) throw otpError;
        setSuccess(true);
      } else {
        // Standard Email + Password signup
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              role: role,
            },
          },
        });

        if (signUpError) throw signUpError;

        if (data.session) {
          // Instant login when email confirmation is disabled in Supabase
          window.location.href = "/dashboard";
          return;
        } else {
          // Email confirmation is required
          setSuccess(true);
        }
      }
    } catch (err: any) {
      if (err.message?.includes("rate limit")) {
        setError(
          "Supabase test email rate limit reached (free tier allows 3 emails/hr). In your Supabase Dashboard -> Authentication -> Providers -> Email, toggle OFF 'Confirm email' for instant zero-friction signups, or use Instant Demo Access below."
        );
      } else {
        setError(err.message || "Failed to create account.");
      }
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className={styles.authCard}>
        <div className={styles.authHeader}>
          <div className={styles.successIcon}>✉️</div>
          <h1 className={styles.authTitle}>Account Created!</h1>
          <p className={styles.authSubtitle}>
            A verification link has been sent to <strong>{email}</strong>.
            <br />
            Please click the link in your inbox to confirm your account and access the dashboard.
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", width: "100%" }}>
          <a href="/login" className="btn btn-primary btn-lg" style={{ width: "100%" }}>
            Go to Login
          </a>
          <a href="/dashboard?demo=true" className="btn btn-secondary btn-lg" style={{ width: "100%" }}>
            Skip Verification (Demo Mode) →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.authCard}>
      <div className={styles.authHeader}>
        <div className={styles.logo}>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="10" fill="#0A6847" />
            <path
              d="M10 25 L20 12 L30 25 M15 22 L20 15 L25 22"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </div>
        <h1 className={styles.authTitle}>Join Setu</h1>
        <p className={styles.authSubtitle}>
          Help keep NER roads safe and accessible
        </p>
      </div>

      <form onSubmit={handleSignup} className={styles.authForm}>
        <div className={styles.formGroup}>
          <label htmlFor="fullName" className="label">
            Full name
          </label>
          <input
            id="fullName"
            type="text"
            className="input"
            placeholder="e.g. Tenzing Lyngdoh"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="signupEmail" className="label">
            Email address
          </label>
          <input
            id="signupEmail"
            type="email"
            className="input"
            placeholder="you@domain.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        {!useOtp && (
          <div className={styles.formGroup}>
            <label htmlFor="signupPassword" className="label">
              Password
            </label>
            <input
              id="signupPassword"
              type="password"
              className="input"
              placeholder="Create a strong password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
        )}

        <div className={styles.formGroup}>
          <label className="label">I am a...</label>
          <div className={styles.roleGrid}>
            {ROLE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`${styles.roleOption} ${
                  role === option.value ? styles.roleSelected : ""
                }`}
                onClick={() => setRole(option.value)}
              >
                <span className={styles.roleIcon}>{option.icon}</span>
                <span className={styles.roleLabel}>{option.label}</span>
                <span className={styles.roleDesc}>{option.description}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary btn-lg"
          disabled={loading || !email || !fullName || (!useOtp && !password)}
        >
          {loading ? <span className={styles.spinner} /> : "Create Account"}
        </button>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem", marginTop: "0.25rem" }}>
          <button
            type="button"
            onClick={() => setUseOtp(!useOtp)}
            style={{ background: "none", border: "none", color: "var(--color-primary, #0A6847)", cursor: "pointer", padding: 0, textDecoration: "underline" }}
          >
            {useOtp ? "Use Email + Password instead" : "Use Passwordless OTP instead"}
          </button>
        </div>
      </form>

      {error && (
        <div className={styles.alert} data-type="error">
          {error}
        </div>
      )}

      <div style={{ marginTop: "1.25rem", paddingTop: "1rem", borderTop: "1px solid var(--border-color, #e2e8f0)", textAlign: "center" }}>
        <p style={{ fontSize: "0.85rem", color: "var(--text-muted, #64748b)", marginBottom: "0.5rem" }}>
          Evaluating or testing the platform?
        </p>
        <a
          href="/dashboard?demo=true"
          className="btn btn-secondary"
          style={{ width: "100%", display: "inline-block", textAlign: "center", fontSize: "0.9rem" }}
        >
          ⚡ Instant Demo Access (No Email Required)
        </a>
      </div>

      <div className={styles.authFooter}>
        <p>
          Already have an account? <a href="/login">Log in</a>
        </p>
      </div>
    </div>
  );
}
