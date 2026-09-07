"use client";

import { useState, useEffect, useRef } from "react";
import { encryptPayload } from "@/lib/crypto";
import { saveOfflineReport, formatReportSMS, QueuedReport } from "@/lib/offline-queue";
import { EAST_KHASI_HILLS_SEGMENTS } from "@/lib/data/road-segments";
import styles from "./reporting.module.css";

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultSegmentId?: string | null;
  initialMode?: "driver" | "officer";
  onReportSubmitted?: (report: QueuedReport) => void;
}

const CATEGORIES = [
  { id: "landslide", label: "Landslide", icon: "⛰️" },
  { id: "flood", label: "Waterlogging", icon: "🌊" },
  { id: "road_damage", label: "Road Damage", icon: "🚧" },
  { id: "congestion", label: "Gridlock", icon: "🚛" },
  { id: "other", label: "Hazard/Rockfall", icon: "⚠️" },
] as const;

const DRIVER_HAZARDS = [
  { id: "landslide", label: "Landslide", hint: "Rocks or mud on road", icon: "🪨" },
  { id: "flood", label: "Water / Flood", hint: "Road submerged / overflowing", icon: "🌊" },
  { id: "road_damage", label: "Broken Road", hint: "Deep crack or cave-in", icon: "🚧" },
  { id: "other", label: "Road Blocked", hint: "Fallen tree or stuck truck", icon: "⛔" },
] as const;

const QUICK_LANDMARKS = [
  { name: "Umsning (NH-6)", segmentId: "seg-001", lat: 25.75, lng: 91.88 },
  { name: "Mawphlang (SH-5)", segmentId: "seg-007", lat: 25.45, lng: 91.75 },
  { name: "Cherrapunji / Sohra", segmentId: "seg-010", lat: 25.29, lng: 91.71 },
  { name: "Nongpoh (NH-6)", segmentId: "seg-001", lat: 25.90, lng: 91.87 },
  { name: "Dawki Border (NH-40)", segmentId: "seg-013", lat: 25.18, lng: 92.02 },
  { name: "Shillong City Bypass", segmentId: "seg-003", lat: 25.58, lng: 91.89 },
];

export default function ReportModal({
  isOpen,
  onClose,
  defaultSegmentId,
  initialMode = "driver",
  onReportSubmitted,
}: ReportModalProps) {
  const [mode, setMode] = useState<"driver" | "officer">(initialMode);
  const [category, setCategory] = useState<QueuedReport["category"]>("landslide");
  const [segmentId, setSegmentId] = useState<string>(
    defaultSegmentId || EAST_KHASI_HILLS_SEGMENTS[0].id
  );
  const [lat, setLat] = useState<number>(25.2986);
  const [lng, setLng] = useState<number>(91.5822);
  const [nearestLandmark, setNearestLandmark] = useState<string>("Near Cherrapunji / Sohra (SH-5)");
  const [severity, setSeverity] = useState<number>(4);
  const [description, setDescription] = useState<string>("");
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [encrypt, setEncrypt] = useState<boolean>(true);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Auto-acquire GPS on modal open
  useEffect(() => {
    if (isOpen) {
      handleGetLocation(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (defaultSegmentId) {
      setSegmentId(defaultSegmentId);
      const found = EAST_KHASI_HILLS_SEGMENTS.find((c) => c.id === defaultSegmentId);
      if (found && found.coordinates[0]) {
        setLng(found.coordinates[0][0]);
        setLat(found.coordinates[0][1]);
        setNearestLandmark(found.name);
      }
    }
  }, [defaultSegmentId]);

  if (!isOpen) return null;

  const selectedCorridor = EAST_KHASI_HILLS_SEGMENTS.find((c) => c.id === segmentId);

  // Match closest corridor to current GPS
  function resolveNearestCorridor(cLat: number, cLng: number) {
    let closest = EAST_KHASI_HILLS_SEGMENTS[0];
    let minDistance = 999999;

    for (const seg of EAST_KHASI_HILLS_SEGMENTS) {
      if (seg.coordinates && seg.coordinates.length > 0) {
        const midPoint = seg.coordinates[Math.floor(seg.coordinates.length / 2)];
        const dist = Math.hypot(cLat - midPoint[1], cLng - midPoint[0]);
        if (dist < minDistance) {
          minDistance = dist;
          closest = seg;
        }
      }
    }

    setSegmentId(closest.id);
    setNearestLandmark(`${closest.name} (${closest.highway_ref})`);
  }

  function handleGetLocation(showAlert = true) {
    if (!navigator.geolocation) {
      if (showAlert) alert("Geolocation is not supported by your device.");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const cLat = Number(pos.coords.latitude.toFixed(5));
        const cLng = Number(pos.coords.longitude.toFixed(5));
        setLat(cLat);
        setLng(cLng);
        resolveNearestCorridor(cLat, cLng);
        setIsLocating(false);
      },
      (err) => {
        console.warn("GPS error:", err.message);
        setIsLocating(false);
        if (showAlert) alert("Could not fetch GPS. Using nearest highway landmark.");
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  }

  // Handle Photo Capture & Client-Side Canvas Compression (~800px JPEG)
  function handlePhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 800;
        const scaleSize = Math.min(1, MAX_WIDTH / img.width);
        canvas.width = img.width * scaleSize;
        canvas.height = img.height * scaleSize;

        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          // Compress to JPEG with 0.75 quality (~60KB)
          const compressed = canvas.toDataURL("image/jpeg", 0.75);
          setPhotoBase64(compressed);
        }
      };
      if (event.target?.result) {
        img.src = event.target.result as string;
      }
    };
    reader.readAsDataURL(file);
  }

  // Web Speech API Voice-to-Text
  function handleToggleVoice() {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Voice speech recognition is not supported on this browser. You can type notes directly.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-IN"; // Supports Indian English & common accents

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setDescription((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setIsListening(false);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognition.start();
    } catch (err) {
      console.warn("Speech error:", err);
      setIsListening(false);
    }
  }

  // WhatsApp Pre-Formatted Message (100% Free WhatsApp Click-to-Chat)
  function handleWhatsAppShare() {
    const hazardLabel =
      category === "landslide"
        ? "🪨 LANDSLIDE / ROCKS FALLEN"
        : category === "flood"
        ? "🌊 FLASH FLOOD / WATERLOGGING"
        : category === "road_damage"
        ? "🚧 ROAD CRACK / CAVED IN"
        : "⛔ ROAD BLOCKED / TRAFFIC GRIDLOCK";

    const waText = `🚨 *SETU EMERGENCY HAZARD REPORT*
📍 *Location*: ${nearestLandmark}
📌 *GPS*: ${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E
⚠️ *Hazard*: ${hazardLabel}
📝 *Details*: ${description || "Hazard spotted on highway. Road blocked."}
🕒 *Time*: ${new Date().toLocaleTimeString()}
🔗 *Live Platform*: https://frontend-ecru-seven-70.vercel.app/dashboard
(Please attach your hazard photo here)`;

    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(waText)}`;
    window.open(waUrl, "_blank");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setStatusMessage(null);

    const reportId = `rep-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const nowIso = new Date().toISOString();

    let encryptedPayloadStr: string | undefined;
    let ivStr: string | undefined;

    if (encrypt && mode === "officer") {
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
      corridor_name: nearestLandmark || selectedCorridor?.name || "East Khasi Hills Corridor",
      lat,
      lng,
      severity,
      description: description || "Hazard reported by field driver",
      encrypted_payload: encryptedPayloadStr,
      iv: ivStr,
      photo_base64: photoBase64 || undefined,
      created_at: nowIso,
      synced: false,
    };

    // Attempt direct API post
    if (isOnline) {
      try {
        await fetch("/api/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category,
            segment_id: segmentId,
            corridor_name: nearestLandmark || selectedCorridor?.name,
            lat,
            lng,
            severity,
            description: description || "Hazard reported by field driver",
            photo_base64: photoBase64 || null,
            nearest_landmark: nearestLandmark,
            encrypted_payload: encryptedPayloadStr || null,
            iv: ivStr || null,
          }),
        });
        queuedReport.synced = true;
      } catch (err) {
        console.warn("API report push deferred to local queue:", err);
      }
    }

    // Always ensure stored in local IndexedDB queue and localStorage for instantaneous cross-tab visibility
    await saveOfflineReport(queuedReport);

    try {
      if (typeof window !== "undefined") {
        const raw = localStorage.getItem("setu_submitted_reports");
        const list: any[] = raw ? JSON.parse(raw) : [];
        if (!list.some((r) => r.id === queuedReport.id)) {
          list.unshift(queuedReport);
          localStorage.setItem("setu_submitted_reports", JSON.stringify(list));
        }
        window.dispatchEvent(
          new CustomEvent("setu_new_report_submitted", { detail: queuedReport })
        );
      }
    } catch {}

    setSubmitting(false);
    setStatusMessage(
      isOnline
        ? "✅ Report submitted live! Visible in Officer Verification Queue & GIS Triage."
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
    corridor_name: nearestLandmark || selectedCorridor?.name,
    lat,
    lng,
    severity,
    description: description || "Road blocked by rocks and debris",
    created_at: new Date().toISOString(),
  };

  const smsText = formatReportSMS(currentReportPreview);
  const smsGatewayNumber = process.env.NEXT_PUBLIC_SMS_GATEWAY_PHONE || "1077";
  const smsHref = `sms:${smsGatewayNumber}?body=${encodeURIComponent(smsText)}`;

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
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

        {/* Mode Selector Tabs */}
        <div style={{ padding: "12px 24px 0 24px" }}>
          <div className={styles.modeTabs}>
            <button
              type="button"
              className={styles.modeTab}
              data-active={mode === "driver"}
              onClick={() => setMode("driver")}
            >
              <span>📸</span> Driver Quick Mode (Simple)
            </button>
            <button
              type="button"
              className={styles.modeTab}
              data-active={mode === "officer"}
              onClick={() => setMode("officer")}
            >
              <span>📋</span> Detailed Officer Mode
            </button>
          </div>
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

          {/* ============================================================= */}
          {/* DRIVER QUICK MODE (ACCESSIBLE 3-STEP FLOW)                    */}
          {/* ============================================================= */}
          {mode === "driver" && (
            <div className={styles.driverMode}>
              {/* Step 1: Camera Photo Snap */}
              <div>
                <label className={styles.label} style={{ fontSize: "0.85rem", marginBottom: "6px", display: "block" }}>
                  1. 📸 Take Hazard Photo (Camera / Gallery)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  ref={fileInputRef}
                  onChange={handlePhotoCapture}
                  style={{ display: "none" }}
                />

                {photoBase64 ? (
                  <div className={styles.previewContainer}>
                    <img src={photoBase64} alt="Captured hazard" className={styles.previewImg} />
                    <button
                      type="button"
                      className={styles.removePhotoBtn}
                      onClick={() => setPhotoBase64(null)}
                    >
                      ✕ Retake Photo
                    </button>
                  </div>
                ) : (
                  <div
                    className={styles.photoDropzone}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className={styles.cameraIcon}>📸</div>
                    <div className={styles.photoPrompt}>Tap to Take Photo of Hazard</div>
                    <div className={styles.photoSubtext}>Opens smartphone camera directly</div>
                  </div>
                )}
              </div>

              {/* Step 2: Auto-GPS Location */}
              <div>
                <label className={styles.label} style={{ fontSize: "0.85rem", marginBottom: "6px", display: "block" }}>
                  2. 📍 Location Detected
                </label>
                <div className={styles.autoGpsCard}>
                  <div className={styles.gpsInfo}>
                    <span>🛰️</span>
                    <div>
                      <div className={styles.gpsTitle}>{nearestLandmark}</div>
                      <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.6)" }}>
                        GPS: {lat.toFixed(4)}° N, {lng.toFixed(4)}° E
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={styles.refreshGpsBtn}
                    onClick={() => handleGetLocation(true)}
                    disabled={isLocating}
                  >
                    {isLocating ? "Locating..." : "📍 Re-check GPS"}
                  </button>
                </div>

                {/* Quick Landmark Overrides */}
                <div className={styles.landmarkPills}>
                  {QUICK_LANDMARKS.map((lm) => (
                    <button
                      key={lm.name}
                      type="button"
                      className={styles.landmarkPill}
                      data-selected={nearestLandmark.includes(lm.name.split(" ")[0])}
                      onClick={() => {
                        setNearestLandmark(lm.name);
                        setSegmentId(lm.segmentId);
                        setLat(lm.lat);
                        setLng(lm.lng);
                      }}
                    >
                      {lm.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 3: 1-Tap Big Visual Hazard Buttons */}
              <div>
                <label className={styles.label} style={{ fontSize: "0.85rem", marginBottom: "6px", display: "block" }}>
                  3. ⚠️ What happened on the road?
                </label>
                <div className={styles.driverGrid}>
                  {DRIVER_HAZARDS.map((h) => (
                    <button
                      type="button"
                      key={h.id}
                      className={styles.driverHazardBtn}
                      data-type={h.id}
                      data-active={category === h.id}
                      onClick={() => {
                        setCategory(h.id as QueuedReport["category"]);
                        if (!description) {
                          setDescription(h.hint);
                        }
                      }}
                    >
                      <span className={styles.driverHazardIcon}>{h.icon}</span>
                      <div>
                        <span className={styles.driverHazardLabel}>{h.label}</span>
                        <span className={styles.driverHazardHint}>{h.hint}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Voice Note / Short Remarks */}
              <div className={styles.voiceBox}>
                <label className={styles.label} style={{ fontSize: "0.85rem" }}>
                  4. 🎙️ Speak or Type Note (Optional)
                </label>
                <textarea
                  className={styles.voiceTextarea}
                  placeholder="Tap mic to speak, or type: e.g. Boulders blocking left lane near bridge..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
                <button
                  type="button"
                  className={`${styles.micBtn} ${isListening ? styles.micListening : ""}`}
                  onClick={handleToggleVoice}
                  title="Speak in Hindi/English"
                >
                  🎙️
                </button>
              </div>

              {/* Driver Action Buttons: WhatsApp + Submit */}
              <div className={styles.driverSubmitRow}>
                <button
                  type="button"
                  className={styles.whatsappBtn}
                  onClick={handleWhatsAppShare}
                  title="Forward pre-filled hazard details directly to WhatsApp (Free)"
                >
                  <span>📲</span> Share on WhatsApp
                </button>
                <button
                  type="submit"
                  className={styles.driverSubmitBtn}
                  disabled={submitting}
                >
                  {submitting ? "Transmitting..." : isOnline ? "Submit to Live Map 🚀" : "Queue Offline 💾"}
                </button>
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* DETAILED OFFICER MODE                                          */}
          {/* ============================================================= */}
          {mode === "officer" && (
            <>
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
                  onChange={(e) => {
                    setSegmentId(e.target.value);
                    const found = EAST_KHASI_HILLS_SEGMENTS.find((c) => c.id === e.target.value);
                    if (found) setNearestLandmark(found.name);
                  }}
                >
                  {EAST_KHASI_HILLS_SEGMENTS.map((corridor) => (
                    <option key={corridor.id} value={corridor.id}>
                      {corridor.name} ({corridor.highway_ref}) - Slope: {corridor.factors.slope_deg}°
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
                    onClick={() => handleGetLocation(true)}
                    disabled={isLocating}
                  >
                    {isLocating ? "📡 Locating..." : "📍 GPS Auto"}
                  </button>
                </div>
              </div>

              {/* Severity Level Slider */}
              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Severity Level ({severity}/5): {
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
                  <a href={smsHref} className={styles.smsBtn} title="Emergency 160-char SMS to State Disaster Operations (1077)">
                    <span>💬</span> Send via SMS (1077)
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
            </>
          )}
        </form>
      </div>
    </div>
  );
}
