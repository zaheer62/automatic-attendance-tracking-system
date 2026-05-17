import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const cards = [
  {
    role: 'Admin',
    icon: '🛡️',
    desc: 'Manage institution-wide attendance, users, reports and alerts.',
    accent: '#38bdf8',
    glow: 'rgba(56,189,248,0.25)',
    border: 'rgba(56,189,248,0.3)',
    path: '/login/admin',
    tag: 'Full Control',
  },
  {
    role: 'Teacher',
    icon: '👨‍🏫',
    desc: "View today's class attendance, override records and track students.",
    accent: '#34d399',
    glow: 'rgba(52,211,153,0.25)',
    border: 'rgba(52,211,153,0.3)',
    path: '/login/teacher',
    tag: 'Class Manager',
  },
  {
    role: 'Student',
    icon: '🎓',
    desc: 'Check your attendance history, percentage and GDPR data rights.',
    accent: '#a78bfa',
    glow: 'rgba(167,139,250,0.25)',
    border: 'rgba(167,139,250,0.3)',
    path: '/login/student',
    tag: 'Personal View',
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Animated particle grid
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W = canvas.width = window.innerWidth;
    let H = canvas.height = window.innerHeight;

    const resize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; };
    window.addEventListener('resize', resize);

    const dots: { x: number; y: number; vx: number; vy: number; r: number }[] = [];
    for (let i = 0; i < 60; i++) {
      dots.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4, r: Math.random() * 1.5 + 0.5 });
    }

    let raf: number;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      dots.forEach(d => {
        d.x += d.vx; d.y += d.vy;
        if (d.x < 0) d.x = W; if (d.x > W) d.x = 0;
        if (d.y < 0) d.y = H; if (d.y > H) d.y = 0;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(148,163,184,0.4)';
        ctx.fill();
      });
      dots.forEach((a, i) => dots.slice(i + 1).forEach(b => {
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (dist < 120) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(148,163,184,${0.15 * (1 - dist / 120)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }));
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 20% 50%, #0f172a 0%, #020617 60%, #0c0a1e 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      position: 'relative',
      overflow: 'hidden',
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Syne:wght@700;800&display=swap');

        .role-card {
          animation: fadeUp 0.6s ease both;
        }
        .role-card:nth-child(1) { animation-delay: 0.1s; }
        .role-card:nth-child(2) { animation-delay: 0.2s; }
        .role-card:nth-child(3) { animation-delay: 0.3s; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(32px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .role-card:hover .card-arrow {
          transform: translateX(4px);
          opacity: 1;
        }

        .hero-title {
          animation: fadeUp 0.5s ease both;
        }
        .hero-sub {
          animation: fadeUp 0.5s 0.1s ease both;
        }

        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.5); opacity: 0; }
        }
      `}</style>

      {/* Particle canvas */}
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, zIndex: 0 }} />

      {/* Glow orbs */}
      <div style={{ position: 'absolute', top: '10%', left: '5%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(56,189,248,0.06) 0%, transparent 70%)', zIndex: 0 }} />
      <div style={{ position: 'absolute', bottom: '10%', right: '5%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(167,139,250,0.06) 0%, transparent 70%)', zIndex: 0 }} />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 960, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        {/* Badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)',
          borderRadius: 100, padding: '6px 16px', marginBottom: 28,
          animation: 'fadeUp 0.4s ease both',
        }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 8px #38bdf8', position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#38bdf8', animation: 'pulse-ring 1.5s ease infinite' }} />
          </div>
          <span style={{ color: '#7dd3fc', fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>
            Smart Attendance Platform
          </span>
        </div>

        {/* Title */}
        <h1 className="hero-title" style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: 'clamp(36px, 6vw, 64px)',
          fontWeight: 800,
          color: '#f8fafc',
          margin: '0 0 16px',
          textAlign: 'center',
          lineHeight: 1.1,
          letterSpacing: -1,
        }}>
          Attendance{' '}
          <span style={{
            background: 'linear-gradient(135deg, #38bdf8, #818cf8)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            Intelligence
          </span>
        </h1>

        <p className="hero-sub" style={{
          color: '#64748b',
          fontSize: 16,
          marginBottom: 56,
          textAlign: 'center',
          maxWidth: 420,
          lineHeight: 1.6,
        }}>
          Face-recognition powered attendance tracking. Select your role to continue.
        </p>

        {/* Cards */}
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center', width: '100%' }}>
          {cards.map((card) => (
            <div
              key={card.role}
              className="role-card"
              onClick={() => navigate(card.path)}
              style={{
                background: 'rgba(15,23,42,0.8)',
                backdropFilter: 'blur(20px)',
                border: `1px solid ${card.border}`,
                borderRadius: 20,
                padding: '32px 28px',
                width: 272,
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden',
                transition: 'transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease',
                boxShadow: `0 0 0 0 ${card.glow}`,
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.transform = 'translateY(-8px)';
                el.style.boxShadow = `0 24px 60px ${card.glow}, 0 0 0 1px ${card.border}`;
                el.style.borderColor = card.accent;
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.transform = 'translateY(0)';
                el.style.boxShadow = '0 0 0 0 transparent';
                el.style.borderColor = card.border;
              }}
            >
              {/* Top glow */}
              <div style={{
                position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                width: '60%', height: 1,
                background: `linear-gradient(90deg, transparent, ${card.accent}, transparent)`,
              }} />

              {/* Tag */}
              <div style={{
                display: 'inline-block',
                background: `rgba(${card.accent === '#38bdf8' ? '56,189,248' : card.accent === '#34d399' ? '52,211,153' : '167,139,250'},0.1)`,
                color: card.accent,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                padding: '4px 10px',
                borderRadius: 100,
                marginBottom: 20,
                border: `1px solid ${card.border}`,
              }}>
                {card.tag}
              </div>

              {/* Icon */}
              <div style={{
                width: 60, height: 60, borderRadius: 16,
                background: `rgba(${card.accent === '#38bdf8' ? '56,189,248' : card.accent === '#34d399' ? '52,211,153' : '167,139,250'},0.08)`,
                border: `1px solid ${card.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28, marginBottom: 20,
                boxShadow: `0 0 20px ${card.glow}`,
              }}>
                {card.icon}
              </div>

              {/* Role */}
              <h2 style={{
                fontFamily: "'Syne', sans-serif",
                color: '#f1f5f9',
                fontSize: 22,
                fontWeight: 800,
                margin: '0 0 10px',
                letterSpacing: -0.5,
              }}>
                {card.role}
              </h2>

              {/* Desc */}
              <p style={{
                color: '#475569',
                fontSize: 13,
                lineHeight: 1.6,
                margin: '0 0 28px',
              }}>
                {card.desc}
              </p>

              {/* CTA */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: `linear-gradient(135deg, rgba(${card.accent === '#38bdf8' ? '56,189,248' : card.accent === '#34d399' ? '52,211,153' : '167,139,250'},0.12), rgba(${card.accent === '#38bdf8' ? '56,189,248' : card.accent === '#34d399' ? '52,211,153' : '167,139,250'},0.05))`,
                border: `1px solid ${card.border}`,
                borderRadius: 10,
                padding: '11px 16px',
              }}>
                <span style={{ color: card.accent, fontSize: 13, fontWeight: 700 }}>
                  Enter as {card.role}
                </span>
                <span className="card-arrow" style={{
                  color: card.accent, fontSize: 16,
                  transition: 'transform 0.2s, opacity 0.2s',
                  opacity: 0.6,
                }}>→</span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <p style={{ color: '#1e293b', fontSize: 12, marginTop: 48, letterSpacing: 0.5 }}>
          Secured with face recognition · GDPR compliant
        </p>
      </div>
    </div>
  );
}
