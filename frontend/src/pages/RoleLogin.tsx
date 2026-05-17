import React, { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../api/axios';

const ROLE_CONFIG: Record<string, {
  label: string;
  icon: string;
  accent: string;
  glow: string;
  border: string;
  redirectTo: string;
  placeholder: string;
  tag: string;
}> = {
  admin: {
    label: 'Admin',
    icon: '🛡️',
    accent: '#38bdf8',
    glow: 'rgba(56,189,248,0.2)',
    border: 'rgba(56,189,248,0.3)',
    redirectTo: '/admin',
    placeholder: 'admin@college.edu',
    tag: 'Full Control',
  },
  teacher: {
    label: 'Teacher',
    icon: '👨‍🏫',
    accent: '#34d399',
    glow: 'rgba(52,211,153,0.2)',
    border: 'rgba(52,211,153,0.3)',
    redirectTo: '/teacher',
    placeholder: 'priya@college.edu',
    tag: 'Class Manager',
  },
  student: {
    label: 'Student',
    icon: '🎓',
    accent: '#a78bfa',
    glow: 'rgba(167,139,250,0.2)',
    border: 'rgba(167,139,250,0.3)',
    redirectTo: '/student',
    placeholder: 'zaheer@student.edu',
    tag: 'Personal View',
  },
};

export default function RoleLogin() {
  const { role } = useParams<{ role: string }>();
  const navigate = useNavigate();
  const config = ROLE_CONFIG[role || ''];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!config) {
    return <div>Invalid role. <Link to="/">Go back</Link></div>;
  }

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      const returnedRole = res.data.role;
      if (returnedRole !== role) {
        setError(`This account is not a ${config.label}. Please use the correct login page.`);
        setLoading(false);
        return;
      }
      localStorage.setItem('token', res.data.access_token);
      localStorage.setItem('role', returnedRole);
      localStorage.setItem('user_id', String(res.data.user_id));
      localStorage.setItem('user_name', res.data.full_name || email);
      navigate(config.redirectTo);
    } catch {
      setError('Invalid email or password.');
    }
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleLogin();
  };

  const accentRgb = config.accent === '#38bdf8' ? '56,189,248' : config.accent === '#34d399' ? '52,211,153' : '167,139,250';

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 20% 50%, #0f172a 0%, #020617 60%, #0c0a1e 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      position: 'relative',
      overflow: 'hidden',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Syne:wght@700;800&display=swap');

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        .login-card {
          animation: fadeUp 0.5s ease both;
        }
        .login-input:focus {
          border-color: ${config.accent} !important;
          box-shadow: 0 0 0 3px ${config.glow} !important;
        }
        .login-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 24px ${config.glow} !important;
        }
        .login-btn:active:not(:disabled) {
          transform: translateY(0);
        }
      `}</style>

      {/* Background glow orbs */}
      <div style={{ position: 'absolute', top: '15%', left: '10%', width: 350, height: 350, borderRadius: '50%', background: `radial-gradient(circle, rgba(${accentRgb},0.05) 0%, transparent 70%)`, zIndex: 0 }} />
      <div style={{ position: 'absolute', bottom: '15%', right: '10%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.05) 0%, transparent 70%)', zIndex: 0 }} />

      {/* Grid pattern */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        backgroundImage: `linear-gradient(rgba(148,163,184,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.03) 1px, transparent 1px)`,
        backgroundSize: '40px 40px',
      }} />

      <div className="login-card" style={{
        position: 'relative', zIndex: 1,
        background: 'rgba(15,23,42,0.85)',
        backdropFilter: 'blur(24px)',
        border: `1px solid ${config.border}`,
        borderRadius: 24,
        padding: '40px 36px',
        width: '100%',
        maxWidth: 420,
        boxShadow: `0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px ${config.border}, inset 0 1px 0 rgba(255,255,255,0.05)`,
      }}>
        {/* Top accent line */}
        <div style={{
          position: 'absolute', top: 0, left: '20%', right: '20%', height: 1,
          background: `linear-gradient(90deg, transparent, ${config.accent}, transparent)`,
          borderRadius: 1,
        }} />

        {/* Tag */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: `rgba(${accentRgb},0.08)`,
            border: `1px solid ${config.border}`,
            borderRadius: 100, padding: '5px 14px', marginBottom: 20,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: config.accent, boxShadow: `0 0 6px ${config.accent}`, position: 'relative' }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: config.accent, animation: 'pulse-ring 1.5s ease infinite' }} />
            </div>
            <span style={{ color: config.accent, fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase' }}>
              {config.tag}
            </span>
          </div>

          {/* Icon */}
          <div style={{
            width: 68, height: 68, borderRadius: 18,
            background: `rgba(${accentRgb},0.08)`,
            border: `1px solid ${config.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 30, margin: '0 auto 16px',
            boxShadow: `0 0 24px ${config.glow}`,
          }}>
            {config.icon}
          </div>

          <h1 style={{
            fontFamily: "'Syne', sans-serif",
            color: '#f1f5f9',
            fontSize: 26,
            fontWeight: 800,
            margin: '0 0 6px',
            letterSpacing: -0.5,
          }}>
            {config.label} <span style={{ color: config.accent }}>Login</span>
          </h1>
          <p style={{ color: '#475569', fontSize: 13, margin: 0 }}>
            Sign in to access your dashboard
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: 'rgba(220,38,38,0.08)',
            border: '1px solid rgba(220,38,38,0.3)',
            borderRadius: 10,
            padding: '10px 14px',
            color: '#fca5a5',
            fontSize: 13,
            marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span>⚠</span> {error}
          </div>
        )}

        {/* Email */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 8, letterSpacing: 1, textTransform: 'uppercase' }}>
            Email Address
          </label>
          <input
            className="login-input"
            type="email"
            placeholder={config.placeholder}
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.04)',
              border: '1.5px solid rgba(148,163,184,0.15)',
              borderRadius: 10,
              padding: '12px 14px',
              fontSize: 14,
              color: '#f1f5f9',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.2s, box-shadow 0.2s',
            }}
          />
        </div>

        {/* Password */}
        <div style={{ marginBottom: 28 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 8, letterSpacing: 1, textTransform: 'uppercase' }}>
            Password
          </label>
          <div style={{ position: 'relative' }}>
            <input
              className="login-input"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.04)',
                border: '1.5px solid rgba(148,163,184,0.15)',
                borderRadius: 10,
                padding: '12px 44px 12px 14px',
                fontSize: 14,
                color: '#f1f5f9',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
            />
            <button
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#475569', fontSize: 16, padding: 0,
              }}
            >
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

        {/* Login Button */}
        <button
          className="login-btn"
          onClick={handleLogin}
          disabled={loading}
          style={{
            width: '100%',
            background: loading
              ? `rgba(${accentRgb},0.3)`
              : `linear-gradient(135deg, rgba(${accentRgb},0.9), rgba(${accentRgb},0.6))`,
            color: '#fff',
            border: `1px solid ${config.border}`,
            borderRadius: 10,
            padding: '13px 0',
            fontSize: 14,
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            marginBottom: 20,
            transition: 'transform 0.2s, box-shadow 0.2s',
            letterSpacing: 0.3,
          }}
        >
          {loading ? 'Signing in...' : `Sign in as ${config.label} →`}
        </button>

        {/* Back */}
        <div style={{ textAlign: 'center' }}>
          <Link to="/" style={{ color: '#334155', fontSize: 13, textDecoration: 'none', transition: 'color 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.color = config.accent)}
            onMouseLeave={e => (e.currentTarget.style.color = '#334155')}
          >
            ← Back to role selection
          </Link>
        </div>
      </div>
    </div>
  );
}
