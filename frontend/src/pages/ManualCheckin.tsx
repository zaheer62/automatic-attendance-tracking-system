import { useState, useEffect, useCallback } from "react";
import api from "../api/axios";

interface Subject {
  id: string;
  name: string;
}

interface Student {
  id: number;
  full_name: string;
  student_id: string;
}

export default function ManualCheckin() {
  const [step, setStep] = useState<"enter" | "confirm" | "done">("enter");
  const [studentIdInput, setStudentIdInput] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [matchedStudent, setMatchedStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchSubjects = useCallback(async () => {
    try {
      const res = await api.get("/subjects");
      if (res.data && res.data.length > 0) {
        setSubjects(res.data);
        setSubjectId(String(res.data[0].id));
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  const keys = ["1","2","3","4","5","6","7","8","9","","0","⌫"];

  const handleKey = (val: string) => {
    if (val === "⌫") {
      setStudentIdInput((p) => p.slice(0, -1));
    } else if (studentIdInput.length < 6) {
      setStudentIdInput((p) => p + val);
    }
  };

  // Format input as STU001
  const formatted = studentIdInput ? `STU${studentIdInput.padStart(3, "0")}` : "";

  const handleLookup = async () => {
    if (!studentIdInput || !subjectId) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/users/students");
      const students: Student[] = res.data;
      const found = students.find(
        (s) => s.student_id?.toLowerCase() === formatted.toLowerCase()
      );
      if (!found) {
        setError(`No student found with ID ${formatted}`);
        setLoading(false);
        return;
      }
      setMatchedStudent(found);
      setStep("confirm");
    } catch {
      setError("Could not look up student. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!matchedStudent || !subjectId) return;
    setLoading(true);
    setError("");
    try {
      await api.post("/sync/attendance", {
        student_id: matchedStudent.id,
        classroom_id: String(subjectId),
        subject_id: parseInt(subjectId),
        method: "manual",
        confidence: 1.0,
        timestamp: new Date().toISOString(),
      });
      setStep("done");
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      if (typeof detail === "string") setError(detail);
      else setError("Check-in failed. Please try again.");
      setStep("enter");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStudentIdInput("");
    setMatchedStudent(null);
    setStep("enter");
    setError("");
  };

  const selectedSubjectName =
    subjects.find((s) => String(s.id) === String(subjectId))?.name ?? "";

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0f1e",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'IBM Plex Mono', monospace",
      padding: 24,
    }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{ fontSize: 11, letterSpacing: 4, color: "#475569", textTransform: "uppercase", marginBottom: 8 }}>
          Manual Check-in
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, color: "#f1f5f9" }}>
          Student ID Entry
        </div>
        <div style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>
          Enter your Student ID (e.g. STU001)
        </div>
      </div>

      {/* Done screen */}
      {step === "done" && (
        <div style={{
          background: "#052e16", border: "1px solid #16a34a",
          borderRadius: 20, padding: "40px 48px",
          textAlign: "center", maxWidth: 360, width: "100%",
        }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#86efac", marginBottom: 8 }}>
            Attendance Marked
          </div>
          <div style={{ fontSize: 14, color: "#4ade80", marginBottom: 4 }}>
            {matchedStudent?.full_name}
          </div>
          <div style={{ fontSize: 13, color: "#4ade80", marginBottom: 24 }}>
            {formatted} — {selectedSubjectName}
          </div>
          <button onClick={reset} style={{
            background: "#16a34a", border: "none", color: "#fff",
            borderRadius: 10, padding: "12px 32px",
            fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
          }}>
            Next Student
          </button>
        </div>
      )}

      {/* Confirm screen */}
      {step === "confirm" && matchedStudent && (
        <div style={{
          background: "#0f172a", border: "1px solid #334155",
          borderRadius: 20, padding: "40px 48px",
          textAlign: "center", maxWidth: 360, width: "100%",
        }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🎓</div>
          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 6 }}>Confirm student</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#f1f5f9", marginBottom: 4 }}>
            {matchedStudent.full_name}
          </div>
          <div style={{ fontSize: 14, color: "#38bdf8", marginBottom: 4 }}>{formatted}</div>
          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 28 }}>{selectedSubjectName}</div>
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={reset} style={{
              flex: 1, background: "#1e293b", border: "1px solid #334155",
              color: "#94a3b8", borderRadius: 10, padding: "12px 0",
              fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}>
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={loading} style={{
              flex: 1, background: "#2563eb", border: "none",
              color: "#fff", borderRadius: 10, padding: "12px 0",
              fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}>
              {loading ? "Marking..." : "Confirm ✓"}
            </button>
          </div>
        </div>
      )}

      {/* Enter screen */}
      {step === "enter" && (
        <div style={{ width: "100%", maxWidth: 360 }}>
          {/* Subject selector */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, color: "#475569", letterSpacing: 2, display: "block", marginBottom: 6 }}>
              SUBJECT
            </label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(String(e.target.value))}
              style={{
                width: "100%", background: "#1e293b",
                border: "1px solid #334155", color: "#f1f5f9",
                borderRadius: 10, padding: "10px 14px",
                fontSize: 14, fontFamily: "inherit",
              }}
            >
              {subjects.map((s) => (
                <option key={s.id} value={String(s.id)}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* ID display */}
          <div style={{
            background: "#1e293b", border: "1px solid #334155",
            borderRadius: 14, padding: "20px 24px",
            textAlign: "center", marginBottom: 20, minHeight: 72,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
          }}>
            {studentIdInput ? (
              <>
                <span style={{ fontSize: 36, fontWeight: 700, color: "#38bdf8", letterSpacing: 6 }}>
                  {formatted}
                </span>
                <span style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>
                  Type the number part only
                </span>
              </>
            ) : (
              <span style={{ fontSize: 14, color: "#475569" }}>Enter student number (e.g. 1 for STU001)</span>
            )}
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: "#7f1d1d", border: "1px solid #dc2626",
              color: "#fca5a5", borderRadius: 8,
              padding: "10px 14px", fontSize: 13, marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          {/* PIN pad */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
            {keys.map((key, i) => (
              <button
                key={i}
                onClick={() => key && handleKey(key)}
                disabled={!key}
                style={{
                  background: key === "⌫" ? "#1e3a5f" : key ? "#1e293b" : "transparent",
                  border: key ? "1px solid #334155" : "none",
                  color: key === "⌫" ? "#38bdf8" : "#f1f5f9",
                  borderRadius: 12, padding: "18px 0",
                  fontSize: key === "⌫" ? 20 : 22, fontWeight: 600,
                  cursor: key ? "pointer" : "default", fontFamily: "inherit",
                }}
              >
                {key}
              </button>
            ))}
          </div>

          {/* Submit */}
          <button
            onClick={handleLookup}
            disabled={!studentIdInput || !subjectId || loading}
            style={{
              width: "100%",
              background: studentIdInput && subjectId ? "#2563eb" : "#1e293b",
              border: "none",
              color: studentIdInput && subjectId ? "#fff" : "#475569",
              borderRadius: 12, padding: "16px 0",
              fontSize: 15, fontWeight: 600,
              cursor: studentIdInput && subjectId ? "pointer" : "default",
              fontFamily: "inherit",
            }}
          >
            {loading ? "Looking up..." : "Find Student →"}
          </button>
        </div>
      )}
    </div>
  );
}