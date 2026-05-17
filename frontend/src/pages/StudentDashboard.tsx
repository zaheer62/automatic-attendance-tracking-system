import PrivacyControls from "../components/PrivacyControls";
import React, { useEffect, useState } from 'react';
import api from '../api/axios';

/* ─── Google Fonts injected once ─────────────────────────────────────────── */
if (typeof document !== 'undefined' && !document.getElementById('edu-fonts')) {
  const link = document.createElement('link');
  link.id = 'edu-fonts';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Fraunces:ital,wght@0,700;0,900;1,700&display=swap';
  document.head.appendChild(link);
}

/* ─── Shared CSS injected once ────────────────────────────────────────────── */
const GLOBAL_CSS = `
  .edu-root * { box-sizing: border-box; margin: 0; padding: 0; }
  .edu-root { font-family: 'DM Sans', 'Segoe UI', sans-serif; min-height: 100vh; background: #eef1f8; color: #1a1d2e; }

  /* NAV */
  .edu-nav { background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 65%, #4f46e5 100%); height: 62px; padding: 0 2rem; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 4px 20px rgba(37,99,235,0.3); }
  .edu-nav-brand { display: flex; align-items: center; gap: 10px; color: #fff; font-family: 'Fraunces', serif; font-size: 1.2rem; font-weight: 900; letter-spacing: -0.4px; }
  .edu-nav-badge { background: rgba(255,255,255,0.18); border-radius: 8px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 1rem; }
  .edu-nav-right { display: flex; align-items: center; gap: 14px; }
  .edu-avatar { width: 34px; height: 34px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 0.8rem; border: 2px solid rgba(255,255,255,0.4); }
  .edu-nav-name { color: rgba(255,255,255,0.88); font-size: 0.88rem; font-weight: 500; }

  /* HERO */
  .edu-hero { background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); padding: 2.2rem 2rem 3.8rem; position: relative; overflow: hidden; }
  .edu-hero::before { content:''; position:absolute; top:-70px; right:-70px; width:260px; height:260px; background:rgba(255,255,255,0.05); border-radius:50%; pointer-events:none; }
  .edu-hero::after  { content:''; position:absolute; bottom:-90px; left:25%; width:220px; height:220px; background:rgba(255,255,255,0.04); border-radius:50%; pointer-events:none; }
  .edu-hero-inner { max-width: 860px; margin: 0 auto; display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; }
  .edu-hero-title { font-family: 'Fraunces', serif; font-size: 2rem; font-weight: 900; color: #fff; letter-spacing: -0.8px; line-height: 1.15; }
  .edu-hero-sub { color: rgba(255,255,255,0.68); font-size: 0.92rem; margin-top: 5px; }
  .edu-kiosk-btn { display: inline-flex; align-items: center; gap: 8px; background: #fff; color: #1e3a8a; padding: 11px 22px; border-radius: 50px; font-weight: 700; font-size: 0.88rem; cursor: pointer; border: none; box-shadow: 0 6px 20px rgba(0,0,0,0.18); transition: transform 0.18s, box-shadow 0.18s; white-space: nowrap; flex-shrink: 0; }
  .edu-kiosk-btn:hover { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(0,0,0,0.22); }

  /* MAIN */
  .edu-main { max-width: 860px; margin: -2.4rem auto 2.5rem; padding: 0 1.5rem; position: relative; z-index: 2; }

  /* STAT CARDS */
  .edu-stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 13px; margin-bottom: 18px; }
  .edu-stat { background: #fff; border-radius: 16px; padding: 1.3rem 1.1rem; box-shadow: 0 2px 10px rgba(0,0,0,0.06); border: 1px solid #edf0f8; transition: transform 0.18s, box-shadow 0.18s; }
  .edu-stat:hover { transform: translateY(-3px); box-shadow: 0 8px 22px rgba(0,0,0,0.09); }
  .edu-stat-icon { width: 38px; height: 38px; border-radius: 11px; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; margin-bottom: 11px; }
  .edu-stat-label { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.9px; color: #9ca3af; margin-bottom: 3px; }
  .edu-stat-val { font-family: 'Fraunces', serif; font-size: 1.9rem; font-weight: 900; color: #1a1d2e; line-height: 1; }
  .edu-stat-val.green { color: #16a34a; }
  .edu-stat-val.red   { color: #dc2626; }

  /* PROGRESS CARD */
  .edu-progress-card { background: #fff; border-radius: 16px; padding: 1.6rem; box-shadow: 0 2px 10px rgba(0,0,0,0.06); border: 1px solid #edf0f8; display: flex; align-items: center; gap: 1.8rem; margin-bottom: 16px; }
  .edu-progress-info { flex: 1; }
  .edu-progress-title { font-family: 'Fraunces', serif; font-size: 1.15rem; font-weight: 900; color: #1a1d2e; }
  .edu-progress-sub { font-size: 0.82rem; color: #6b7280; margin-top: 3px; }
  .edu-bar-wrap { background: #f3f4f6; border-radius: 99px; height: 10px; margin-top: 14px; overflow: hidden; }
  .edu-bar { height: 100%; border-radius: 99px; background: linear-gradient(90deg, #2563eb, #4f46e5); transition: width 1.1s cubic-bezier(.4,0,.2,1); }
  .edu-bar-labels { display: flex; justify-content: space-between; font-size: 0.72rem; color: #9ca3af; margin-top: 5px; font-weight: 500; }

  /* ALERT */
  .edu-alert { border-radius: 13px; padding: 0.9rem 1.1rem; margin-bottom: 16px; display: flex; align-items: center; gap: 10px; font-size: 0.88rem; font-weight: 600; }
  .edu-alert.warn { background: linear-gradient(135deg,#fef3c7,#fde68a); border-left: 4px solid #f59e0b; color: #92400e; }
  .edu-alert.danger { background: linear-gradient(135deg,#fee2e2,#fecaca); border-left: 4px solid #ef4444; color: #991b1b; }

  /* SECTION CARD */
  .edu-card { background: #fff; border-radius: 16px; box-shadow: 0 2px 10px rgba(0,0,0,0.06); border: 1px solid #edf0f8; overflow: hidden; margin-bottom: 20px; }
  .edu-card-header { padding: 1.1rem 1.4rem; border-bottom: 1px solid #f3f4f6; display: flex; align-items: center; gap: 9px; }
  .edu-card-title { font-family: 'Fraunces', serif; font-size: 1.05rem; font-weight: 900; color: #1a1d2e; }

  /* TABLE */
  .edu-table { width: 100%; border-collapse: collapse; }
  .edu-table th { padding: 11px 18px; text-align: left; font-size: 0.69rem; color: #6b7280; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; background: #f8fafc; border-bottom: 1px solid #edf0f8; }
  .edu-table td { padding: 13px 18px; font-size: 0.88rem; border-top: 1px solid #f3f4f6; color: #374151; }
  .edu-table tbody tr:hover td { background: #f8fafc; }
  .edu-table tbody tr:nth-child(even) td { background: #fafafa; }
  .edu-table tbody tr:nth-child(even):hover td { background: #f3f4f6; }
  .edu-pill { font-size: 0.72rem; font-weight: 700; padding: 3px 11px; border-radius: 99px; }
  .edu-pill.present { background: #dcfce7; color: #15803d; }
  .edu-pill.absent  { background: #fee2e2; color: #dc2626; }
  .edu-empty { padding: 2.8rem; text-align: center; color: #9ca3af; font-size: 0.88rem; }

  /* NOTIFICATION PANEL */
  .edu-ntab-wrap { display: flex; background: #f1f5f9; border-radius: 10px; padding: 4px; gap: 4px; margin: 0 1.4rem 1.2rem; }
  .edu-ntab { flex: 1; padding: 9px 0; border: none; border-radius: 8px; font-weight: 700; font-size: 12.5px; cursor: pointer; transition: all 0.2s; }
  .edu-ntab.active { background: linear-gradient(135deg,#1e3a8a,#2563eb); color: #fff; box-shadow: 0 3px 10px rgba(37,99,235,0.28); }
  .edu-ntab.inactive { background: transparent; color: #64748b; }
  .edu-ntab-body { padding: 0 1.4rem 1.4rem; }
  .edu-toggle-row { display: flex; align-items: center; justify-content: space-between; padding: 11px 14px; background: #f8fafc; border-radius: 10px; margin-bottom: 18px; }
  .edu-toggle-label { font-size: 0.9rem; font-weight: 600; color: #1e293b; }
  .edu-toggle-sub { font-size: 0.75rem; color: #64748b; margin-top: 2px; }
  .edu-field-label { display: block; font-size: 0.7rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.7px; margin-bottom: 6px; }
  .edu-field-row { display: flex; gap: 8px; margin-bottom: 14px; }
  .edu-input { flex: 1; padding: 10px 12px; border-radius: 8px; border: 1.5px solid #e2e8f0; font-size: 13px; color: #1e293b; outline: none; background: #fff; font-family: inherit; }
  .edu-input:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
  .edu-test-btn { padding: 9px 15px; border-radius: 8px; border: 1.5px solid #2563eb; background: #fff; color: #2563eb; font-size: 12px; font-weight: 700; cursor: pointer; white-space: nowrap; font-family: inherit; transition: background 0.15s; }
  .edu-test-btn:hover { background: #eff6ff; }
  .edu-test-btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .edu-trigger-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 13px; border: 1.5px solid #e2e8f0; border-radius: 9px; margin-bottom: 8px; transition: all 0.18s; }
  .edu-trigger-row.on { background: #eff6ff; border-color: #bfdbfe; }
  .edu-trigger-label { font-size: 0.88rem; font-weight: 600; color: #1e293b; }
  .edu-trigger-sub { font-size: 0.72rem; color: #94a3b8; margin-top: 2px; }
  .edu-slider { width: 100%; accent-color: #2563eb; margin-top: 8px; }
  .edu-slider-labels { display: flex; justify-content: space-between; font-size: 0.7rem; color: #94a3b8; margin-top: 3px; }
  .edu-card-footer { padding: 13px 1.4rem; border-top: 1px solid #f1f5f9; display: flex; justify-content: flex-end; }
  .edu-save-btn { background: linear-gradient(135deg,#1e3a8a,#2563eb); color: #fff; border: none; border-radius: 9px; padding: 10px 24px; font-size: 13px; font-weight: 700; cursor: pointer; font-family: inherit; box-shadow: 0 3px 10px rgba(37,99,235,0.32); transition: opacity 0.15s; }
  .edu-save-btn:disabled { opacity: 0.55; cursor: not-allowed; }

  /* TOGGLE SWITCH */
  .edu-switch { width: 42px; height: 23px; border-radius: 99px; border: none; cursor: pointer; position: relative; transition: background 0.2s; flex-shrink: 0; }
  .edu-switch.on  { background: #2563eb; }
  .edu-switch.off { background: #cbd5e1; }
  .edu-switch-knob { position: absolute; top: 2.5px; width: 18px; height: 18px; border-radius: 50%; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.22); transition: left 0.2s; }
  .edu-switch.on  .edu-switch-knob { left: 21px; }
  .edu-switch.off .edu-switch-knob { left: 3px; }

  /* TOAST */
  .edu-toast { position: fixed; bottom: 22px; right: 22px; z-index: 9999; padding: 11px 20px; border-radius: 10px; font-size: 13px; font-weight: 600; box-shadow: 0 4px 16px rgba(0,0,0,0.15); animation: eduSlideIn 0.28s ease; }
  @keyframes eduSlideIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }

  @media (max-width: 640px) {
    .edu-stats { grid-template-columns: repeat(2,1fr); }
    .edu-hero-title { font-size: 1.55rem; }
    .edu-progress-card { flex-direction: column; gap: 1rem; }
    .edu-hero-inner { flex-direction: column; align-items: flex-start; }
  }
`;

function injectStyles() {
  if (typeof document !== 'undefined' && !document.getElementById('edu-styles')) {
    const s = document.createElement('style');
    s.id = 'edu-styles';
    s.textContent = GLOBAL_CSS;
    document.head.appendChild(s);
  }
}

/* ─── Interfaces ──────────────────────────────────────────────────────────── */
interface AttendanceRecord {
  subject_name: string;
  date: string;
  status: string;
  method: string;
}

interface NotificationPrefs {
  email_enabled: boolean;
  email_address: string;
  email_threshold: number;
  notify_on_absent: boolean;
  notify_weekly_summary: boolean;
  sms_enabled: boolean;
  sms_number: string;
  sms_threshold: number;
  sms_on_absent: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  email_enabled: false,
  email_address: '',
  email_threshold: 75,
  notify_on_absent: true,
  notify_weekly_summary: false,
  sms_enabled: false,
  sms_number: '',
  sms_threshold: 75,
  sms_on_absent: true,
};

/* ─── Toggle Switch ───────────────────────────────────────────────────────── */
function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button className={`edu-switch ${on ? 'on' : 'off'}`} onClick={onClick}>
      <span className="edu-switch-knob" />
    </button>
  );
}

/* ─── Notification Panel ──────────────────────────────────────────────────── */
function NotificationPanel({ studentId }: { studentId: number }) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testingSms, setTestingSms] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [activeTab, setActiveTab] = useState<'email' | 'sms'>('email');

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    api.get(`/notifications/prefs/${studentId}`)
      .then(r => setPrefs({ ...DEFAULT_PREFS, ...r.data }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [studentId]);

  const save = async () => {
    setSaving(true);
    try {
      await api.post(`/notifications/prefs/${studentId}`, prefs);
      showToast('Preferences saved ✓');
    } catch {
      showToast('Failed to save preferences', false);
    } finally {
      setSaving(false);
    }
  };

  const sendTestEmail = async () => {
    if (!prefs.email_address) return showToast('Enter an email address first', false);
    setTestingEmail(true);
    try {
      await api.post(`/notifications/test-email/${studentId}`, { email: prefs.email_address });
      showToast('Test email sent! Check your inbox ✓');
    } catch {
      showToast('Failed to send test email', false);
    } finally {
      setTestingEmail(false);
    }
  };

  const sendTestSms = async () => {
    if (!prefs.sms_number) return showToast('Enter a phone number first', false);
    setTestingSms(true);
    try {
      await api.post(`/notifications/test-sms/${studentId}`, { phone: prefs.sms_number });
      showToast('Test SMS sent! Check your phone ✓');
    } catch {
      showToast('Failed to send test SMS', false);
    } finally {
      setTestingSms(false);
    }
  };

  const field = (key: keyof NotificationPrefs, val: any) =>
    setPrefs(p => ({ ...p, [key]: val }));

  if (loading) return null;

  return (
    <div className="edu-card" style={{ marginBottom: 20 }}>
      {/* Header */}
      <div className="edu-card-header">
        <span style={{ fontSize: 19 }}>🔔</span>
        <div>
          <div className="edu-card-title">Notification Preferences</div>
          <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 2 }}>
            Get alerts when your attendance drops below your threshold
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ padding: '14px 1.4rem 0' }}>
        <div className="edu-ntab-wrap" style={{ margin: 0 }}>
          {(['email', 'sms'] as const).map(t => (
            <button
              key={t}
              className={`edu-ntab ${activeTab === t ? 'active' : 'inactive'}`}
              onClick={() => setActiveTab(t)}
            >
              {t === 'email' ? '✉️ Email' : '📱 SMS'}
            </button>
          ))}
        </div>
      </div>

      {/* Email Tab */}
      {activeTab === 'email' && (
        <div className="edu-ntab-body" style={{ paddingTop: 16 }}>
          <div className="edu-toggle-row">
            <div>
              <div className="edu-toggle-label">Email Notifications</div>
              <div className="edu-toggle-sub">{prefs.email_enabled ? 'Currently enabled' : 'Currently disabled'}</div>
            </div>
            <Switch on={prefs.email_enabled} onClick={() => field('email_enabled', !prefs.email_enabled)} />
          </div>

          {prefs.email_enabled && (
            <>
              <label className="edu-field-label">Email Address</label>
              <div className="edu-field-row">
                <input
                  className="edu-input" type="email" placeholder="you@example.com"
                  value={prefs.email_address} onChange={e => field('email_address', e.target.value)}
                />
                <button className="edu-test-btn" onClick={sendTestEmail} disabled={testingEmail}>
                  {testingEmail ? 'Sending…' : 'Test'}
                </button>
              </div>

              <label className="edu-field-label">
                Alert Threshold — alert when below{' '}
                <span style={{ color: '#2563eb' }}>{prefs.email_threshold}%</span>
              </label>
              <input
                className="edu-slider" type="range" min={50} max={95} step={5}
                value={prefs.email_threshold} onChange={e => field('email_threshold', Number(e.target.value))}
              />
              <div className="edu-slider-labels" style={{ marginBottom: 16 }}>
                <span>50%</span><span>95%</span>
              </div>

              <label className="edu-field-label">Notify Me When</label>
              {[
                { key: 'notify_on_absent' as const, label: 'I am marked absent', sub: 'Instant alert after each missed class' },
                { key: 'notify_weekly_summary' as const, label: 'Weekly attendance summary', sub: 'Every Monday morning recap' },
              ].map(({ key, label, sub }) => (
                <div key={key} className={`edu-trigger-row ${prefs[key] ? 'on' : ''}`}>
                  <div>
                    <div className="edu-trigger-label">{label}</div>
                    <div className="edu-trigger-sub">{sub}</div>
                  </div>
                  <Switch on={prefs[key]} onClick={() => field(key, !prefs[key])} />
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* SMS Tab */}
      {activeTab === 'sms' && (
        <div className="edu-ntab-body" style={{ paddingTop: 16 }}>
          <div className="edu-toggle-row">
            <div>
              <div className="edu-toggle-label">SMS Notifications</div>
              <div className="edu-toggle-sub">{prefs.sms_enabled ? 'Currently enabled' : 'Currently disabled'}</div>
            </div>
            <Switch on={prefs.sms_enabled} onClick={() => field('sms_enabled', !prefs.sms_enabled)} />
          </div>

          {prefs.sms_enabled && (
            <>
              <label className="edu-field-label">Phone Number (with country code)</label>
              <div className="edu-field-row">
                <input
                  className="edu-input" type="tel" placeholder="+91 98765 43210"
                  value={prefs.sms_number} onChange={e => field('sms_number', e.target.value)}
                />
                <button className="edu-test-btn" onClick={sendTestSms} disabled={testingSms}>
                  {testingSms ? 'Sending…' : 'Test'}
                </button>
              </div>
              <p style={{ fontSize: '0.72rem', color: '#9ca3af', marginBottom: 14, marginTop: -8 }}>
                Standard SMS rates may apply from your carrier
              </p>

              <label className="edu-field-label">
                Alert Threshold — alert when below{' '}
                <span style={{ color: '#2563eb' }}>{prefs.sms_threshold}%</span>
              </label>
              <input
                className="edu-slider" type="range" min={50} max={95} step={5}
                value={prefs.sms_threshold} onChange={e => field('sms_threshold', Number(e.target.value))}
              />
              <div className="edu-slider-labels" style={{ marginBottom: 16 }}>
                <span>50%</span><span>95%</span>
              </div>

              <label className="edu-field-label">Notify Me When</label>
              <div className={`edu-trigger-row ${prefs.sms_on_absent ? 'on' : ''}`}>
                <div>
                  <div className="edu-trigger-label">I am marked absent</div>
                  <div className="edu-trigger-sub">Quick SMS alert after each missed class</div>
                </div>
                <Switch on={prefs.sms_on_absent} onClick={() => field('sms_on_absent', !prefs.sms_on_absent)} />
              </div>
            </>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="edu-card-footer">
        <button className="edu-save-btn" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save Preferences'}
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="edu-toast"
          style={{ background: toast.ok ? '#15803d' : '#dc2626', color: '#fff' }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}

/* ─── Main Dashboard ──────────────────────────────────────────────────────── */
export default function StudentDashboard() {
  injectStyles();

  const [stats, setStats] = useState<any>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [error, setError] = useState(false);
  const userId = localStorage.getItem('user_id');
  const userName = localStorage.getItem('user_name') || 'Student';

  useEffect(() => {
    if (!userId) return;
    api.get(`/attendance/student/${userId}/stats`)
      .then(res => setStats(res.data))
      .catch(() => setError(true));

    api.get(`/attendance/student/${userId}/records`)
      .then(res => setRecords(res.data))
      .catch(() => {});
  }, [userId]);

  if (!userId) {
    return (
      <div className="edu-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
        <div style={{ textAlign: 'center', color: '#6b7280' }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>🔒</div>
          <p style={{ fontWeight: 600 }}>Please log in to view your attendance.</p>
        </div>
      </div>
    );
  }

  const pct: number = stats?.percentage ?? 0;
  const initials = userName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="edu-root">
      {/* Nav */}
      <nav className="edu-nav">
        <div className="edu-nav-brand">
          <span className="edu-nav-badge">🎓</span>
          EduTrack
        </div>
        <div className="edu-nav-right">
          <div className="edu-avatar">{initials}</div>
          <span className="edu-nav-name">{userName}</span>
        </div>
      </nav>

      {/* Hero */}
      <div className="edu-hero">
        <div className="edu-hero-inner">
          <div>
            <div className="edu-hero-title">My Attendance</div>
            <div className="edu-hero-sub">Welcome back, {userName} 👋</div>
          </div>
          <button className="edu-kiosk-btn" onClick={() => window.open('/kiosk', '_blank')}>
            <span style={{ fontSize: 17 }}>📷</span>
            Check In via Kiosk
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="edu-main">
        {error && (
          <div className="edu-alert danger" style={{ marginBottom: 16 }}>
            ⚠️ Could not load attendance stats. Please try again.
          </div>
        )}

        {/* Stat Cards */}
        {stats && (
          <div className="edu-stats">
            {[
              { icon: '📅', bg: '#ede9fe', label: 'Total Sessions', val: stats.total_sessions, cls: '' },
              { icon: '✅', bg: '#d1fae5', label: 'Present',        val: stats.present,        cls: 'green' },
              { icon: '❌', bg: '#fee2e2', label: 'Absent',         val: stats.absent,         cls: 'red' },
              {
                icon: '📊',
                bg: pct >= 75 ? '#d1fae5' : '#fee2e2',
                label: 'Percentage',
                val: `${stats.percentage}%`,
                cls: pct >= 75 ? 'green' : 'red',
              },
            ].map(({ icon, bg, label, val, cls }) => (
              <div className="edu-stat" key={label}>
                <div className="edu-stat-icon" style={{ background: bg }}>{icon}</div>
                <div className="edu-stat-label">{label}</div>
                <div className={`edu-stat-val ${cls}`}>{val}</div>
              </div>
            ))}
          </div>
        )}

        {/* Progress Card */}
        {stats && (
          <div className="edu-progress-card">
            {/* Ring */}
            <svg width="108" height="108" viewBox="0 0 108 108" style={{ flexShrink: 0 }}>
              <circle cx="54" cy="54" r="46" fill="none" stroke="#f3f4f6" strokeWidth="11" />
              <circle
                cx="54" cy="54" r="46" fill="none"
                stroke="url(#eduGrad)" strokeWidth="11"
                strokeDasharray={`${(pct / 100) * 2 * Math.PI * 46} ${2 * Math.PI * 46}`}
                strokeLinecap="round"
                transform="rotate(-90 54 54)"
                style={{ transition: 'stroke-dasharray 1.1s cubic-bezier(.4,0,.2,1)' }}
              />
              <defs>
                <linearGradient id="eduGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#1e3a8a" />
                  <stop offset="100%" stopColor="#4f46e5" />
                </linearGradient>
              </defs>
              <text x="54" y="59" textAnchor="middle" fontSize="16" fontWeight="900"
                fontFamily="Fraunces, serif" fill="#1a1d2e">{pct}%</text>
            </svg>

            <div className="edu-progress-info">
              <div className="edu-progress-title">Attendance Rate</div>
              <div className="edu-progress-sub">Minimum required: 75%</div>
              <div className="edu-bar-wrap">
                <div className="edu-bar" style={{ width: `${pct}%` }} />
              </div>
              <div className="edu-bar-labels">
                <span>0%</span>
                <span style={{ color: '#f59e0b' }}>75% threshold</span>
                <span>100%</span>
              </div>
            </div>
          </div>
        )}

        {/* Attendance Warning */}
        {stats && pct < 75 && (
          <div className="edu-alert danger">
            ⚠️ Your attendance is below 75%. Please attend more classes to avoid academic penalties.
          </div>
        )}

        {/* Attendance History */}
        <div className="edu-card">
          <div className="edu-card-header">
            <span style={{ fontSize: 18 }}>📋</span>
            <div className="edu-card-title">Attendance History</div>
          </div>

          {records.length === 0 ? (
            <div className="edu-empty">
              <div style={{ fontSize: '1.8rem', marginBottom: 8 }}>📭</div>
              No attendance records found.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="edu-table">
                <thead>
                  <tr>
                    {['#', 'Subject', 'Date', 'Time', 'Method', 'Status'].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, i) => {
                    const dt = new Date(r.date);
                    return (
                      <tr key={i}>
                        <td style={{ color: '#9ca3af', fontWeight: 500 }}>{i + 1}</td>
                        <td style={{ fontWeight: 600, color: '#1e293b' }}>{r.subject_name}</td>
                        <td>{dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                        <td>{dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td>
                        <td>{r.method ?? '—'}</td>
                        <td>
                          <span className={`edu-pill ${r.status === 'present' ? 'present' : 'absent'}`}>
                            {r.status === 'present' ? 'Present' : 'Absent'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Notification Preferences */}
        <NotificationPanel studentId={Number(userId)} />

        {/* Privacy Controls */}
        <div className="edu-card" style={{ padding: '1.1rem 1.4rem' }}>
          <PrivacyControls studentId={Number(userId)} />
        </div>
      </div>
    </div>
  );
}
