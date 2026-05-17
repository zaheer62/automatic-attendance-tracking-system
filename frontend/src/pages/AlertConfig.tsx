import { useEffect, useState } from "react";
import api from "../api/axios";

interface AlertRule {
  id?: number;
  subject_id: number | "";
  threshold_percentage: number;
  notify_email: boolean;
  notify_sms: boolean;
  email_address: string;
  phone_number: string;
  is_active: boolean;
}

interface Subject {
  id: number;
  name: string;
  code: string;
}

interface AlertDetail {
  student: string;
  percentage: number;
  threshold: number;
  channels: string[];
}

interface CheckResult {
  alerts_checked: number;
  alerts_sent: number;
  details: AlertDetail[];
}

const DEFAULT_RULE: AlertRule = {
  subject_id: "",
  threshold_percentage: 75,
  notify_email: true,
  notify_sms: false,
  email_address: "",
  phone_number: "",
  is_active: true,
};

export default function AlertConfig() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [form, setForm] = useState<AlertRule>({ ...DEFAULT_RULE });
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [loading, setLoading] = useState(true);

  // Teacher contact for the /check endpoint
  const [teacherEmail, setTeacherEmail] = useState("");
  const [teacherPhone, setTeacherPhone] = useState("");

  useEffect(() => {
    Promise.all([
      api.get("/subjects/").catch(() => ({ data: [] })),
      api.get("/alerts/").catch(() => ({ data: [] })),
    ]).then(([s, a]) => {
      setSubjects(s.data || []);
      setRules(a.data || []);
      setLoading(false);
    });
  }, []);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleSave = async () => {
    if (!form.subject_id) return showToast("Please select a subject", "error");
    if (form.notify_email && !form.email_address) return showToast("Enter a teacher email address", "error");
    if (form.notify_sms && !form.phone_number) return showToast("Enter a phone number", "error");

    setSaving(true);
    try {
      const res = await api.post("/alerts/", form);
      setRules((prev) => [...prev, res.data]);
      setForm({ ...DEFAULT_RULE });
      showToast("Alert rule saved successfully", "success");
    } catch {
      showToast("Failed to save alert rule", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/alerts/${id}`);
      setRules((prev) => prev.filter((r) => r.id !== id));
      showToast("Rule deleted", "success");
    } catch {
      showToast("Failed to delete rule", "error");
    }
  };

  const handleSendAlerts = async () => {
    setChecking(true);
    setShowResult(false);
    try {
      const params = new URLSearchParams();
      if (teacherEmail) params.append("teacher_email", teacherEmail);
      if (teacherPhone) params.append("teacher_phone", teacherPhone);

      const res = await api.post(`/alerts/check?${params.toString()}`);
      setCheckResult(res.data);
      setShowResult(true);

      if (res.data.alerts_sent === 0) {
        showToast("✅ All students are above threshold — no alerts needed!", "success");
      } else {
        showToast(`📨 ${res.data.alerts_sent} alert(s) sent successfully`, "success");
      }
    } catch {
      showToast("Failed to run attendance check", "error");
    } finally {
      setChecking(false);
    }
  };

  const handleToggle = (key: keyof AlertRule, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#f8f7f4",
      fontFamily: "'Lato', sans-serif",
      padding: "40px 24px",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700;900&display=swap" rel="stylesheet" />

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 24, right: 24, zIndex: 999,
          background: toast.type === "success" ? "#166534" : "#991b1b",
          color: "#fff", padding: "12px 24px", borderRadius: 8,
          fontSize: 14, boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
          animation: "slideIn 0.3s ease", maxWidth: 320,
        }}>
          {toast.msg}
        </div>
      )}

      <div style={{ maxWidth: 960, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <div style={{
            display: "inline-block",
            background: "#dc2626", color: "#fff",
            fontSize: 10, fontWeight: 700, letterSpacing: 2,
            padding: "4px 12px", borderRadius: 2, marginBottom: 12,
          }}>
            ALERT CONFIGURATION
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 900, color: "#111", margin: 0, lineHeight: 1.1 }}>
            Attendance<br />Alert Rules
          </h1>
          <p style={{ color: "#6b7280", marginTop: 12, fontSize: 15, marginBottom: 0 }}>
            Set thresholds and notification channels for low attendance alerts.
          </p>
        </div>

        {/* ── Send Alerts Now panel ─────────────────────────────────────── */}
        <div style={{
          background: "#fff", borderRadius: 12, padding: 28,
          border: "1px solid #e5e7eb", marginBottom: 32,
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111", margin: "0 0 4px" }}>
                📨 Send Alerts Now
              </h2>
              <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
                Checks all students against active rules and sends email/SMS to those below threshold.
              </p>
            </div>
          </div>

          {/* Teacher contact fields */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 20 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6, letterSpacing: 0.5 }}>
                YOUR EMAIL (to receive a copy)
              </label>
              <input
                type="email"
                placeholder="teacher@college.edu"
                value={teacherEmail}
                onChange={(e) => setTeacherEmail(e.target.value)}
                style={{
                  width: "100%", padding: "10px 12px", boxSizing: "border-box",
                  border: "1.5px solid #e5e7eb", borderRadius: 8,
                  fontSize: 14, outline: "none",
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6, letterSpacing: 0.5 }}>
                YOUR PHONE (for SMS copy — optional)
              </label>
              <input
                type="tel"
                placeholder="+91 98765 43210"
                value={teacherPhone}
                onChange={(e) => setTeacherPhone(e.target.value)}
                style={{
                  width: "100%", padding: "10px 12px", boxSizing: "border-box",
                  border: "1.5px solid #e5e7eb", borderRadius: 8,
                  fontSize: 14, outline: "none",
                }}
              />
            </div>
          </div>

          <button
            onClick={handleSendAlerts}
            disabled={checking || rules.length === 0}
            style={{
              marginTop: 20,
              padding: "13px 32px",
              background: checking ? "#9ca3af" : rules.length === 0 ? "#d1d5db" : "#dc2626",
              color: "#fff", border: "none", borderRadius: 8,
              fontSize: 15, fontWeight: 700, cursor: checking || rules.length === 0 ? "not-allowed" : "pointer",
              letterSpacing: 0.5, transition: "background 0.2s",
            }}
          >
            {checking ? "⏳ Checking attendance …" : rules.length === 0 ? "No rules configured yet" : "🚨 Send Alerts Now"}
          </button>

          {rules.length === 0 && (
            <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 8, marginBottom: 0 }}>
              Create at least one alert rule below before sending.
            </p>
          )}

          {/* Result panel */}
          {showResult && checkResult && (
            <div style={{
              marginTop: 20, background: "#f0fdf4", border: "1px solid #bbf7d0",
              borderRadius: 10, padding: 20, animation: "slideIn 0.3s ease",
            }}>
              <div style={{ display: "flex", gap: 24, marginBottom: 12, flexWrap: "wrap" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: "#166534" }}>{checkResult.alerts_checked}</div>
                  <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>STUDENTS CHECKED</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: checkResult.alerts_sent > 0 ? "#dc2626" : "#166534" }}>
                    {checkResult.alerts_sent}
                  </div>
                  <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>ALERTS SENT</div>
                </div>
              </div>

              {checkResult.details.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {checkResult.details.map((d, i) => (
                    <div key={i} style={{
                      background: "#fff", borderRadius: 8, padding: "10px 14px",
                      border: "1px solid #e5e7eb", borderLeft: "3px solid #dc2626",
                      display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8,
                    }}>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: 13, color: "#111" }}>{d.student}</span>
                        <span style={{ fontSize: 12, color: "#6b7280", marginLeft: 8 }}>
                          {d.percentage}% (below {d.threshold}%)
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {(d.channels || []).map((ch, j) => (
                          <span key={j} style={{
                            fontSize: 10, background: "#fef2f2", color: "#dc2626",
                            border: "1px solid #fecaca", borderRadius: 20,
                            padding: "2px 8px", fontWeight: 600,
                          }}>
                            {ch}
                          </span>
                        ))}
                        {(!d.channels || d.channels.length === 0) && (
                          <span style={{ fontSize: 10, color: "#9ca3af" }}>logged only</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {checkResult.alerts_sent === 0 && (
                <p style={{ color: "#166534", fontWeight: 600, fontSize: 14, margin: 0 }}>
                  ✅ All students are above the attendance threshold — no alerts needed.
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Form + Rules grid ────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>

          {/* Form */}
          <div style={{
            background: "#fff", borderRadius: 12, padding: 28,
            border: "1px solid #e5e7eb",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111", marginTop: 0, marginBottom: 24 }}>
              New Alert Rule
            </h2>

            <div style={{
              background: "#fef2f2", border: "1px solid #fecaca",
              borderRadius: 8, padding: "10px 14px", marginBottom: 20,
              fontSize: 12, color: "#991b1b", lineHeight: 1.6,
            }}>
              <strong>Who receives alerts when you click "Send Alerts Now"?</strong><br />
              👤 <strong>Student</strong> — their registered email automatically<br />
              👨‍🏫 <strong>You</strong> — the email/phone you enter in the Send panel above
            </div>

            {/* Subject */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6, letterSpacing: 0.5 }}>
                SUBJECT
              </label>
              <select
                value={form.subject_id}
                onChange={(e) => handleToggle("subject_id", Number(e.target.value))}
                style={{
                  width: "100%", padding: "10px 12px",
                  border: "1.5px solid #e5e7eb", borderRadius: 8,
                  fontSize: 14, color: "#111", background: "#fff",
                  outline: "none", cursor: "pointer",
                }}
              >
                <option value="">Select a subject …</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                ))}
              </select>
            </div>

            {/* Threshold */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6, letterSpacing: 0.5 }}>
                MINIMUM ATTENDANCE THRESHOLD
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <input
                  type="range" min={50} max={100} step={5}
                  value={form.threshold_percentage}
                  onChange={(e) => handleToggle("threshold_percentage", Number(e.target.value))}
                  style={{ flex: 1, accentColor: "#dc2626" }}
                />
                <div style={{
                  minWidth: 52, textAlign: "center",
                  background: "#dc2626", color: "#fff",
                  fontWeight: 700, fontSize: 15,
                  borderRadius: 6, padding: "4px 8px",
                }}>
                  {form.threshold_percentage}%
                </div>
              </div>
              <p style={{ fontSize: 12, color: "#9ca3af", margin: "6px 0 0" }}>
                Alert triggers when attendance drops below this value
              </p>
            </div>

            {/* Notify channels */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 10, letterSpacing: 0.5 }}>
                NOTIFICATION CHANNELS
              </label>
              <div style={{ display: "flex", gap: 12 }}>
                {[
                  { key: "notify_email", label: "📧 Email" },
                  { key: "notify_sms", label: "📱 SMS" },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => handleToggle(key as keyof AlertRule, !form[key as keyof AlertRule])}
                    style={{
                      padding: "8px 20px", borderRadius: 6, fontSize: 13, fontWeight: 600,
                      cursor: "pointer", transition: "all 0.2s",
                      border: form[key as keyof AlertRule] ? "2px solid #dc2626" : "2px solid #e5e7eb",
                      background: form[key as keyof AlertRule] ? "#fef2f2" : "#fff",
                      color: form[key as keyof AlertRule] ? "#dc2626" : "#6b7280",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Teacher Email for the rule (stored, informational) */}
            {form.notify_email && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6, letterSpacing: 0.5 }}>
                  TEACHER EMAIL (for this rule — optional reference)
                </label>
                <input
                  type="email"
                  placeholder="teacher@college.edu"
                  value={form.email_address}
                  onChange={(e) => handleToggle("email_address", e.target.value)}
                  style={{
                    width: "100%", padding: "10px 12px", boxSizing: "border-box",
                    border: "1.5px solid #e5e7eb", borderRadius: 8,
                    fontSize: 14, outline: "none",
                  }}
                />
              </div>
            )}

            {form.notify_sms && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6, letterSpacing: 0.5 }}>
                  PHONE NUMBER
                </label>
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={form.phone_number}
                  onChange={(e) => handleToggle("phone_number", e.target.value)}
                  style={{
                    width: "100%", padding: "10px 12px", boxSizing: "border-box",
                    border: "1.5px solid #e5e7eb", borderRadius: 8,
                    fontSize: 14, outline: "none",
                  }}
                />
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                width: "100%", padding: "12px",
                background: saving ? "#9ca3af" : "#111",
                color: "#fff", border: "none", borderRadius: 8,
                fontSize: 14, fontWeight: 700,
                cursor: saving ? "not-allowed" : "pointer",
                letterSpacing: 0.5, marginTop: 8,
                transition: "background 0.2s",
              }}
            >
              {saving ? "Saving …" : "Save Alert Rule"}
            </button>
          </div>

          {/* Rules list */}
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111", marginTop: 0, marginBottom: 16 }}>
              Active Rules ({rules.length})
            </h2>

            {loading ? (
              <div style={{ color: "#9ca3af", fontSize: 14 }}>Loading rules …</div>
            ) : rules.length === 0 ? (
              <div style={{
                background: "#fff", border: "1.5px dashed #e5e7eb",
                borderRadius: 12, padding: 32, textAlign: "center",
                color: "#9ca3af", fontSize: 14,
              }}>
                No alert rules configured yet.<br />Create one using the form.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {rules.map((rule, i) => {
                  const subjectName = subjects.find((s) => s.id === rule.subject_id)?.name
                    ?? `Subject #${rule.subject_id}`;
                  const threshold = rule.threshold_percentage ?? (rule as any).threshold_percent ?? "?";
                  const channels = [rule.notify_email && "Email", rule.notify_sms && "SMS"].filter(Boolean).join(", ");

                  return (
                    <div key={rule.id ?? i} style={{
                      background: "#fff", borderRadius: 10, padding: "16px 20px",
                      border: "1px solid #e5e7eb", borderLeft: "4px solid #dc2626",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#111", marginBottom: 4 }}>
                            {subjectName}
                          </div>
                          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
                            Below <strong style={{ color: "#dc2626" }}>{threshold}%</strong>
                            &nbsp;·&nbsp;{channels || "No channels"}
                          </div>
                          <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                            {rule.notify_email && rule.email_address && (
                              <span style={{
                                fontSize: 10, background: "#fef2f2", color: "#dc2626",
                                border: "1px solid #fecaca", borderRadius: 20,
                                padding: "2px 8px", fontWeight: 600,
                              }}>
                                👨‍🏫 {rule.email_address}
                              </span>
                            )}
                            <span style={{
                              fontSize: 10, background: "#eff6ff", color: "#1d4ed8",
                              border: "1px solid #bfdbfe", borderRadius: 20,
                              padding: "2px 8px", fontWeight: 600,
                            }}>
                              👤 Students auto-notified
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => rule.id && handleDelete(rule.id)}
                          style={{
                            background: "none", border: "1px solid #fca5a5",
                            color: "#ef4444", borderRadius: 6, padding: "4px 12px",
                            fontSize: 12, cursor: "pointer", fontWeight: 600,
                            flexShrink: 0, marginLeft: 12,
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideIn { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
        select:focus, input:focus { border-color: #dc2626 !important; box-shadow: 0 0 0 3px #fee2e2; }
      `}</style>
    </div>
  );
}
