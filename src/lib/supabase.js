import { createClient } from '@supabase/supabase-js';

// 1. Ambil Nilai Kredensial AUTH (Proyek Lama)
const supabaseUrlAuth = import.meta.env.VITE_SUPABASE_URL_AUTH;
const supabaseAnonKeyAuth = import.meta.env.VITE_SUPABASE_ANON_KEY_AUTH;

// 2. Ambil Nilai Kredensial DATA (Proyek Baru)
const supabaseUrlData = import.meta.env.VITE_SUPABASE_URL_DATA;
const supabaseAnonKeyData = import.meta.env.VITE_SUPABASE_ANON_KEY_DATA;

// Pengecekan Debugging
if (!supabaseUrlAuth || !supabaseAnonKeyAuth) {
  console.error("⚠️ Error: Kredensial SUPABASE AUTH belum terisi di .env!");
}
if (!supabaseUrlData || !supabaseAnonKeyData) {
  console.error("⚠️ Error: Kredensial SUPABASE DATA belum terisi di .env!");
}

// 3. Buat Dua Client Supabase Berbeda
export const supabaseAuth = createClient(supabaseUrlAuth, supabaseAnonKeyAuth);
export const supabaseData = createClient(supabaseUrlData, supabaseAnonKeyData);