"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./auth.module.css";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [useOtp, setUseOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const supabase = createClient();

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      window.location.href = "/dashboard";
    }
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
      },
    });

    if (error) {
      if (error.message?.includes("rate limit")) {
        setError("Supabase email rate limit exceeded (3 emails/hr). Please log in with your Password or use Instant Demo Access below.");
      } else {
        setError(error.message);
      }
    } else {
      setOtpSent(true);
      setMessage("Check your email for the login code.");
    }
    setLoading(false);
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "email",
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      window.location.href = "/dashboard";
    }
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
        <h1 className={styles.authTitle}>Welcome to Setu</h1>
        <p className={styles.authSubtitle}>
          Smart Logistics & Accessibility Platform for NER
        </p>
      </div>

      {!useOtp ? (
        <form onSubmit={handlePasswordLogin} className={styles.authForm}>
          <div className={styles.formGroup}>
            <label htmlFor="email" className="label">
              Email address
            </label>
            <input
              id="email"
              type="email"
              className="input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="password" className="label">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="input"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={loading || !email || !password}
          >
            {loading ? <span className={styles.spinner} /> : "Sign In"}
          </button>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem", marginTop: "0.25rem" }}>
            <button
              type="button"
              onClick={() => setUseOtp(true)}
              style={{ background: "none", border: "none", color: "var(--color-primary, #0A6847)", cursor: "pointer", padding: 0, textDecoration: "underline" }}
            >
              Sign in with Email OTP instead
            </button>
          </div>
        </form>
      ) : !otpSent ? (
        <form onSubmit={handleSendOtp} className={styles.authForm}>
          <div className={styles.formGroup}>
            <label htmlFor="email" className="label">
              Email address
            </label>
            <input
              id="email"
              type="email"
              className="input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={loading || !email}
          >
            {loading ? <span className={styles.spinner} /> : "Send Login Code"}
          </button>
          <button
            type="button"
            onClick={() => setUseOtp(false)}
            style={{ background: "none", border: "none", color: "var(--color-primary, #0A6847)", cursor: "pointer", fontSize: "0.85rem", marginTop: "0.25rem", textDecoration: "underline" }}
          >
            ← Back to Password login
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp} className={styles.authForm}>
          <div className={styles.formGroup}>
            <label htmlFor="otp" className="label">
              Enter the 6-digit code sent to {email}
            </label>
            <input
              id="otp"
              type="text"
              className="input"
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              required
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={6}
              autoFocus
              style={{ textAlign: "center", fontSize: "1.5rem", letterSpacing: "0.5em" }}
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={loading || otp.length !== 6}
          >
            {loading ? <span className={styles.spinner} /> : "Verify & Log In"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setOtpSent(false);
              setOtp("");
              setMessage(null);
            }}
          >
            ← Use a different email
          </button>
        </form>
      )}

      {error && (
        <div className={styles.alert} data-type="error">
          {error}
        </div>
      )}
      {message && (
        <div className={styles.alert} data-type="success">
          {message}
        </div>
      )}

      <div style={{ marginTop: "1.25rem", paddingTop: "1rem", borderTop: "1px solid var(--border-color, #e2e8f0)", textAlign: "center" }}>
        <p style={{ fontSize: "0.85rem", color: "var(--text-muted, #64748b)", marginBottom: "0.5rem" }}>
          Evaluating or testing the platform?
        </p>
        <a
          href="/dashboard?demo=true"
          onClick={() => {
            document.cookie = "setu_demo=true; path=/; max-age=86400; SameSite=Lax";
          }}
          className="btn btn-secondary"
          style={{ width: "100%", display: "inline-block", textAlign: "center", fontSize: "0.9rem" }}
        >
          ⚡ Instant Demo Access (No Email Required)
        </a>
      </div>

      <div className={styles.authFooter}>
        <p>
          Don&apos;t have an account?{" "}
          <a href="/signup">Sign up</a>
        </p>
      </div>
    </div>
  );
}
