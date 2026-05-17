import React from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Link,
  useLocation,
  useNavigate,
  Outlet,
} from 'react-router-dom';

import LandingPage from './pages/LandingPage';
import RoleLogin from './pages/RoleLogin';
import ProtectedRoute from './components/ProtectedRoute';
import StudentDashboard from './pages/StudentDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import AdminDashboard from './pages/AdminDashboard';
import ManualCheckin from './pages/ManualCheckin';
import KioskPage from './pages/KioskPage';
import AlertConfig from './pages/AlertConfig';
import ReportPage from './pages/ReportPage';
import FaceEnrollPage from './pages/FaceEnrollPage';

/* =========================
   Logout helper
========================= */
function doLogout(navigate: ReturnType<typeof useNavigate>) {
  localStorage.removeItem('token');
  localStorage.removeItem('role');
  localStorage.removeItem('user_id');
  localStorage.removeItem('user_name');
  navigate('/');
}

/* =========================
   Admin Navbar
========================= */
function AdminNavbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const userName = localStorage.getItem('user_name') || 'Admin';

  const link = (to: string, label: string) => (
    <Link
      to={to}
      style={{
        color: location.pathname === to ? '#fff' : '#bfdbfe',
        fontWeight: location.pathname === to ? 700 : 400,
        textDecoration: 'none',
        padding: '6px 10px',
        borderRadius: 6,
        background: location.pathname === to ? 'rgba(255,255,255,0.15)' : 'transparent',
        fontSize: 13,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </Link>
  );

  return (
    <nav style={{
      background: '#1e40af',
      padding: '0 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      height: 52,
      overflowX: 'auto',
    }}>
      <span style={{ fontWeight: 700, fontSize: 15, color: '#fff', marginRight: 10, whiteSpace: 'nowrap' }}>
        🛡️ Admin
      </span>
      {link('/admin', 'Dashboard')}
      {link('/reports', 'Reports')}
      {link('/alerts/config', 'Alerts')}
      {link('/face-enroll', 'Face Enroll')}
      <span style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={{ color: '#bfdbfe', fontSize: 13 }}>👤 {userName}</span>
        <button
          onClick={() => doLogout(navigate)}
          style={{
            background: '#fff',
            color: '#1e40af',
            border: 'none',
            padding: '5px 14px',
            borderRadius: 6,
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Logout
        </button>
      </span>
    </nav>
  );
}

/* =========================
   Teacher Navbar
========================= */
function TeacherNavbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const userName = localStorage.getItem('user_name') || 'Teacher';

  const link = (to: string, label: string) => (
    <Link
      to={to}
      style={{
        color: location.pathname === to ? '#fff' : '#a7f3d0',
        fontWeight: location.pathname === to ? 700 : 400,
        textDecoration: 'none',
        padding: '6px 10px',
        borderRadius: 6,
        background: location.pathname === to ? 'rgba(255,255,255,0.15)' : 'transparent',
        fontSize: 13,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </Link>
  );

  return (
    <nav style={{
      background: '#065f46',
      padding: '0 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      height: 52,
      overflowX: 'auto',
    }}>
      <span style={{ fontWeight: 700, fontSize: 15, color: '#fff', marginRight: 10, whiteSpace: 'nowrap' }}>
        👨‍🏫 Teacher
      </span>
      {link('/teacher', 'My Classes')}
      {link('/checkin/manual', 'Manual Check-in')}
      <span style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={{ color: '#a7f3d0', fontSize: 13 }}>👤 {userName}</span>
        <button
          onClick={() => doLogout(navigate)}
          style={{
            background: '#fff',
            color: '#065f46',
            border: 'none',
            padding: '5px 14px',
            borderRadius: 6,
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Logout
        </button>
      </span>
    </nav>
  );
}

/* =========================
   Student Navbar
========================= */
function StudentNavbar() {
  const navigate = useNavigate();
  const userName = localStorage.getItem('user_name') || 'Student';

  return (
    <nav style={{
      background: '#7c3aed',
      padding: '0 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      height: 52,
      overflowX: 'auto',
    }}>
      <span style={{ fontWeight: 700, fontSize: 15, color: '#fff', marginRight: 10, whiteSpace: 'nowrap' }}>
        🎓 Student
      </span>
      <span style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={{ color: '#ddd6fe', fontSize: 13 }}>👤 {userName}</span>
        <button
          onClick={() => doLogout(navigate)}
          style={{
            background: '#fff',
            color: '#7c3aed',
            border: 'none',
            padding: '5px 14px',
            borderRadius: 6,
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Logout
        </button>
      </span>
    </nav>
  );
}

/* =========================
   Layouts per role
========================= */
function AdminLayout() {
  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6' }}>
      <AdminNavbar />
      <main style={{ padding: 20 }}><Outlet /></main>
    </div>
  );
}

function TeacherLayout() {
  return (
    <div style={{ minHeight: '100vh', background: '#f0fdf4' }}>
      <TeacherNavbar />
      <main style={{ padding: 20 }}><Outlet /></main>
    </div>
  );
}

function StudentLayout() {
  return (
    <div style={{ minHeight: '100vh', background: '#faf5ff' }}>
      <StudentNavbar />
      <main style={{ padding: 20 }}><Outlet /></main>
    </div>
  );
}

/* =========================
   App
========================= */
function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Landing page — role selector */}
        <Route path="/" element={<LandingPage />} />

        {/* Role-specific login pages */}
        <Route path="/login/:role" element={<RoleLogin />} />

        {/* Legacy /login → redirect to landing */}
        <Route path="/login" element={<Navigate to="/" replace />} />

        {/* ── Kiosk — public, no login needed ── */}
        <Route path="/kiosk" element={<KioskPage />} />

        {/* ── Admin routes ── */}
        <Route element={
          <ProtectedRoute allowedRole="admin">
            <AdminLayout />
          </ProtectedRoute>
        }>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/reports" element={<ReportPage />} />
          <Route path="/alerts/config" element={<AlertConfig />} />
          <Route path="/face-enroll" element={<FaceEnrollPage />} />
        </Route>

        {/* ── Teacher routes ── */}
        <Route element={
          <ProtectedRoute allowedRole="teacher">
            <TeacherLayout />
          </ProtectedRoute>
        }>
          <Route path="/teacher" element={<TeacherDashboard />} />
          <Route path="/checkin/manual" element={<ManualCheckin />} />
        </Route>

        {/* ── Student routes ── */}
        <Route element={
          <ProtectedRoute allowedRole="student">
            <StudentLayout />
          </ProtectedRoute>
        }>
          <Route path="/student" element={<StudentDashboard />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
