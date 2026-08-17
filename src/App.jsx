import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

import Login from './pages/Login';
import PmlMonitoringPage from './pages/PmlMonitoringPage';
import AdminDashboardPage from './pages/AdminDashboardPage';

const ProtectedRoute = ({ children, allowedAccountTypes }) => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-xs font-bold text-slate-500">
        Memeriksa Sesi SIMALI QC...
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (allowedAccountTypes && profile && !allowedAccountTypes.includes(profile.tipe_akun)) {
    if (profile.tipe_akun === 'KANTOR') return <Navigate to="/admin" replace />;
    return <Navigate to="/pml" replace />;
  }

  return children;
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Halaman PML (Petugas Lapangan) */}
          <Route path="/pml" element={
            <ProtectedRoute allowedAccountTypes={['LAPANGAN']}>
              <PmlMonitoringPage />
            </ProtectedRoute>
          } />

          {/* Halaman Admin (Pegawai Kantor) */}
          <Route path="/admin" element={
            <ProtectedRoute allowedAccountTypes={['KANTOR']}>
              <AdminDashboardPage />
            </ProtectedRoute>
          } />

          {/* Default Route */}
          <Route path="/" element={<Navigate to="/pml" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}