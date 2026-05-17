import { useState } from "react";
import axios from "../api/axios";

interface PrivacyAction {
  label: string;
  description: string;
  icon: string;
  color: string;
  action: () => Promise<void>;
  confirmText: string;
}

export default function PrivacyControls({ studentId }: { studentId: number }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState<string | null>(null);

  const show = (text: string, ok: boolean) => {
    setMessage({ text, ok });
    setTimeout(() => setMessage(null), 4000);
  };

  const run = async (key: string, fn: () => Promise<void>) => {
    setLoading(key);
    setConfirmOpen(null);
    try {
      await fn();
    } catch (e: any) {
      show(e?.response?.data?.detail ?? "Something went wrong", false);
    } finally {
      setLoading(null);
    }
  };

  const actions: PrivacyAction[] = [
    {
      label: "Export My Data",
      description: "Download all your attendance records as JSON (GDPR Art. 20).",
      icon: "⬇️",
      color: "#2563eb",
      confirmText: "Export all my attendance data?",
      action: async () => {
        const res = await axios.get(`/privacy/export/${studentId}`);
        const blob = new Blob([JSON.stringify(res.data, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `my-data-${studentId}.json`;
        a.click();
        show("Your data has been downloaded.", true);
      },
    },
    {
      label: "Delete Face Data",
      description: "Remove your biometric face embedding from the system.",
      icon: "🗑️",
      color: "#d97706",
      confirmText: "Delete your face embedding? You will need to re-register to use face check-in.",
      action: async () => {
        await axios.delete(`/privacy/face/${studentId}`);
        show("Face embedding deleted successfully.", true);
      },
    },
    {
      label: "Right to Erasure",
      description: "Permanently delete all your data from the system (GDPR Art. 17).",
      icon: "⚠️",
      color: "#dc2626",
      confirmText:
        "This will permanently delete ALL your data including attendance history. This cannot be undone. Continue?",
      action: async () => {
        await axios.delete(`/privacy/student/${studentId}`);
        show("All your data has been erased.", true);
        setTimeout(() => (window.location.href = "/login"), 2000);
      },
    },
  ];

  return (
    <div
      style={{
        background: "#0f172a",
        border: "1px solid #1e293b",
        borderRadius: 16,
        padding: "28px 32px",
        maxWidth: 560,
        fontFamily: "'IBM Plex Mono', monospace",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: 3,
            color: "#475569",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Privacy & Data Rights
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9" }}>
          Your Data Controls
        </div>
        <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
          GDPR-compliant controls over your personal data.
        </div>
      </div>

      {/* Toast */}
      {message && (
        <div
          style={{
            background: message.ok ? "#14532d" : "#7f1d1d",
            border: `1px solid ${message.ok ? "#16a34a" : "#dc2626"}`,
            color: message.ok ? "#86efac" : "#fca5a5",
            borderRadius: 8,
            padding: "10px 16px",
            fontSize: 13,
            marginBottom: 20,
          }}
        >
          {message.text}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {actions.map((a) => (
          <div
            key={a.label}
            style={{
              background: "#1e293b",
              border: "1px solid #334155",
              borderRadius: 12,
              padding: "16px 20px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 12,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#e2e8f0",
                    marginBottom: 4,
                  }}
                >
                  {a.icon} {a.label}
                </div>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  {a.description}
                </div>
              </div>
              <button
                onClick={() => setConfirmOpen(a.label)}
                disabled={loading === a.label}
                style={{
                  background: "transparent",
                  border: `1px solid ${a.color}`,
                  color: a.color,
                  borderRadius: 8,
                  padding: "6px 14px",
                  fontSize: 12,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  opacity: loading === a.label ? 0.5 : 1,
                }}
              >
                {loading === a.label ? "..." : a.label}
              </button>
            </div>

            {/* Inline confirm */}
            {confirmOpen === a.label && (
              <div
                style={{
                  marginTop: 14,
                  background: "#0f172a",
                  border: `1px solid ${a.color}`,
                  borderRadius: 8,
                  padding: "12px 16px",
                }}
              >
                <div style={{ fontSize: 13, color: "#cbd5e1", marginBottom: 12 }}>
                  {a.confirmText}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => run(a.label, a.action)}
                    style={{
                      background: a.color,
                      border: "none",
                      color: "#fff",
                      borderRadius: 6,
                      padding: "6px 16px",
                      fontSize: 12,
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setConfirmOpen(null)}
                    style={{
                      background: "transparent",
                      border: "1px solid #334155",
                      color: "#94a3b8",
                      borderRadius: 6,
                      padding: "6px 16px",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div
        style={{
          marginTop: 20,
          fontSize: 11,
          color: "#334155",
          borderTop: "1px solid #1e293b",
          paddingTop: 14,
        }}
      >
        Under GDPR you have the right to access, correct, export, and erase your
        personal data. Contact your administrator for further assistance.
      </div>
    </div>
  );
}
