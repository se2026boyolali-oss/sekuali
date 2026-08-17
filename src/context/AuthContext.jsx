import { createContext, useContext, useEffect, useState } from 'react';
import { supabaseAuth, supabaseData } from '../lib/supabase';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isInitialLoad = true;

    supabaseAuth.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        fetchUserProfile(session.user.email);
      } else {
        setLoading(false);
      }
      isInitialLoad = false;
    });

    const { data: { subscription } } = supabaseAuth.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && isInitialLoad) {
        return;
      }

      if (session) {
        setUser(session.user);
        fetchUserProfile(session.user.email);
      } else {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (email) => {
    if (!email) {
      setLoading(false);
      return;
    }

    const cleanEmail = email.trim().toLowerCase();

    try {
      // 1. Cek Pegawai Kantor
      const { data: kantorUser, error: kantorErr } = await supabaseData
        .from('app_users')
        .select('email, nama_pengguna, role') 
        .eq('email', cleanEmail)
        .maybeSingle();

      if (kantorErr) console.error("Log error app_users:", kantorErr.message);

      if (kantorUser) {
        setProfile({
          ...kantorUser,
          role: kantorUser.role || 'admin',
          tipe_akun: 'KANTOR'
        });
        return; 
      }

      // 2. Cek Petugas Lapangan (Disesuaikan: kecamatan_tugas)
      const { data: lapanganUser, error: lapanganErr } = await supabaseData
        .from('petugas')
        .select('email, nama_petugas, posisi_tugas, kecamatan_tugas') // <-- SESUAI DDL TABEL
        .eq('email', cleanEmail)
        .maybeSingle();

      if (lapanganErr) console.error("Log error petugas:", lapanganErr.message);

      if (lapanganUser) {
        setProfile({
          email: lapanganUser.email,
          nama_pengguna: lapanganUser.nama_petugas, 
          role: lapanganUser.posisi_tugas || 'PML', 
          tipe_akun: 'LAPANGAN',
          kecamatan_tugas: lapanganUser.kecamatan_tugas || null // <-- Menggunakan kecamatan_tugas
        });
        return;
      }

      setProfile(null);
    } catch (err) {
      console.error("Gagal mendeteksi profil pengguna:", err.message);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    await supabaseAuth.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);