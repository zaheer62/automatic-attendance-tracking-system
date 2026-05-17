import { useEffect, useState, useRef } from "react";
import api from "../api/axios";

type ReportType = "daily" | "monthly" | "subject" | "student";

interface Subject { id: number; name: string; code: string; }
interface StudentStat { student_id: number; email?: string; total: number; present: number; percentage: number; }
interface SubjectStat { subject_id: number; name?: string; total_sessions: number; avg_attendance: number; }

export default function ReportPage() {
  const [reportType, setReportType] = useState<ReportType>("daily");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<number | "">("");
  const [selectedStudent, setSelectedStudent] = useState<string>("");
  const [studentName, setStudentName] = useState<string>("");
  const [studentEmail, setStudentEmail] = useState<string>("");
  const [studentNameStatus, setStudentNameStatus] = useState<"idle" | "loading" | "found" | "notfound">("idle");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<StudentStat[] | SubjectStat[] | null>(null);
  const [toast, setToast] = useState("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api.get("/subjects/").then((r) => setSubjects(r.data || [])).catch(() => {});
  }, []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const handleStudentIdChange = (value: string) => {
    setSelectedStudent(value);
    setStudentName("");
    setStudentEmail("");
    setStudentNameStatus("idle");

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (!value || isNaN(Number(value)) || Number(value) <= 0) return;

    debounceTimer.current = setTimeout(async () => {
      setStudentNameStatus("loading");
      try {
        const res = await api.get(`/users/students/${value}`);
        const d = res.data;
        setStudentName(d.full_name || "Name not available");
        setStudentEmail(d.email || "");
        setStudentNameStatus("found");
      } catch {
        setStudentName("Student not found");
        setStudentEmail("");
        setStudentNameStatus("notfound");
      }
    }, 500);
  };

  const fetchReport = async () => {
    setLoading(true); setData(null);
    try {
      let url = "";
      if (reportType === "daily")   url = `/reports/daily?date=${date}`;
      if (reportType === "monthly") url = `/reports/monthly?month=${month}`;
      if (reportType === "subject") url = `/reports/subject/${selectedSubject}`;
      if (reportType === "student") url = `/reports/student/${selectedStudent}`;

      const res = await api.get(url);
      setData(res.data);
    } catch {
      showToast("Failed to fetch report. Check your selections.");
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (!data || !Array.isArray(data) || data.length === 0) return showToast("No data to export");
    const headers = Object.keys(data[0]).join(",");
    const rows = (data as any[]).map((r) => Object.values(r).join(",")).join("\n");
    const csv = `${headers}\n${rows}`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `report_${reportType}_${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
    showToast("CSV exported successfully");
  };

  const tabs: { key: ReportType; label: string; icon: string }[] = [
    { key: "daily",   label: "Daily",        icon: "📅" },
    { key: "monthly", label: "Monthly",      icon: "📆" },
    { key: "subject", label: "Subject-wise", icon: "📚" },
    { key: "student", label: "Student-wise", icon: "👤" },
  ];

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0f172a",
      fontFamily: "'IBM Plex Sans', sans-serif",
      color: "#e2e8f0",
      padding: "40px 24px",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {toast && (
        <div style={{
          position: "fixed", top: 24, right: 24, zIndex: 999,
          background: "#1e293b", color: "#e2e8f0",
          border: "1px solid #334155",
          padding: "12px 24px", borderRadius: 8, fontSize: 14,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          animation: "fadeUp 0.3s ease",
        }}>
          {toast}
        </div>
      )}

      <div style={{ maxWidth: 900, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 36 }}>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11, color: "#64748b", letterSpacing: 2, marginBottom: 10,
          }}>
            REPORTS & ANALYTICS
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 600, margin: 0, color: "#f1f5f9" }}>
            Attendance Reports
          </h1>
          <p style={{ color: "#64748b", marginTop: 8, fontSize: 14 }}>
            Generate and export attendance data by day, month, subject or student.
          </p>
        </div>

        {/* Tab selector */}
        <div style={{
          display: "flex", gap: 4, marginBottom: 28,
          background: "#1e293b", padding: 4, borderRadius: 10,
          border: "1px solid #334155",
        }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => { setReportType(t.key); setData(null); }}
              style={{
                flex: 1, padding: "10px 8px",
                borderRadius: 8, border: "none",
                fontSize: 13, fontWeight: 500, cursor: "pointer",
                transition: "all 0.2s",
                background: reportType === t.key ? "#3b82f6" : "transparent",
                color: reportType === t.key ? "#fff" : "#64748b",
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Filter panel */}
        <div style={{
          background: "#1e293b", borderRadius: 12, padding: 24,
          border: "1px solid #334155", marginBottom: 20,
          display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap",
        }}>

          {reportType === "daily" && (
            <div style={{ flex: 1, minWidth: 160 }}>
              <label style={{ display: "block", fontSize: 11, color: "#64748b", letterSpacing: 1, marginBottom: 8, fontFamily: "'IBM Plex Mono', monospace" }}>DATE</label>
              <input
                type="date" value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" }}
              />
            </div>
          )}

          {reportType === "monthly" && (
            <div style={{ flex: 1, minWidth: 160 }}>
              <label style={{ display: "block", fontSize: 11, color: "#64748b", letterSpacing: 1, marginBottom: 8, fontFamily: "'IBM Plex Mono', monospace" }}>MONTH</label>
              <input
                type="month" value={month}
                onChange={(e) => setMonth(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" }}
              />
            </div>
          )}

          {reportType === "subject" && (
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ display: "block", fontSize: 11, color: "#64748b", letterSpacing: 1, marginBottom: 8, fontFamily: "'IBM Plex Mono', monospace" }}>SUBJECT</label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(Number(e.target.value))}
                style={{ width: "100%", padding: "10px 12px", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" }}
              >
                <option value="">Select subject …</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
              </select>
            </div>
          )}

          {reportType === "student" && (
            <div style={{ flex: 1, minWidth: 220 }}>
              <label style={{
                display: "block", fontSize: 11, color: "#64748b",
                letterSpacing: 1, marginBottom: 8,
                fontFamily: "'IBM Plex Mono', monospace",
              }}>
                STUDENT ID
              </label>

              {/* Input with border color feedback */}
              <div style={{ position: "relative" }}>
                <input
                  type="number"
                  placeholder="e.g. 33"
                  value={selectedStudent}
                  onChange={(e) => handleStudentIdChange(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 40px 10px 12px",
                    background: "#0f172a",
                    border: `1px solid ${
                      studentNameStatus === "found"    ? "#4ade80" :
                      studentNameStatus === "notfound" ? "#f87171" :
                      "#334155"
                    }`,
                    borderRadius: 8,
                    color: "#e2e8f0",
                    fontSize: 14,
                    outline: "none",
                    boxSizing: "border-box",
                    transition: "border-color 0.2s",
                  }}
                />
                {/* Status icon inside the input */}
                <span style={{
                  position: "absolute", right: 12, top: "50%",
                  transform: "translateY(-50%)", fontSize: 14, pointerEvents: "none",
                }}>
                  {studentNameStatus === "loading"  && "⏳"}
                  {studentNameStatus === "found"    && "✅"}
                  {studentNameStatus === "notfound" && "❌"}
                </span>
              </div>

              {/* Loading */}
              {studentNameStatus === "loading" && (
                <div style={{ marginTop: 8, fontSize: 12, color: "#64748b", fontStyle: "italic" }}>
                  ⟳ Looking up student…
                </div>
              )}

              {/* Found — avatar + name + email */}
              {studentNameStatus === "found" && (
                <div style={{
                  marginTop: 8,
                  background: "#4ade8012",
                  border: "1px solid #4ade8035",
                  borderRadius: 8,
                  padding: "8px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: "#3b82f6",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, fontWeight: 700, color: "#fff", flexShrink: 0,
                  }}>
                    {studentName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#4ade80" }}>
                      {studentName}
                    </div>
                    {studentEmail && (
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                        {studentEmail}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Not found */}
              {studentNameStatus === "notfound" && (
                <div style={{
                  marginTop: 8, fontSize: 13, color: "#f87171", fontWeight: 500,
                  display: "flex", alignItems: "center", gap: 6,
                  background: "#f8717112", border: "1px solid #f8717130",
                  borderRadius: 8, padding: "8px 12px",
                }}>
                  ⚠️ No student found with this ID
                </div>
              )}
            </div>
          )}

          <button
            onClick={fetchReport}
            disabled={loading}
            style={{
              padding: "10px 28px", background: "#3b82f6",
              color: "#fff", border: "none", borderRadius: 8,
              fontSize: 14, fontWeight: 500,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1, whiteSpace: "nowrap",
            }}
          >
            {loading ? "Loading …" : "Generate Report"}
          </button>

          {data && (
            <button
              onClick={exportCSV}
              style={{
                padding: "10px 20px", background: "transparent",
                color: "#38bdf8", border: "1px solid #38bdf8",
                borderRadius: 8, fontSize: 14, fontWeight: 500,
                cursor: "pointer", whiteSpace: "nowrap",
              }}
            >
              Export CSV
            </button>
          )}
        </div>

        {/* Results table */}
        {data && Array.isArray(data) && data.length > 0 && (
          <div style={{
            background: "#1e293b", borderRadius: 12,
            border: "1px solid #334155", overflow: "hidden",
          }}>
            <div style={{
              padding: "16px 24px", borderBottom: "1px solid #334155",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontSize: 13, color: "#94a3b8", fontFamily: "'IBM Plex Mono', monospace" }}>
                {data.length} RECORD{data.length !== 1 ? "S" : ""}
              </span>
              {reportType === "student" && studentNameStatus === "found" && (
                <span style={{
                  fontSize: 12, color: "#4ade80",
                  fontFamily: "'IBM Plex Mono', monospace",
                  background: "#4ade8012", border: "1px solid #4ade8030",
                  padding: "4px 10px", borderRadius: 20,
                }}>
                  👤 {studentName}
                </span>
              )}
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#0f172a" }}>
                    {Object.keys(data[0]).map((col) => (
                      <th key={col} style={{
                        padding: "12px 20px", textAlign: "left",
                        fontSize: 11, color: "#64748b", letterSpacing: 1,
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontWeight: 500, borderBottom: "1px solid #334155",
                        textTransform: "uppercase",
                      }}>
                        {col.replace(/_/g, " ")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data as any[]).map((row, i) => (
                    <tr key={i} style={{
                      borderBottom: "1px solid #1e293b",
                      background: i % 2 === 0 ? "transparent" : "#ffffff05",
                    }}>
                      {Object.entries(row).map(([key, val]) => (
                        <td key={key} style={{
                          padding: "12px 20px", fontSize: 14,
                          color: key.includes("percent") || key.includes("percentage")
                            ? (Number(val) >= 75 ? "#4ade80" : "#f87171")
                            : "#cbd5e1",
                          fontFamily: typeof val === "number" ? "'IBM Plex Mono', monospace" : "inherit",
                          fontWeight: typeof val === "number" ? 500 : 400,
                        }}>
                          {key.includes("percent") || key.includes("percentage")
                            ? `${Number(val).toFixed(1)}%`
                            : String(val ?? "—")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {data && Array.isArray(data) && data.length === 0 && (
          <div style={{
            textAlign: "center", padding: 48,
            color: "#475569", fontSize: 14,
            background: "#1e293b", borderRadius: 12, border: "1px solid #334155",
          }}>
            No records found for the selected filters.
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        input[type="date"]::-webkit-calendar-picker-indicator,
        input[type="month"]::-webkit-calendar-picker-indicator { filter: invert(1) opacity(0.5); }
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
      `}</style>
    </div>
  );
}
