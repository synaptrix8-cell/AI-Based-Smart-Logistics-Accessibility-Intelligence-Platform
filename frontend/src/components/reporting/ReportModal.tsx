"use client";

import { useState, useEffect } from "react";
import { encryptPayload } from "@/lib/crypto";
import { saveOfflineReport, formatReportSMS, QueuedReport } from "@/lib/offline-queue";
import { EAST_KHASI_HILLS_SEGMENTS } from "@/lib/data/road-segments";
import { createClient } from "@/lib/supabase/client";
import styles from "./reporting.module.css";

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultSegmentId?: string | null;
  onReportSubmitted?: (report: QueuedReport) => void;
}

const CATEGORIES = [
  { id: "landslide", label: "Landslide", icon: "⛰️" },
  { id: "flood", label: "Waterlogging", icon: "🌊" },
  { id: "road_damage", label: "Road Damage", icon: "🚧" },
  { id: "congestion", label: "Gridlock", icon: "🚛" },
  { id: "other", label: "Hazard/Rockfall", icon: "⚠️" },
] as const;

export default function ReportModal({
  isOpen,
  onClose,
  defaultSegmentId,
  onReportSubmitted,
}: ReportModalProps) {
  const [category, setCategory] = useState<QueuedReport["category"]>("landslide");
  const [segmentId, setSegmentId] = useState<string>(
    defaultSegmentId || EAST_KHASI_HILLS_SEGMENTS[0].id
  );
  const [lat, setLat] = useState<number>(25.2986);
  const [lng, setLng] = useState<number>(91.5822);
  const [severity, setSeverity] = useState<number>(4);
  const [description, setDescription] = useState<string>("");
  const [encrypt, setEncrypt] = useState<boolean>(true);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsOnline(navigator.onLine);
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, []);

  useEffect(() => {
    if (defaultSegmentId) {
      setSegmentId(defaultSegmentId);
      const found = EAST_KHASI_HILLS_SEGMENTS.find((c) => c.id === defaultSegmentId);
      if (found && found.coordinates[0]) {
        setLng(found.coordinates[0][0]);
        setLat(found.coordinates[0][1]);
      }
    }
  }, [defaultSegmentId]);

  if (!isOpen) return null;

  const selectedCorridor = EAST_KHASI_HILLS_SEGMENTS.find((c) => c.id === segmentId);

  function handleGetLocation() {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your device.");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(Number(pos.coords.latitude.toFixed(5)));
        setLng(Number(pos.coords.longitude.toFixed(5)));
        setIsLocating(false);
      },
      (err) => {
        console.warn("GPS error:", err.message);
        setIsLocating(false);
        alert("Could not fetch GPS. Using corridor midpoint.");
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setStatusMessage(null);

    const reportId = `rep-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const nowIso = new Date().toISOString();

    let encryptedPayloadStr: string | undefined;
    let ivStr: string | undefined;

    if (encrypt) {
      const enc = await encryptPayload({
        description,
        reporter_note: "Submitted via Setu Field PWA",
        captured_at: nowIso,
      });
      encryptedPayloadStr = enc.ciphertext;
      ivStr = enc.iv;
    }

    const queuedReport: QueuedReport = {
      id: reportId,
      category,
      segment_id: segmentId,
      corridor_name: selectedCorridor?.name || "East Khasi Hills Corridor",
      lat,
      lng,
      severity,
      description,
      encrypted_payload: encryptedPayloadStr,
      iv: ivStr,
      created_at: nowIso,
      synced: false,
    };

    // If online and Supabase is accessible, attempt network push
    if (isOnline) {
      try {
        const supabase = createClient();
        const { data: userData } = await supabase.auth.getUser();

        if (userData?.user) {
          const { error } = await supabase.from("reports").insert({
            user_id: userData.user.id,
            segment_id: segmentId,
            category,
            lat,
            lng,
            severity,
            status: "unverified",
            encrypted_payload: encryptedPayloadStr || description,
            iv: ivStr || "plain",
          });

          if (!error) {
            queuedReport.synced = true;
          }
        }
      } catch (err) {
        console.warn("Online push deferred to offline queue:", err);
      }
    }

    // Always ensure stored in local IndexedDB queue
    await saveOfflineReport(queuedReport);

    setSubmitting(false);
    setStatusMessage(
      isOnline
        ? "✅ Report submitted successfully to district command queue!"
        : "📡 Offline: Report queued in IndexedDB. Will auto-sync when online."
    );

    if (onReportSubmitted) {
      onReportSubmitted(queuedReport);
    }

    setTimeout(() => {
      onClose();
    }, 1200);
  }

  const currentReportPreview: QueuedReport = {
    id: "preview",
    category,
    corridor_name: selectedCorridor?.name,
    lat,
    lng,
    severity,
    description: description || "Road blocked by rocks and debris",
    created_at: new Date().toISOString(),
  };

  const smsText = formatReportSMS(currentReportPreview);
  const smsHref = `sms:+919436000000?body=${encodeURIComponent(smsText)}`;

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <span className={styles.iconMark}>🚨</span>
            <div>
              <h2 className={styles.title}>Report Road Hazard</h2>
              <p className={styles.subtitle}>
                East Khasi Hills • Real-time Accessibility Network
              </p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.body}>
          {!isOnline && (
            <div className={styles.offlineBanner}>
              <span>📡</span>
              <div>
                <strong>Offline Mode Active</strong>
                <div>Zero cell signal detected. Report will save to your device and sync once connected.</div>
              </div>
            </div>
          )}

          {statusMessage && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "8px",
                background: "rgba(16, 185, 129, 0.2)",
                border: "1px solid #10b981",
                color: "#6ee7b7",
                fontSize: "0.85rem",
              }}
            >
              {statusMessage}
            </div>
          )}

          {/* Hazard Category Selector */}
          <div className={styles.formGroup}>
            <label className={styles.label}>Hazard Category</label>
            <div className={styles.categoryGrid}>
              {CATEGORIES.map((cat) => (
                <button
                  type="button"
                  key={cat.id}
                  className={styles.catBtn}
                  data-active={category === cat.id}
                  onClick={() => setCategory(cat.id as QueuedReport["category"])}
                >
                  <span className={styles.catIcon}>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Road Corridor Picker */}
          <div className={styles.formGroup}>
            <label className={styles.label}>Affected Road Corridor</label>
            <select
              className={styles.select}
              value={segmentId}
              onChange={(e) => setSegmentId(e.target.value)}
            >
              {EAST_KHASI_HILLS_SEGMENTS.map((corridor) => (
                <option key={corridor.id} value={corridor.id}>
                  {corridor.name} ({corridor.highway_ref}) — Slope: {corridor.factors.slope_deg}°
                </option>
              ))}
            </select>
          </div>

          {/* GPS Coordinates */}
          <div className={styles.formGroup}>
            <label className={styles.label}>Incident GPS Location</label>
            <div className={styles.gpsRow}>
              <input
                type="number"
                step="0.0001"
                className={styles.input}
                value={lat}
                onChange={(e) => setLat(parseFloat(e.target.value))}
                placeholder="Latitude (e.g. 25.298)"
              />
              <input
                type="number"
                step="0.0001"
                className={styles.input}
                value={lng}
                onChange={(e) => setLng(parseFloat(e.target.value))}
                placeholder="Longitude (e.g. 91.582)"
              />
              <button
                type="button"
                className={styles.gpsBtn}
                onClick={handleGetLocation}
                disabled={isLocating}
              >
                {isLocating ? "📡 Locating..." : "📍 GPS Auto"}
              </button>
            </div>
          </div>

          {/* Severity Level Slider */}
          <div className={styles.formGroup}>
            <label className={styles.label}>
              Severity Level ({severity}/5) — {
                severity === 1
                  ? "Minor debris"
                  : severity === 2
                  ? "Slow traffic"
                  : severity === 3
                  ? "Single lane blocked"
                  : severity === 4
                  ? "Full blockage / Active Landslide"
                  : "Bridge / Road Collapse"
              }
            </label>
            <div className={styles.severityGroup}>
              {[1, 2, 3, 4, 5].map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  className={styles.sevBtn}
                  data-level={lvl}
                  data-active={severity === lvl}
                  onClick={() => setSeverity(lvl)}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className={styles.formGroup}>
            <label className={styles.label}>Field Description & Remarks</label>
            <textarea
              className={styles.textarea}
              placeholder="e.g. Large mudslide covered both lanes near 12km milestone. Boulders active."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          {/* End-to-end encryption toggle */}
          <div className={styles.encryptRow}>
            <div className={styles.encryptLabel}>
              <span>🔒</span>
              <div>
                <strong>Client-Side AES-GCM Encryption</strong>
                <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.6)" }}>
                  Protects sensitive reporter metadata before network transit
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={encrypt}
              onChange={(e) => setEncrypt(e.target.checked)}
              style={{ width: "18px", height: "18px", accentColor: "#10b981", cursor: "pointer" }}
            />
          </div>

          <div className={styles.footer}>
            <div className={styles.fallbackActions}>
              <a href={smsHref} className={styles.smsBtn} title="Emergency 160-char SMS">
                <span>💬</span> Send via SMS
              </a>
            </div>

            <button
              type="submit"
              className={styles.submitBtn}
              disabled={submitting}
            >
              {submitting ? "Transmitting..." : isOnline ? "Submit Incident 🚀" : "Queue Offline 💾"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
