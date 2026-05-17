import { useEffect, useRef, useState } from "react";
import api from "../api/axios";

interface Student {
  id: number;
  full_name: string;
  student_id?: string;
}

type EnrollStatus = "idle" | "capturing" | "processing" | "success" | "error";

export default function FaceEnrollPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<number | null>(null);
  const [camReady, setCamReady] = useState(false);
  const [status, setStatus] = useState<EnrollStatus>("idle");
  const [message, setMessage] = useState("");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [enrolledStudents, setEnrolledStudents] = useState<number[]>([]);

  // Load students
  useEffect(() => {
    api.get("/users/students").then((r) => setStudents(r.data)).catch(() => {});
    api.get("/face/enrolled").then((r) => setEnrolledStudents(r.data)).catch(() => {});
  }, []);

  // Start webcam
  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: { width: 640, height: 480, facingMode: "user" } })
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
        setStatus("error");
        setMessage("Camera access denied. Please allow camera permissions.");
      });

    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream)
          .getTracks()
          .forEach((t) => t.stop());
      }
    };
  }, []);

  // Capture photo from webcam
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Mirror the image (since video is mirrored)
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setCapturedImage(dataUrl);
    setStatus("capturing");
  };

  // Retake photo
  const retake = () => {
    setCapturedImage(null);
    setStatus("idle");
    setMessage("");
  };

  // Enroll the captured face
  const enrollFace = async () => {
    if (!capturedImage || !selectedStudent) return;
    setStatus("processing");
    setMessage("");

    try {
      // Convert base64 to blob
      const res = await fetch(capturedImage);
      const blob = await res.blob();
      const form = new FormData();
      form.append("file", blob, "face.jpg");

      await api.post(`/face/enroll/${selectedStudent}`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setStatus("success");
      setMessage(`Face enrolled successfully for ${students.find(s => s.id === selectedStudent)?.full_name}!`);
      setEnrolledStudents(prev => [...prev.filter(id => id !== selectedStudent), selectedStudent]);

      // Reset after 3 seconds
      setTimeout(() => {
        setCapturedImage(null);
        setStatus("idle");
        setMessage("");
        setSelectedStudent(null);
      }, 3000);
    } catch (e: any) {
      setStatus("error");
      setMessage(e?.response?.data?.detail ?? "Enrollment failed. Make sure face is clearly visible.");
    }
  };

  const selectedStudentName = students.find(s => s.id === selectedStudent)?.full_name;

  return (
    <div style={{ minHeight: "100vh", background: "#f0f4ff", fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
        padding: "20px 32px", boxShadow: "0 2px 12px rgba(30,64,175,0.3)"
      }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#fff" }}>Face Enrollment</div>
        <div style={{ fontSize: 13, color: "#bfdbfe", marginTop: 2 }}>
          Register student faces for kiosk recognition
        </div>
      </div>

      <div style={{ padding: "28px 32px", maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>

          {/* Left — Camera */}
          <div style={{
            background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0",
            padding: 24, boxShadow: "0 1px 8px rgba(0,0,0,0.06)"
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", marginBottom: 16 }}>
              📷 Webcam Capture
            </div>

            {/* Camera preview or captured image */}
            <div style={{
              width: "100%", aspectRatio: "4/3",
              background: "#0f172a", borderRadius: 12,
              overflow: "hidden", position: "relative",
              border: "2px solid #e2e8f0",
            }}>
              {/* Live video — hidden when image captured */}
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                style={{
                  width: "100%", height: "100%",
                  objectFit: "cover",
                  transform: "scaleX(-1)",
                  display: capturedImage ? "none" : "block",
                }}
              />

              {/* Captured image preview */}
              {capturedImage && (
                <img
                  src={capturedImage}
                  alt="Captured"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              )}

              {/* Face guide overlay on live video */}
              {!capturedImage && camReady && (
                <div style={{
                  position: "absolute", inset: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  pointerEvents: "none",
                }}>
                  <div style={{
                    width: 160, height: 200,
                    border: "2px dashed rgba(255,255,255,0.4)",
                    borderRadius: "50%",
                  }} />
                </div>
              )}

              {/* Status overlay on captured */}
              {status === "processing" && (
                <div style={{
                  position: "absolute", inset: 0,
                  background: "rgba(0,0,0,0.6)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: 16, fontWeight: 600,
                }}>
                  Processing...
                </div>
              )}

              {status === "success" && (
                <div style={{
                  position: "absolute", inset: 0,
                  background: "rgba(5,46,22,0.8)",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                }}>
                  <div style={{ fontSize: 48 }}>✅</div>
                  <div style={{ color: "#86efac", fontSize: 16, fontWeight: 600, marginTop: 8 }}>
                    Enrolled!
                  </div>
                </div>
              )}

              {!camReady && status !== "error" && (
                <div style={{
                  position: "absolute", inset: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#64748b", fontSize: 14,
                }}>
                  Starting camera...
                </div>
              )}
            </div>

            <canvas ref={canvasRef} style={{ display: "none" }} />

            {/* Camera instruction */}
            {!capturedImage && (
              <p style={{ fontSize: 13, color: "#94a3b8", textAlign: "center" as const, margin: "12px 0" }}>
                Ask the student to look directly at the camera
              </p>
            )}

            {/* Buttons */}
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              {!capturedImage ? (
                <button
                  onClick={capturePhoto}
                  disabled={!camReady || !selectedStudent}
                  style={{
                    flex: 1,
                    background: camReady && selectedStudent
                      ? "linear-gradient(135deg, #1e40af, #3b82f6)"
                      : "#e2e8f0",
                    color: camReady && selectedStudent ? "#fff" : "#94a3b8",
                    border: "none", borderRadius: 10,
                    padding: "12px 0", fontSize: 14, fontWeight: 700,
                    cursor: camReady && selectedStudent ? "pointer" : "not-allowed",
                    boxShadow: camReady && selectedStudent ? "0 2px 8px rgba(30,64,175,0.4)" : "none",
                  }}
                >
                  📸 Capture Photo
                </button>
              ) : (
                <>
                  <button
                    onClick={retake}
                    disabled={status === "processing" || status === "success"}
                    style={{
                      flex: 1, background: "#fff",
                      border: "1px solid #e2e8f0", color: "#64748b",
                      borderRadius: 10, padding: "12px 0",
                      fontSize: 14, fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    🔄 Retake
                  </button>
                  <button
                    onClick={enrollFace}
                    disabled={status === "processing" || status === "success"}
                    style={{
                      flex: 1,
                      background: "linear-gradient(135deg, #16a34a, #15803d)",
                      color: "#fff", border: "none", borderRadius: 10,
                      padding: "12px 0", fontSize: 14, fontWeight: 700,
                      cursor: status === "processing" ? "not-allowed" : "pointer",
                      opacity: status === "processing" ? 0.7 : 1,
                      boxShadow: "0 2px 8px rgba(22,163,74,0.4)",
                    }}
                  >
                    {status === "processing" ? "Enrolling..." : "✓ Enroll Face"}
                  </button>
                </>
              )}
            </div>

            {/* Message */}
            {message && (
              <div style={{
                marginTop: 12, padding: "10px 14px", borderRadius: 8,
                background: status === "success" ? "#f0fdf4" : "#fef2f2",
                border: `1px solid ${status === "success" ? "#16a34a" : "#dc2626"}`,
                color: status === "success" ? "#15803d" : "#dc2626",
                fontSize: 13, fontWeight: 500,
              }}>
                {message}
              </div>
            )}
          </div>

          {/* Right — Student selection + enrolled list */}
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 16 }}>

            {/* Student selector */}
            <div style={{
              background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0",
              padding: 24, boxShadow: "0 1px 8px rgba(0,0,0,0.06)"
            }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", marginBottom: 16 }}>
                👤 Select Student
              </div>
              <select
                value={selectedStudent ?? ""}
                onChange={(e) => {
                  setSelectedStudent(Number(e.target.value));
                  setCapturedImage(null);
                  setStatus("idle");
                  setMessage("");
                }}
                style={{
                  width: "100%", padding: "12px 14px", borderRadius: 10,
                  border: "1px solid #e2e8f0", fontSize: 14,
                  background: "#f8fafc", color: "#1e293b",
                  outline: "none",
                }}
              >
                <option value="">Choose a student...</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name} {enrolledStudents.includes(s.id) ? "✓" : "○"}
                  </option>
                ))}
              </select>

              {selectedStudent && (
                <div style={{
                  marginTop: 12, padding: "12px 16px", borderRadius: 10,
                  background: "#eff6ff", border: "1px solid #bfdbfe",
                }}>
                  <div style={{ fontSize: 13, color: "#1e40af", fontWeight: 600 }}>
                    Selected: {selectedStudentName}
                  </div>
                  <div style={{ fontSize: 12, color: "#3b82f6", marginTop: 4 }}>
                    {enrolledStudents.includes(selectedStudent)
                      ? "✓ Face already enrolled — capturing will update it"
                      : "○ Not yet enrolled — capture their face to register"}
                  </div>
                </div>
              )}
            </div>

            {/* Enrolled students list */}
            <div style={{
              background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0",
              padding: 24, boxShadow: "0 1px 8px rgba(0,0,0,0.06)", flex: 1,
            }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", marginBottom: 16 }}>
                📋 Enrollment Status
              </div>
              {students.length === 0 ? (
                <div style={{ color: "#94a3b8", fontSize: 13 }}>No students found.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
                  {students.map((s) => {
                    const enrolled = enrolledStudents.includes(s.id);
                    return (
                      <div key={s.id} style={{
                        display: "flex", justifyContent: "space-between",
                        alignItems: "center", padding: "10px 14px",
                        borderRadius: 8,
                        background: enrolled ? "#f0fdf4" : "#fafafa",
                        border: `1px solid ${enrolled ? "#bbf7d0" : "#e2e8f0"}`,
                      }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>
                            {s.full_name}
                          </div>
                          {s.student_id && (
                            <div style={{ fontSize: 12, color: "#94a3b8" }}>
                              ID: {s.student_id}
                            </div>
                          )}
                        </div>
                        <span style={{
                          fontSize: 12, fontWeight: 700,
                          padding: "3px 10px", borderRadius: 20,
                          background: enrolled ? "#dcfce7" : "#f1f5f9",
                          color: enrolled ? "#15803d" : "#94a3b8",
                        }}>
                          {enrolled ? "✓ Enrolled" : "Not enrolled"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Instructions */}
            <div style={{
              background: "#fffbeb", borderRadius: 12,
              border: "1px solid #fde68a", padding: "14px 18px",
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#92400e", marginBottom: 8 }}>
                📌 How to enroll
              </div>
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#78350f", lineHeight: 1.8 }}>
                <li>Select the student from the dropdown</li>
                <li>Ask them to sit in front of the camera</li>
                <li>Make sure their face is well-lit and centered</li>
                <li>Click "Capture Photo"</li>
                <li>If good, click "Enroll Face" — or Retake</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
