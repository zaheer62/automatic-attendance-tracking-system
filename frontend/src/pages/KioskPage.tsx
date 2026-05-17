import { useEffect, useRef, useState } from "react";
import api from "../api/axios";

type Status = "idle" | "detecting" | "matched" | "unknown" | "error";

interface MatchResult {
  student_id: number;
  confidence: number;
  name?: string;
}

interface ActiveSession {
  id: number;
  subject_id: number;
  subject_name: string;
  classroom: string;
}

export default function KioskPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statusRef = useRef<Status>("idle");

  const [status, setStatus] = useState<Status>("idle");
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [error, setError] = useState("");
  const [time, setTime] = useState(new Date());
  const [camReady, setCamReady] = useState(false);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);

  const setStatusBoth = (s: Status) => {
    statusRef.current = s;
    setStatus(s);
  };

  // Clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Fetch active session
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await api.get("/attendance/session/active/public");
        setActiveSession(res.data);
      } catch {
        setActiveSession(null);
      }
    };
    fetchSession();
    const t = setInterval(fetchSession, 30000);
    return () => clearInterval(t);
  }, []);

  // Camera init
  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: { width: 1280, height: 720, facingMode: "user" } })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current!.play();
            setCamReady(true);
          };
        }
      })
      .catch(() => {
        setError("Camera access denied. Please allow camera permissions.");
        setStatusBoth("error");
      });

    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream)
          .getTracks()
          .forEach((t) => t.stop());
      }
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Capture + recognise loop
  useEffect(() => {
    if (!camReady) return;
    setStatusBoth("detecting");

    intervalRef.current = setInterval(async () => {
      // Skip if already matched or unknown
      if (statusRef.current === "matched" || statusRef.current === "unknown") return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0);

      canvas.toBlob(async (blob) => {
        if (!blob) return;
        if (statusRef.current === "matched" || statusRef.current === "unknown") return;

        const form = new FormData();
        form.append("file", blob, "frame.jpg");

        try {
          const res = await api.post("/face/recognize", form, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          const data = res.data;

          if (data.student_id) {
            setMatch({ student_id: data.student_id, confidence: data.confidence, name: data.name });
            setStatusBoth("matched");

            // Mark attendance
            try {
              await api.post("/sync/attendance", {
                student_id: data.student_id,
                classroom_id: activeSession?.classroom ?? "kiosk",
                subject_id: activeSession?.subject_id ?? null,
                method: "face_recognition",
                confidence: data.confidence,
                timestamp: new Date().toISOString(),
              });
            } catch {
              // Already marked or other error — still show matched UI
            }

            setTimeout(() => {
              setMatch(null);
              setStatusBoth("detecting");
            }, 8000);

          } else {
            setStatusBoth("unknown");
            setMatch(null);
            setTimeout(() => {
              setStatusBoth("detecting");
            }, 3000);
          }
        } catch {
          // silent fail, keep detecting
        }
      }, "image/jpeg", 0.85);
    }, 2500);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [camReady, activeSession]);

  const statusConfig = {
    idle:      { bg: "#0a0a0a", accent: "#334155", label: "Initialising …",        ring: "#334155" },
    detecting: { bg: "#0a0a0a", accent: "#0ea5e9", label: "Look at the camera",    ring: "#0ea5e9" },
    matched:   { bg: "#052e16", accent: "#22c55e", label: "Attendance Marked ✓",   ring: "#22c55e" },
    unknown:   { bg: "#1c0a0a", accent: "#ef4444", label: "Face Not Recognised ✗", ring: "#ef4444" },
    error:     { bg: "#1c0a0a", accent: "#ef4444", label: "Camera Error",          ring: "#ef4444" },
  };

  const cfg = statusConfig[status];

  return (
    <div style={{
      minHeight: "100vh",
      background: cfg.bg,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'DM Sans', sans-serif",
      transition: "background 0.6s ease",
      position: "relative",
      overflow: "hidden",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono&display=swap" rel="stylesheet" />

      {/* Grid bg */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.04,
        backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
        backgroundSize: "40px 40px",
        pointerEvents: "none",
      }} />

      {/* Header */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "20px 36px",
        borderBottom: `1px solid ${cfg.accent}22`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 10, height: 10, borderRadius: "50%",
            background: status === "detecting" || status === "matched" ? "#22c55e" : "#ef4444",
            boxShadow: `0 0 8px ${status === "detecting" || status === "matched" ? "#22c55e" : "#ef4444"}`,
            animation: "pulse 2s infinite",
          }} />
          <span style={{ color: "#64748b", fontSize: 13, fontFamily: "'DM Mono', monospace", letterSpacing: 1 }}>
            KIOSK · LIVE
          </span>
        </div>

        <div style={{
          color: activeSession ? "#22c55e" : "#ef4444",
          fontSize: 12, fontFamily: "'DM Mono', monospace", letterSpacing: 1,
        }}>
          {activeSession
            ? `📚 ${activeSession.subject_name} · ${activeSession.classroom}`
            : "⚠ NO ACTIVE CLASS"}
        </div>

        <div style={{ color: "#64748b", fontSize: 13, fontFamily: "'DM Mono', monospace", letterSpacing: 1 }}>
          {time.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </div>
      </div>

      {/* Camera + ring */}
      <div style={{ position: "relative", marginBottom: 40 }}>
        <div style={{
          position: "absolute", inset: -12,
          borderRadius: "50%",
          border: `2px solid ${cfg.ring}`,
          boxShadow: `0 0 30px ${cfg.ring}44`,
          transition: "border-color 0.6s, box-shadow 0.6s",
          animation: status === "detecting" ? "spin 6s linear infinite" : "none",
        }} />
        <div style={{
          width: 280, height: 280,
          borderRadius: "50%",
          overflow: "hidden",
          border: `3px solid ${cfg.accent}`,
          boxShadow: `0 0 60px ${cfg.accent}33`,
          transition: "border-color 0.6s, box-shadow 0.6s",
          background: "#111",
          position: "relative",
        }}>
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            style={{
              width: "100%", height: "100%",
              objectFit: "cover",
              transform: "scaleX(-1)",
              display: status === "error" ? "none" : "block",
            }}
          />
          {status === "error" && (
            <div style={{
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              height: "100%", color: "#ef4444", fontSize: 13,
              textAlign: "center", padding: 20,
            }}>
              <span style={{ fontSize: 32, marginBottom: 8 }}>⚠</span>
              {error}
            </div>
          )}
        </div>
        <canvas ref={canvasRef} style={{ display: "none" }} />

        {["topleft","topright","bottomleft","bottomright"].map((pos) => (
          <div key={pos} style={{
            position: "absolute",
            width: 20, height: 20,
            borderColor: cfg.accent,
            borderStyle: "solid",
            borderWidth: 0,
            ...(pos === "topleft"     ? { top: -2, left: -2,    borderTopWidth: 2, borderLeftWidth: 2 } : {}),
            ...(pos === "topright"    ? { top: -2, right: -2,   borderTopWidth: 2, borderRightWidth: 2 } : {}),
            ...(pos === "bottomleft"  ? { bottom: -2, left: -2,  borderBottomWidth: 2, borderLeftWidth: 2 } : {}),
            ...(pos === "bottomright" ? { bottom: -2, right: -2, borderBottomWidth: 2, borderRightWidth: 2 } : {}),
            transition: "border-color 0.6s",
          }} />
        ))}
      </div>

      {/* Status label */}
      <div style={{
        fontSize: 22, fontWeight: 500,
        color: cfg.accent,
        letterSpacing: 0.5,
        marginBottom: 16,
        transition: "color 0.6s",
      }}>
        {cfg.label}
      </div>

      {/* Unknown face */}
      {status === "unknown" && (
        <div style={{
          background: "#1c0a0a88",
          border: "1px solid #ef444444",
          borderRadius: 16,
          padding: "20px 40px",
          textAlign: "center",
          backdropFilter: "blur(8px)",
          animation: "fadeIn 0.4s ease",
        }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🚫</div>
          <div style={{ color: "#fca5a5", fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
            Face not found in the system
          </div>
          <div style={{ color: "#ef4444", fontSize: 13, fontFamily: "'DM Mono', monospace" }}>
            Please contact your administrator to register
          </div>
        </div>
      )}

      {/* Match card */}
      {status === "matched" && match && (
        <div style={{
          background: "#052e1688",
          border: "1px solid #22c55e44",
          borderRadius: 16,
          padding: "20px 40px",
          textAlign: "center",
          backdropFilter: "blur(8px)",
          animation: "fadeIn 0.4s ease",
        }}>
          {match.name && (
            <div style={{ color: "#4ade80", fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
              {match.name}
            </div>
          )}
          <div style={{ color: "#86efac", fontSize: 13, fontFamily: "'DM Mono', monospace", marginBottom: 6 }}>
            STUDENT ID
          </div>
          <div style={{ color: "#fff", fontSize: 36, fontWeight: 600, marginBottom: 4 }}>
            #{match.student_id}
          </div>
          <div style={{ color: "#4ade80", fontSize: 13, fontFamily: "'DM Mono', monospace" }}>
            Confidence: {(match.confidence * 100).toFixed(1)}%
          </div>
          {activeSession && (
            <div style={{ color: "#86efac", fontSize: 12, fontFamily: "'DM Mono', monospace", marginTop: 8 }}>
              {activeSession.subject_name} · {activeSession.classroom}
            </div>
          )}
        </div>
      )}

      {/* Instruction */}
      {status === "detecting" && (
        <p style={{ color: "#475569", fontSize: 14, marginTop: 8 }}>
          {activeSession
            ? "Position your face within the circle"
            : "⚠ Waiting for teacher to start a class..."}
        </p>
      )}

      {/* Footer */}
      <div style={{
        position: "absolute", bottom: 24,
        color: "#1e293b", fontSize: 12,
        fontFamily: "'DM Mono', monospace", letterSpacing: 1,
      }}>
        ATTENDANCE TRACKING SYSTEM · {new Date().getFullYear()}
      </div>

      <style>{`
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin   { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  );
}
