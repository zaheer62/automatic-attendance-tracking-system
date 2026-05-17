import { useEffect, useState, useCallback } from "react";
import api from "../api/axios";

interface Student {
  student_id: number;
  student_name: string;
  status: "present" | "absent" | "not_marked";
  marked_at?: string;
  method?: string;
}

interface Subject {
  id: number;
  name: string;
}

interface ActiveSession {
  id: number;
  subject_id: number;
  subject_name: string;
  started_at: string;
  classroom: string;
}

export default function TeacherDashboard() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<number | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [overriding, setOverriding] = useState<number | null>(null);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [classroom, setClassroom] = useState("Room 101");
  const today = new Date().toISOString().slice(0, 10);

  const showToast = (text: string, ok: boolean) => {
    setToast({ text, ok });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    api.get("/subjects/").then((r) => setSubjects(r.data)).catch(() => {});
  }, []);

  const fetchActiveSession = useCallback(async () => {
    try {
      const r = await api.get("/attendance/session/active");
      setActiveSession(r.data);
      if (r.data?.subject_id) setSelectedSubject(r.data.subject_id);
    } catch {
      setActiveSession(null);
    }
  }, []);

  useEffect(() => { fetchActiveSession(); }, [fetchActiveSession]);

  const fetchAttendance = useCallback(async () => {
    if (!selectedSubject) return;
    setLoading(true);
    api
      .get(`/attendance/teacher/today?subject_id=${selectedSubject}&date=${today}`)
      .then((r) => setStudents(r.data))
      .catch(() => setStudents([]))
      .finally(() => setLoading(false));
  }, [selectedSubject]);

  useEffect(() => {
    fetchAttendance();
    const interval = setInterval(fetchAttendance, 10000);
    return () => clearInterval(interval);
  }, [fetchAttendance]);

  const startClass = async () => {
    if (!selectedSubject) return showToast("Please select a subject first", false);
    setSessionLoading(true);
    try {
      const r = await api.post("/attendance/session/start", { subject_id: selectedSubject, classroom });
      setActiveSession(r.data);
      showToast(`Class started for ${r.data.subject_name}!`, true);
    } catch (e: any) {
      showToast(e?.response?.data?.detail ?? "Failed to start class", false);
    } finally {
      setSessionLoading(false);
    }
  };

  const endClass = async () => {
    if (!activeSession) return;
    setSessionLoading(true);
    try {
      await api.post(`/attendance/session/${activeSession.id}/end`);
      showToast("Class ended. Attendance saved!", true);
      setActiveSession(null);
    } catch (e: any) {
      showToast(e?.response?.data?.detail ?? "Failed to end class", false);
    } finally {
      setSessionLoading(false);
    }
  };

  const override = async (studentId: number, newStatus: "present" | "absent") => {
    setOverriding(studentId);
    try {
      await api.post("/attendance/admin/override", {
        student_id: studentId,
        subject_id: selectedSubject,
        session_date: today,
        status: newStatus,
        reason: "Teacher manual override",
      });
      setStudents((prev) =>
        prev.map((s) =>
          s.student_id === studentId ? { ...s, status: newStatus, method: "manual_override" } : s
        )
      );
      showToast(`Marked ${newStatus}`, true);
    } catch (e: any) {
      showToast(e?.response?.data?.detail ?? "Override failed", false);
    } finally {
      setOverriding(null);
    }
  };

  const present = students.filter((s) => s.status === "present").length;
  const absent = students.filter((s) => s.status === "absent").length;
  const notMarked = students.filter((s) => s.status === "not_marked").length;
  const total = students.length;
  const pct = total > 0 ? Math.round((present / total) * 100) : 0;

  const dateStr = new Date().toLocaleDateString("en-IN", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div style={{ minHeight: "100vh", background: "#f5f4f0", fontFamily: "'Lato', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700;900&family=Playfair+Display:wght@700;900&display=swap" rel="stylesheet" />

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 24, right: 24, zIndex: 9999,
          background: toast.ok ? "#14532d" : "#7f1d1d",
          color: toast.ok ? "#bbf7d0" : "#fca5a5",
          padding: "12px 24px", borderRadius: 8, fontSize: 14, fontWeight: 600,
          boxShadow: "0 4px 20px rgba(0,0,0,0.2)", animation: "slideIn 0.3s ease",
        }}>
          {toast.text}
        </div>
      )}

      {/* Hero Header */}
      <div style={{
        background: "#1a1a2e",
        padding: "0 40px",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Decorative circles */}
        <div style={{
          position: "absolute", top: -60, right: -60,
          width: 220, height: 220, borderRadius: "50%",
          border: "1px solid rgba(255,255,255,0.06)", pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", top: -20, right: 60,
          width: 120, height: 120, borderRadius: "50%",
          border: "1px solid rgba(255,255,255,0.04)", pointerEvents: "none",
        }} />

        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{
              display: "inline-block",
              background: "#e63946", color: "#fff",
              fontSize: 10, fontWeight: 700, letterSpacing: 2,
              padding: "3px 10px", borderRadius: 2, marginBottom: 10,
            }}>
              TEACHER PORTAL
            </div>
            <h1 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 38, fontWeight: 900, color: "#fff",
              margin: 0, lineHeight: 1.1,
            }}>
              Teacher Dashboard
            </h1>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginTop: 8, marginBottom: 0 }}>
              {dateStr}
            </p>
          </div>

          {activeSession && (
            <div style={{
              background: "rgba(74,222,128,0.1)",
              border: "1px solid rgba(74,222,128,0.3)",
              borderRadius: 10, padding: "12px 20px",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: "50%",
                background: "#4ade80", animation: "pulse 2s infinite",
              }} />
              <div>
                <div style={{ color: "#4ade80", fontSize: 13, fontWeight: 700 }}>Live Session</div>
                <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>{activeSession.subject_name}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 40px" }}>

        {/* Session Control */}
        <div style={{
          background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb",
          padding: 28, marginBottom: 28,
          boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: 2, marginBottom: 16 }}>
            CLASS SESSION CONTROL
          </div>

          {activeSession ? (
            <div style={{
              background: "#f0fdf4", border: "1px solid #bbf7d0",
              borderRadius: 10, padding: "18px 24px",
              display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" as const, gap: 16,
            }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#15803d", marginBottom: 4 }}>
                  {activeSession.subject_name} — Class in Progress
                </div>
                <div style={{ fontSize: 13, color: "#166534" }}>
                  Started at {new Date(activeSession.started_at).toLocaleTimeString()} · {activeSession.classroom}
                </div>
                <div style={{ fontSize: 12, color: "#4ade80", marginTop: 4 }}>
                  Students can now check in via Kiosk or Manual Check-in
                </div>
              </div>
              <button
                onClick={endClass}
                disabled={sessionLoading}
                style={{
                  background: "#e63946", color: "#fff", border: "none",
                  borderRadius: 8, padding: "12px 28px", fontSize: 14, fontWeight: 700,
                  cursor: sessionLoading ? "not-allowed" : "pointer",
                  opacity: sessionLoading ? 0.7 : 1, letterSpacing: 0.5,
                }}
              >
                {sessionLoading ? "Ending..." : "End Class"}
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" as const }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 6, letterSpacing: 1 }}>
                  SELECT SUBJECT
                </label>
                <select
                  value={selectedSubject ?? ""}
                  onChange={(e) => setSelectedSubject(Number(e.target.value))}
                  style={{
                    width: "100%", padding: "10px 14px", borderRadius: 8,
                    border: "1.5px solid #e5e7eb", fontSize: 14, color: "#111",
                    background: "#fff", outline: "none", cursor: "pointer",
                  }}
                >
                  <option value="">Choose a subject...</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ flex: 1, minWidth: 160 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 6, letterSpacing: 1 }}>
                  CLASSROOM
                </label>
                <input
                  value={classroom}
                  onChange={(e) => setClassroom(e.target.value)}
                  placeholder="e.g. Room 101"
                  style={{
                    width: "100%", padding: "10px 14px", borderRadius: 8,
                    border: "1.5px solid #e5e7eb", fontSize: 14,
                    background: "#fff", outline: "none", boxSizing: "border-box" as const,
                  }}
                />
              </div>

              <button
                onClick={startClass}
                disabled={sessionLoading || !selectedSubject}
                style={{
                  background: selectedSubject ? "#1a1a2e" : "#d1d5db",
                  color: "#fff", border: "none", borderRadius: 8,
                  padding: "11px 32px", fontSize: 14, fontWeight: 700,
                  cursor: selectedSubject ? "pointer" : "not-allowed",
                  letterSpacing: 0.5, whiteSpace: "nowrap" as const,
                  transition: "background 0.2s",
                }}
              >
                {sessionLoading ? "Starting..." : "Start Class"}
              </button>
            </div>
          )}
        </div>

        {/* Stats */}
        {selectedSubject && !loading && total > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
            {[
              { label: "Total Students", value: total, accent: "#1a1a2e", light: "#f5f4f0" },
              { label: "Present", value: present, accent: "#15803d", light: "#f0fdf4" },
              { label: "Absent", value: absent, accent: "#e63946", light: "#fef2f2" },
              {
                label: "Attendance",
                value: `${pct}%`,
                accent: pct >= 75 ? "#15803d" : "#d97706",
                light: pct >= 75 ? "#f0fdf4" : "#fffbeb",
              },
            ].map((c) => (
              <div key={c.label} style={{
                background: "#fff", borderRadius: 12,
                border: "1px solid #e5e7eb",
                padding: "20px 24px",
                borderTop: `3px solid ${c.accent}`,
              }}>
                <div style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: 34, fontWeight: 700, color: c.accent, lineHeight: 1,
                }}>
                  {c.value}
                </div>
                <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 6, fontWeight: 700, letterSpacing: 0.5 }}>
                  {c.label.toUpperCase()}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Attendance Table */}
        {selectedSubject && !loading && students.length > 0 && (
          <div style={{
            background: "#fff", borderRadius: 14,
            border: "1px solid #e5e7eb",
            overflow: "hidden",
          }}>
            {/* Table header bar */}
            <div style={{
              padding: "18px 28px",
              borderBottom: "1px solid #f3f4f6",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: 2, marginBottom: 2 }}>
                  STUDENT ATTENDANCE
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#111" }}>
                  {students.length} students enrolled
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {activeSession && (
                  <span style={{
                    background: "#f0fdf4", color: "#15803d",
                    border: "1px solid #bbf7d0",
                    fontSize: 11, fontWeight: 700, padding: "4px 12px",
                    borderRadius: 20, letterSpacing: 0.5,
                  }}>
                    LIVE SESSION
                  </span>
                )}
                <span style={{ fontSize: 12, color: "#9ca3af" }}>
                  Auto-refreshes every 10s
                </span>
              </div>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse" as const }}>
              <thead>
                <tr style={{ background: "#fafafa" }}>
                  {["#", "Student", "Status", "Method", "Time", "Override"].map((h) => (
                    <th key={h} style={{
                      padding: "12px 20px", textAlign: "left" as const,
                      fontSize: 10, color: "#9ca3af", fontWeight: 700,
                      letterSpacing: 1, textTransform: "uppercase" as const,
                      borderBottom: "1px solid #f3f4f6",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map((s, i) => (
                  <tr key={s.student_id} style={{
                    borderBottom: "1px solid #f9fafb",
                    transition: "background 0.15s",
                  }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "14px 20px", fontSize: 13, color: "#d1d5db", fontWeight: 700 }}>
                      {String(i + 1).padStart(2, "0")}
                    </td>
                    <td style={{ padding: "14px 20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: "50%",
                          background: "#1a1a2e", color: "#fff",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 12, fontWeight: 700, flexShrink: 0,
                        }}>
                          {s.student_name.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>
                          {s.student_name}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: "14px 20px" }}>
                      <span style={{
                        display: "inline-block",
                        background:
                          s.status === "present" ? "#f0fdf4"
                          : s.status === "absent" ? "#fef2f2"
                          : "#fefce8",
                        color:
                          s.status === "present" ? "#15803d"
                          : s.status === "absent" ? "#e63946"
                          : "#a16207",
                        border: `1px solid ${
                          s.status === "present" ? "#bbf7d0"
                          : s.status === "absent" ? "#fecaca"
                          : "#fde68a"
                        }`,
                        padding: "3px 12px", borderRadius: 20,
                        fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
                      }}>
                        {s.status === "not_marked" ? "NOT MARKED" : s.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: "14px 20px", fontSize: 12, color: "#9ca3af" }}>
                      {s.method ?? "—"}
                    </td>
                    <td style={{ padding: "14px 20px", fontSize: 12, color: "#9ca3af" }}>
                      {s.marked_at ? new Date(s.marked_at).toLocaleTimeString() : "—"}
                    </td>
                    <td style={{ padding: "14px 20px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          onClick={() => override(s.student_id, "present")}
                          disabled={overriding === s.student_id || s.status === "present"}
                          style={{
                            background: s.status === "present" ? "#15803d" : "#fff",
                            color: s.status === "present" ? "#fff" : "#15803d",
                            border: "1.5px solid #15803d",
                            borderRadius: 6, padding: "5px 12px", fontSize: 11,
                            fontWeight: 700, cursor: s.status === "present" ? "default" : "pointer",
                            opacity: overriding === s.student_id ? 0.5 : 1,
                            letterSpacing: 0.3, transition: "all 0.15s",
                          }}
                        >
                          Present
                        </button>
                        <button
                          onClick={() => override(s.student_id, "absent")}
                          disabled={overriding === s.student_id || s.status === "absent"}
                          style={{
                            background: s.status === "absent" ? "#e63946" : "#fff",
                            color: s.status === "absent" ? "#fff" : "#e63946",
                            border: "1.5px solid #e63946",
                            borderRadius: 6, padding: "5px 12px", fontSize: 11,
                            fontWeight: 700, cursor: s.status === "absent" ? "default" : "pointer",
                            opacity: overriding === s.student_id ? 0.5 : 1,
                            letterSpacing: 0.3, transition: "all 0.15s",
                          }}
                        >
                          Absent
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Footer bar */}
            <div style={{
              padding: "12px 28px", background: "#fafafa",
              borderTop: "1px solid #f3f4f6",
              display: "flex", gap: 24,
            }}>
              {[
                { label: "Present", value: present, color: "#15803d" },
                { label: "Absent", value: absent, color: "#e63946" },
                { label: "Not marked", value: notMarked, color: "#a16207" },
              ].map((s) => (
                <div key={s.label} style={{ fontSize: 12, color: "#9ca3af" }}>
                  <span style={{ fontWeight: 700, color: s.color }}>{s.value}</span> {s.label}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center" as const, padding: 48, color: "#9ca3af", fontSize: 14 }}>
            Loading attendance...
          </div>
        )}

        {/* Empty state */}
        {!selectedSubject && !activeSession && (
          <div style={{
            background: "#fff", borderRadius: 14,
            border: "1.5px dashed #e5e7eb",
            padding: "60px 32px", textAlign: "center" as const,
          }}>
            <div style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 52, color: "#e5e7eb", marginBottom: 16,
            }}>
              📚
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#374151", marginBottom: 8 }}>
              Select a subject and start a class
            </div>
            <div style={{ fontSize: 14, color: "#9ca3af" }}>
              Attendance will be tracked once a session is active
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        select:focus, input:focus { border-color: #1a1a2e !important; outline: none; box-shadow: 0 0 0 3px rgba(26,26,46,0.08); }
      `}</style>
    </div>
  );
}
