import { useEffect, useState } from "react";
import api from "../api/axios";

interface Defaulter {
  student_id: number;
  student_name: string;
  subject_name: string;
  percentage: number;
  threshold: number;
}

interface SubjectStat {
  subject_name: string;
  avg_percentage: number;
  total_students: number;
  below_threshold: number;
}

interface DailyTrend {
  date: string;
  present: number;
  total: number;
  percentage: number;
}

export default function AdminDashboard() {
  const [defaulters, setDefaulters] = useState<Defaulter[]>([]);
  const [subjects, setSubjects] = useState<SubjectStat[]>([]);
  const [trends, setTrends] = useState<DailyTrend[]>([]);
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "defaulters" | "heatmap">("overview");

  useEffect(() => {
    Promise.all([
      api.get("/attendance/admin/overview").catch(() => ({ data: null })),
      api.get("/attendance/admin/defaulters").catch(() => ({ data: [] })),
      api.get("/attendance/admin/subjects").catch(() => ({ data: [] })),
      api.get("/attendance/admin/trends").catch(() => ({ data: [] })),
    ]).then(([ov, def, sub, tr]) => {
      setOverview(ov.data);
      setDefaulters(def.data || []);
      setSubjects(sub.data || []);
      setTrends(tr.data || []);
      setLoading(false);
    });
  }, []);

  const heatColor = (pct: number) => {
    if (pct >= 85) return { bg: "#14532d", text: "#86efac", border: "#16a34a" };
    if (pct >= 75) return { bg: "#713f12", text: "#fde68a", border: "#d97706" };
    return { bg: "#7f1d1d", text: "#fca5a5", border: "#dc2626" };
  };

  const tabs = ["overview", "defaulters", "heatmap"] as const;

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "system-ui, sans-serif" }}>
      {/* Top bar */}
      <div style={{ background: "#1e40af", padding: "16px 32px", display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>🎓 Admin Dashboard</span>
        <span style={{ fontSize: 13, color: "#bfdbfe", marginLeft: "auto" }}>Institution-wide Attendance</span>
      </div>

      {/* Tabs */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "0 32px", display: "flex", gap: 0 }}>
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            style={{
              background: "none",
              border: "none",
              borderBottom: activeTab === t ? "2px solid #2563eb" : "2px solid transparent",
              color: activeTab === t ? "#2563eb" : "#64748b",
              padding: "14px 20px",
              fontSize: 14,
              fontWeight: activeTab === t ? 600 : 400,
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {t === "heatmap" ? "Subject Heatmap" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ padding: 32 }}>
        {loading && (
          <div style={{ color: "#64748b", fontSize: 14, textAlign: "center", paddingTop: 48 }}>
            Loading dashboard data...
          </div>
        )}

        {/* ── Overview tab ── */}
        {!loading && activeTab === "overview" && (
          <>
            {/* Stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
              {[
                { label: "Total Students", value: overview?.total_students ?? "—", color: "#2563eb" },
                { label: "Total Subjects", value: overview?.total_subjects ?? "—", color: "#7c3aed" },
                { label: "Avg Attendance", value: overview?.avg_attendance ? `${overview.avg_attendance}%` : "—", color: "#059669" },
                { label: "Defaulters", value: defaulters.length, color: "#dc2626" },
              ].map((c) => (
                <div key={c.label} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "20px 24px" }}>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>{c.label}</div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: c.color }}>{c.value}</div>
                </div>
              ))}
            </div>

            {/* Daily trend bars */}
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 24, marginBottom: 24 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#1e293b", marginBottom: 20 }}>Daily Attendance Trend (Last 14 days)</div>
              {trends.length === 0 ? (
                <div style={{ color: "#94a3b8", fontSize: 14, textAlign: "center", padding: 24 }}>No trend data available yet</div>
              ) : (
                <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 160 }}>
                  {trends.slice(-14).map((d, i) => {
                    const h = Math.max(8, (d.percentage / 100) * 140);
                    const c = d.percentage >= 85 ? "#16a34a" : d.percentage >= 75 ? "#d97706" : "#dc2626";
                    return (
                      <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <div style={{ fontSize: 10, color: "#94a3b8" }}>{d.percentage}%</div>
                        <div style={{ width: "100%", height: h, background: c, borderRadius: "4px 4px 0 0", opacity: 0.85 }} title={`${d.date}: ${d.percentage}%`} />
                        <div style={{ fontSize: 9, color: "#cbd5e1", transform: "rotate(-45deg)", transformOrigin: "center", whiteSpace: "nowrap" }}>
                          {d.date?.slice(5)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Defaulters tab ── */}
        {!loading && activeTab === "defaulters" && (
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#1e293b" }}>
                Defaulter List ({defaulters.length} students)
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8" }}>Students below attendance threshold</div>
            </div>
            {defaulters.length === 0 ? (
              <div style={{ padding: 48, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
                🎉 No defaulters — all students are above threshold!
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["Student", "Subject", "Attendance %", "Required %", "Shortfall"].map((h) => (
                      <th key={h} style={{ padding: "12px 20px", textAlign: "left", fontSize: 12, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {defaulters.map((d, i) => (
                    <tr key={i} style={{ borderTop: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                      <td style={{ padding: "14px 20px", fontSize: 14, color: "#1e293b", fontWeight: 500 }}>{d.student_name}</td>
                      <td style={{ padding: "14px 20px", fontSize: 14, color: "#64748b" }}>{d.subject_name}</td>
                      <td style={{ padding: "14px 20px" }}>
                        <span style={{ background: "#fef2f2", color: "#dc2626", padding: "3px 10px", borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
                          {d.percentage}%
                        </span>
                      </td>
                      <td style={{ padding: "14px 20px", fontSize: 14, color: "#64748b" }}>{d.threshold}%</td>
                      <td style={{ padding: "14px 20px", fontSize: 14, color: "#dc2626", fontWeight: 600 }}>
                        -{(d.threshold - d.percentage).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── Heatmap tab ── */}
        {!loading && activeTab === "heatmap" && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#1e293b", marginBottom: 20 }}>
              Subject-wise Attendance Heatmap
            </div>
            {/* Legend */}
            <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
              {[{ label: "≥ 85% Good", bg: "#14532d", text: "#86efac" }, { label: "75–84% Warning", bg: "#713f12", text: "#fde68a" }, { label: "< 75% Critical", bg: "#7f1d1d", text: "#fca5a5" }].map((l) => (
                <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                  <div style={{ width: 14, height: 14, borderRadius: 3, background: l.bg }} />
                  <span style={{ color: "#64748b" }}>{l.label}</span>
                </div>
              ))}
            </div>

            {subjects.length === 0 ? (
              <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 48, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
                No subject data available yet
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
                {subjects.map((s, i) => {
                  const c = heatColor(s.avg_percentage);
                  return (
                    <div key={i} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 14, padding: "20px 22px" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: c.text, marginBottom: 12, lineHeight: 1.3 }}>{s.subject_name}</div>
                      <div style={{ fontSize: 36, fontWeight: 700, color: c.text, marginBottom: 8 }}>{s.avg_percentage}%</div>
                      <div style={{ fontSize: 11, color: c.text, opacity: 0.7 }}>
                        {s.total_students} students · {s.below_threshold} below threshold
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
