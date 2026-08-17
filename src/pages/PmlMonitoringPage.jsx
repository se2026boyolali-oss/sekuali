import React, { useState, useEffect, useMemo } from 'react';
import { supabaseData } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { 
  Users, MapPin, AlertTriangle, CheckCircle2, 
  ArrowLeft, LogOut, Search,
  Check, X, Layers, Edit3, HelpCircle
} from 'lucide-react';

export default function PmlMonitoringPage() {
  const auth = useAuth();
  const profilUser = auth?.profile || auth?.user || auth?.profilUser || {};
  const logout = auth?.logout || (() => {});

  const [loading, setLoading] = useState(true);

  // Modul Active State
  const [selectedModul, setSelectedModul] = useState('PERUMAHAN');
  const [modulList, setModulList] = useState([]);

  // Navigation State
  const [daftarPcl, setDaftarPcl] = useState([]);
  const [selectedPcl, setSelectedPcl] = useState(null);
  const [daftarSls, setDaftarSls] = useState([]);
  const [selectedSls, setSelectedSls] = useState(null);
  const [rawTasks, setRawTasks] = useState([]);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Form Modal Verifikasi PML
  const [selectedGroupedTask, setSelectedGroupedTask] = useState(null);
  const [pmlNotes, setPmlNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 1. FETCH MASTER MODUL
  const fetchModul = async () => {
    try {
      const { data, error } = await supabaseData.from('master_modul_qc').select('*');
      if (error) throw error;
      setModulList(data || []);
    } catch (err) {
      console.error("Gagal memuat master modul:", err.message);
    }
  };

  useEffect(() => {
    fetchModul();
  }, []);

  // 2. AMBIL DAFTAR PCL DI BAWAH PENGAWASAN PML
  const loadDaftarPcl = async (pmlEmail) => {
    setLoading(true);
    try {
      const { data: pclData, error: pclErr } = await supabaseData
        .from('petugas')
        .select('email, nama_petugas, posisi_tugas, kecamatan_tugas')
        .eq('id_pml_atasan', pmlEmail);

      if (pclErr) throw pclErr;

      if (!pclData || pclData.length === 0) {
        setDaftarPcl([]);
        await loadTasksByKecamatan(profilUser?.kecamatan_tugas);
        return;
      }

      const pclEmails = pclData.map(p => p.email);

      const { data: slsData } = await supabaseData
        .from('muatan_sls')
        .select('idsubsls, petugas_id')
        .in('petugas_id', pclEmails);

      const { data: tasksData } = await supabaseData
        .from('view_pml_tasks')
        .select('confirmation_id, assignment_id, level_6_full_code, status_konfirmasi, modul_id')
        .eq('modul_id', selectedModul);

      const mappedPcl = pclData.map(pcl => {
        const slsOwns = slsData ? slsData.filter(s => s.petugas_id === pcl.email).map(s => String(s.idsubsls).trim()) : [];
        const tasksOwns = tasksData ? tasksData.filter(t => slsOwns.some(slsId => t.level_6_full_code?.startsWith(slsId))) : [];

        const totalAssignments = new Set(tasksOwns.map(t => t.assignment_id || t.level_6_full_code)).size;
        const pendingAssignmentIds = new Set(
          tasksOwns.filter(t => t.status_konfirmasi === 'PENDING').map(t => t.assignment_id || t.level_6_full_code)
        );

        const belumSelesai = pendingAssignmentIds.size;
        const sudahSelesai = totalAssignments - belumSelesai;

        return {
          ...pcl,
          totalAnomali: totalAssignments,
          belumSelesai,
          sudahSelesai,
          jumlahSls: slsOwns.length
        };
      });

      mappedPcl.sort((a, b) => b.belumSelesai - a.belumSelesai);
      setDaftarPcl(mappedPcl);

    } catch (err) {
      console.error("Gagal memuat data PCL:", err.message);
      await loadTasksByKecamatan(profilUser?.kecamatan_tugas);
    } finally {
      setLoading(false);
    }
  };

  // 3. AMBIL DAFTAR SLS TUGAS PCL
  const loadDaftarSls = async (pclEmail) => {
    setLoading(true);
    try {
      const { data: slsData, error: slsErr } = await supabaseData
        .from('muatan_sls')
        .select('idsubsls, nmsls, nmdesa, nmkec')
        .eq('petugas_id', pclEmail);

      if (slsErr) throw slsErr;

      if (!slsData || slsData.length === 0) {
        setDaftarSls([]);
        return;
      }

      const { data: tasksData } = await supabaseData
        .from('view_pml_tasks')
        .select('confirmation_id, assignment_id, level_6_full_code, status_konfirmasi')
        .eq('modul_id', selectedModul);

      const mappedSls = slsData.map(sls => {
        const slsIdStr = String(sls.idsubsls).trim();
        const tasksInSls = tasksData ? tasksData.filter(t => t.level_6_full_code?.startsWith(slsIdStr)) : [];

        const totalAssignments = new Set(tasksInSls.map(t => t.assignment_id || t.level_6_full_code)).size;
        const pendingAssignmentIds = new Set(
          tasksInSls.filter(t => t.status_konfirmasi === 'PENDING').map(t => t.assignment_id || t.level_6_full_code)
        );

        return {
          ...sls,
          totalAnomali: totalAssignments,
          belumSelesai: pendingAssignmentIds.size
        };
      });

      mappedSls.sort((a, b) => b.belumSelesai - a.belumSelesai);
      setDaftarSls(mappedSls);
    } catch (err) {
      console.error("Gagal memuat data SLS:", err.message);
    } finally {
      setLoading(false);
    }
  };

  // 4. FALLBACK KECAMATAN
  const loadTasksByKecamatan = async (namaKecamatan) => {
    setLoading(true);
    try {
      let query = supabaseData
        .from('view_pml_tasks')
        .select('*')
        .eq('modul_id', selectedModul);

      if (namaKecamatan) {
        query = query.ilike('level_5_name', `%${namaKecamatan}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      setRawTasks(data || []);
    } catch (err) {
      console.error("Gagal memuat tugas wilayah:", err.message);
    } finally {
      setLoading(false);
    }
  };

  // 5. DETAIL ANOMALI BERDASARKAN SLS
  const loadDetailAnomaliSls = async (slsObj) => {
    setSelectedSls(slsObj);
    setLoading(true);
    try {
      const slsPrefix = String(slsObj.idsubsls).trim();
      const { data, error } = await supabaseData
        .from('view_pml_tasks')
        .select('*')
        .eq('modul_id', selectedModul)
        .like('level_6_full_code', `${slsPrefix}%`);

      if (error) throw error;
      setRawTasks(data || []);
    } catch (err) {
      alert("Gagal memuat detail anomali: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const emailUser = profilUser?.email;

    if (emailUser) {
      if (selectedSls) {
        loadDetailAnomaliSls(selectedSls);
      } else if (selectedPcl) {
        loadDaftarSls(selectedPcl.email);
      } else {
        loadDaftarPcl(emailUser);
      }
    } else {
      loadTasksByKecamatan(null);
    }
  }, [selectedModul, profilUser?.email]);

  // LOGIKA 1: MENGELOMPOKKAN & MENGURUTKAN PER KK BERDASARKAN NO_BANG
  const groupedTasks = useMemo(() => {
    if (!rawTasks || rawTasks.length === 0) return [];

    const groups = {};

    rawTasks.forEach(task => {
      const groupKey = `${task.level_6_full_code}_${task.nama_kk || 'TANPA_NAMA'}`;

      if (!groups[groupKey]) {
        groups[groupKey] = {
          groupKey,
          level_6_full_code: task.level_6_full_code,
          nama_kk: task.nama_kk,
          no_bang: task.no_bang || '',
          level_5_name: task.level_5_name,
          anomalies: [],
          fieldValues: {} // Menyimpan nilai variabel per kolom (p_kolom / target_column)
        };
      }

      const colName = task.target_column || task.p_kolom || 'anomali_umum';
      const cellValue = task[colName] || task.value_found || task.reason || 'Perlu Konfirmasi';

      groups[groupKey].fieldValues[colName] = {
        value: cellValue,
        rule_name: task.rule_name,
        reason: task.reason
      };

      groups[groupKey].anomalies.push({
        confirmation_id: task.confirmation_id,
        rule_name: task.rule_name,
        reason: task.reason,
        status_konfirmasi: task.status_konfirmasi,
        pml_notes: task.pml_notes,
        colName
      });
    });

    let result = Object.values(groups);

    // Sort berdasarkan No Bangunan (Numerik/String)
    result.sort((a, b) => {
      const numA = parseInt(a.no_bang, 10);
      const numB = parseInt(b.no_bang, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return (a.no_bang || '').localeCompare(b.no_bang || '');
    });

    // Filter Search
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(g => 
        g.nama_kk?.toLowerCase().includes(term) ||
        g.no_bang?.toLowerCase().includes(term) ||
        g.level_6_full_code?.toLowerCase().includes(term) ||
        g.anomalies.some(a => a.rule_name?.toLowerCase().includes(term) || a.reason?.toLowerCase().includes(term))
      );
    }

    // Filter Status
    if (filterStatus !== 'ALL') {
      result = result.filter(g => {
        const isPending = g.anomalies.some(a => a.status_konfirmasi === 'PENDING');
        return filterStatus === 'PENDING' ? isPending : !isPending;
      });
    }

    return result;
  }, [rawTasks, searchTerm, filterStatus]);

  // LOGIKA 2: EKSTRAKSI DAFTAR KOLOM YANG MEMILIKI ANOMALI SECARA DINAMIS
  const dynamicColumns = useMemo(() => {
    if (!rawTasks || rawTasks.length === 0) return [];

    const colMap = new Map();

    rawTasks.forEach(task => {
      const colKey = task.target_column || task.p_kolom || 'anomali_umum';
      const colLabel = task.column_label || task.kategori || colKey.replace(/_/g, ' ').toUpperCase();

      if (!colMap.has(colKey)) {
        colMap.set(colKey, {
          key: colKey,
          label: colLabel
        });
      }
    });

    return Array.from(colMap.values());
  }, [rawTasks]);

  // HANDLER SIMPAN VERIFIKASI
  const handleSaveVerifikasiGroup = async (status) => {
    if (!selectedGroupedTask) return;
    if (!pmlNotes.trim()) return alert("Catatan/Alasan verifikasi wajib diisi!");

    setSubmitting(true);
    const confirmationIds = selectedGroupedTask.anomalies.map(a => a.confirmation_id);

    try {
      const { error } = await supabaseData
        .from('pml_confirmations')
        .update({
          status: status,
          pml_notes: pmlNotes.trim(),
          verified_at: new Date().toISOString()
        })
        .in('id', confirmationIds);

      if (error) throw error;

      setRawTasks(prev => prev.map(t => 
        confirmationIds.includes(t.confirmation_id)
          ? { ...t, status_konfirmasi: status, pml_notes: pmlNotes }
          : t
      ));

      setSelectedGroupedTask(null);
      setPmlNotes('');
      alert("✅ Verifikasi berhasil disimpan!");
    } catch (err) {
      alert("Gagal menyimpan verifikasi: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleKembali = () => {
    if (selectedSls) {
      setSelectedSls(null);
      setRawTasks([]);
    } else if (selectedPcl) {
      setSelectedPcl(null);
      setDaftarSls([]);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 antialiased pb-24 sm:pb-12">
      
      {/* HEADER NAVBAR */}
      <header className="bg-slate-900 text-white shadow-md sticky top-0 z-30">
        <div className="max-w mx-auto px-4 h-16 flex justify-between items-center">
          <div className="flex items-center gap-3">
            { (selectedPcl || selectedSls) && (
              <button 
                onClick={handleKembali}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold border border-slate-700 flex items-center justify-center transition-all cursor-pointer"
                title="Kembali"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <h1 className="font-black text-sm sm:text-base text-sky-400 tracking-wide flex items-center gap-2">
                <span>SITABUL</span>
                <span className="hidden sm:inline-block text-[10px] bg-sky-500/20 text-sky-300 font-mono font-bold px-2 py-0.5 rounded-md border border-sky-500/30">MONITORING PML</span>
              </h1>
              <p className="text-[11px] text-slate-400 font-medium truncate max-w-[200px] sm:max-w-xs">
                {profilUser?.nama_pengguna || profilUser?.email}
              </p>
            </div>
          </div>

          <button 
            onClick={logout}
            className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 shadow-xs"
          >
            <LogOut className="w-3.5 h-3.5" /> 
            <span className="hidden sm:inline">Keluar</span>
          </button>
        </div>
      </header>

      {/* BREADCRUMB & MODUL SELECTOR */}
      <div className="bg-white border-b border-slate-200 sticky top-16 z-20 shadow-2xs">
        <div className="max-w mx-auto px-4 py-2.5 flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 overflow-x-auto whitespace-nowrap py-1">
            <span className="text-sky-600 flex items-center gap-1 shrink-0">
              <Users className="w-3.5 h-3.5" /> Pengawasan
            </span>
            {selectedPcl && (
              <>
                <span className="text-slate-400">/</span>
                <span className="text-slate-800 shrink-0 bg-slate-100 px-2 py-0.5 rounded-md">PCL: {selectedPcl.nama_petugas}</span>
              </>
            )}
            {selectedSls && (
              <>
                <span className="text-slate-400">/</span>
                <span className="text-sky-600 font-extrabold shrink-0 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-md">SLS: {selectedSls.nmsls}</span>
              </>
            )}
          </div>

          <div className="hidden sm:flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            {modulList.map(mod => (
              <button
                key={mod.modul_id}
                onClick={() => setSelectedModul(mod.modul_id)}
                className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                  selectedModul === mod.modul_id 
                    ? 'bg-sky-600 text-white shadow-2xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {mod.nama_modul}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w mx-auto p-3 sm:p-6 space-y-6">
        {loading ? (
          <div className="text-center py-20 space-y-3">
            <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Memuat Data Sektor [{selectedModul}]...</p>
          </div>
        ) : (
          <>
            {/* LEVEL 1: DAFTAR PCL */}
            {!selectedPcl && daftarPcl.length > 0 && (
              <section className="space-y-4">
                <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-5 rounded-2xl flex justify-between items-center shadow-sm">
                  <div>
                    <span className="text-[10px] font-extrabold text-sky-400 uppercase tracking-widest block mb-1">Daftar Tim Lapangan</span>
                    <h2 className="text-sm sm:text-base font-black">Petugas Lapangan (PCL) Dampingan [{selectedModul}]</h2>
                    <p className="text-xs text-slate-300 mt-1">Pilih PCL untuk mengecek lokasi SLS yang memiliki potensi anomali.</p>
                  </div>
                  <Users className="w-10 h-10 text-sky-400 hidden sm:block opacity-80" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {daftarPcl.map(pcl => (
                    <div 
                      key={pcl.email}
                      onClick={() => { setSelectedPcl(pcl); loadDaftarSls(pcl.email); }}
                      className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover:border-sky-500 hover:shadow-md cursor-pointer transition-all space-y-4 group"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h3 className="font-bold text-slate-900 text-sm group-hover:text-sky-600 transition-colors flex items-center gap-1.5">
                            <span>🧑</span> {pcl.nama_petugas}
                          </h3>
                          <p className="text-[11px] font-mono text-slate-400 truncate">{pcl.email}</p>
                        </div>
                        <span className="bg-sky-100 text-sky-900 text-[10px] font-extrabold px-2.5 py-1 rounded-full border border-sky-200 shrink-0">
                          {pcl.jumlahSls} SLS
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center pt-3 border-t border-slate-100 text-[11px]">
                        <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                          <span className="text-[9px] font-bold text-slate-400 block uppercase">Total</span>
                          <span className="font-black text-slate-800">{pcl.totalAnomali}</span>
                        </div>
                        <div className="bg-emerald-50 p-2 rounded-xl border border-emerald-100">
                          <span className="text-[9px] font-bold text-emerald-600 block uppercase">Selesai</span>
                          <span className="font-black text-emerald-700">{pcl.sudahSelesai}</span>
                        </div>
                        <div className={`p-2 rounded-xl border ${pcl.belumSelesai > 0 ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-slate-50 text-slate-400'}`}>
                          <span className="text-[9px] font-bold block uppercase">Pending</span>
                          <span className="font-black">⚠️ {pcl.belumSelesai}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* LEVEL 2: DAFTAR SLS */}
            {selectedPcl && !selectedSls && (
              <section className="space-y-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 flex justify-between items-center shadow-2xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Lokasi Sensus PCL:</span>
                    <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-sky-600" />
                      {selectedPcl.nama_petugas}
                    </h2>
                  </div>
                  <button 
                    onClick={() => setSelectedPcl(null)}
                    className="text-xs font-bold text-sky-600 hover:text-sky-800 underline cursor-pointer"
                  >
                    Ganti PCL
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {daftarSls.map(sls => (
                    <div 
                      key={sls.idsubsls}
                      onClick={() => loadDetailAnomaliSls(sls)}
                      className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs hover:border-sky-500 hover:shadow-md cursor-pointer transition-all flex justify-between items-center gap-3"
                    >
                      <div className="space-y-1">
                        <h3 className="font-bold text-slate-900 text-xs sm:text-sm">{sls.nmsls}</h3>
                        <p className="text-[11px] text-slate-500">Desa {sls.nmdesa}, Kec. {sls.nmkec}</p>
                        <span className="text-[10px] font-mono font-bold text-slate-400 block">ID SLS: {sls.idsubsls}</span>
                      </div>

                      <div className="shrink-0">
                        {sls.belumSelesai > 0 ? (
                          <span className="bg-amber-100 text-amber-900 border border-amber-300 text-xs font-extrabold px-3 py-1.5 rounded-xl flex items-center gap-1 shadow-2xs">
                            ⚠️ {sls.belumSelesai} KK Pending
                          </span>
                        ) : (
                          <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-extrabold px-3 py-1.5 rounded-xl flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Clean
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* LEVEL 3: TABEL MATRIKS ANOMALI PER KK (ORDERED BY NO_BANG) */}
            {(selectedSls || (!selectedPcl && daftarPcl.length === 0)) && (
              <section className="space-y-5">
                
                {/* FILTER & TOOLBAR */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input 
                      type="text"
                      placeholder="Cari No Bangunan, Nama KK, atau Aturan QC..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-auto">
                    <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Filter Status:</span>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="p-2 border border-slate-300 rounded-xl text-xs font-bold bg-slate-50 focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="ALL">Semua ({groupedTasks.length} KK)</option>
                      <option value="PENDING">⏳ Belum Konfirmasi</option>
                      <option value="VERIFIED">✅ Sudah Konfirmasi</option>
                    </select>
                  </div>
                </div>

                {groupedTasks.length === 0 ? (
                  <div className="bg-emerald-50 border border-emerald-200 p-12 rounded-3xl text-center space-y-3">
                    <CheckCircle2 className="w-14 h-14 text-emerald-600 mx-auto" />
                    <h3 className="font-extrabold text-base text-emerald-900">Tidak Ada Anomali Ditemukan!</h3>
                    <p className="text-xs text-emerald-700 max-w-md mx-auto">
                      Seluruh data hasil sensus pada lokasi ini bersih dan tervalidasi.
                    </p>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    
                    {/* TABEL RESPONSIVE MATRIKS QC */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-900 text-slate-200 uppercase font-black tracking-wider text-[11px] border-b border-slate-800">
                            <th className="py-3.5 px-4 text-center w-12">No</th>
                            <th className="py-3.5 px-4 w-28 whitespace-nowrap">No. Bang</th>
                            <th className="py-3.5 px-4 min-w-[180px]">Nama KK</th>
                            
                            {/* DAFTAR KOLOM YANG MEMILIKI POTENSI ANOMALI DI SLS INI */}
                            {dynamicColumns.map(col => (
                              <th key={col.key} className="py-3.5 px-4 min-w-[160px] text-sky-300 bg-slate-800/80 border-l border-slate-700/50">
                                {col.label}
                              </th>
                            ))}

                            <th className="py-3.5 px-4 text-center min-w-[150px] sticky right-0 bg-slate-900 border-l border-slate-800 z-10">
                              Aksi Konfirmasi
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 font-medium text-slate-700">
                          {groupedTasks.map((group, idx) => {
                            const hasPending = group.anomalies.some(a => a.status_konfirmasi === 'PENDING');
                            const isVerified = !hasPending && group.anomalies.length > 0;

                            return (
                              <tr 
                                key={group.groupKey} 
                                className={`transition-colors hover:bg-sky-50/40 ${
                                  hasPending ? 'bg-amber-50/20' : 'bg-white'
                                }`}
                              >
                                {/* INDEX */}
                                <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-400">
                                  {idx + 1}
                                </td>

                                {/* NO BANGUNAN */}
                                <td className="py-3.5 px-4 font-mono font-black text-slate-900 whitespace-nowrap">
                                  <span className="bg-slate-100 text-slate-800 px-2 py-1 rounded-md border border-slate-200">
                                    #{group.no_bang || '-'}
                                  </span>
                                </td>

                                {/* NAMA KK & STATUS */}
                                <td className="py-3.5 px-4">
                                  <div className="font-bold text-slate-900">{group.nama_kk || 'Tanpa Nama KK'}</div>
                                  <div className="text-[10px] text-slate-400 font-mono">{group.level_6_full_code}</div>
                                </td>

                                {/* CELLS VARIABEL YANG PERLU DIKONFIRMASI */}
                                {dynamicColumns.map(col => {
                                  const cellData = group.fieldValues[col.key];

                                  return (
                                    <td key={col.key} className="py-3.5 px-4 border-l border-slate-100 align-top">
                                      {cellData ? (
                                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-2 space-y-1">
                                          <div className="font-black text-rose-900 text-xs flex items-center gap-1">
                                            <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                                            {cellData.value}
                                          </div>
                                          <div className="text-[10px] text-rose-700 leading-tight">
                                            {cellData.reason}
                                          </div>
                                        </div>
                                      ) : (
                                        // JIKA KK INI TIDAK MEMILIKI ANOMALI DI KOLOM INI -> BLANK / -
                                        <div className="text-center text-slate-300 font-bold py-1">-</div>
                                      )}
                                    </td>
                                  );
                                })}

                                {/* KOLOM AKSI KONFIRMASI (STICKY RIGHT) */}
                                <td className="py-3.5 px-4 text-center sticky right-0 bg-white shadow-l border-l border-slate-200 z-10 align-middle">
                                  {hasPending ? (
                                    <button
                                      onClick={() => {
                                        setSelectedGroupedTask(group);
                                        setPmlNotes(group.anomalies[0]?.pml_notes || '');
                                      }}
                                      className="w-full bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-[11px] px-3 py-2 rounded-xl transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" /> Konfirmasi
                                    </button>
                                  ) : isVerified ? (
                                    <div className="space-y-1">
                                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-300">
                                        <Check className="w-3 h-3" /> Tervalidasi
                                      </span>
                                      <button
                                        onClick={() => {
                                          setSelectedGroupedTask(group);
                                          setPmlNotes(group.anomalies[0]?.pml_notes || '');
                                        }}
                                        className="block text-[10px] font-bold text-slate-500 hover:text-sky-600 underline mx-auto cursor-pointer"
                                      >
                                        Edit Catatan
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-[10px] font-bold text-slate-400">Bersih</span>
                                  )}
                                </td>

                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="bg-slate-50 p-3 border-t border-slate-200 text-xs font-medium text-slate-500 flex justify-between items-center">
                      <span>Total Sampel KK: <strong>{groupedTasks.length}</strong></span>
                      <span className="text-[11px]">💡 Urutan berdasarkan No. Bangunan</span>
                    </div>

                  </div>
                )}

              </section>
            )}
          </>
        )}
      </main>

      {/* MOBILE STICKY BOTTOM NAVIGATION */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-2 z-30 flex justify-around items-center shadow-lg">
        {modulList.map(mod => (
          <button
            key={mod.modul_id}
            onClick={() => setSelectedModul(mod.modul_id)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-[10px] font-bold cursor-pointer transition-all ${
              selectedModul === mod.modul_id 
                ? 'text-sky-600 font-extrabold bg-sky-50' 
                : 'text-slate-500'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>{mod.nama_modul}</span>
          </button>
        ))}
      </div>

      {/* MODAL KONFIRMASI PML */}
      {selectedGroupedTask && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto border border-slate-200 shadow-2xl">
            
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold text-sky-600 uppercase tracking-wider block">Modal Konfirmasi PML</span>
                <h3 className="text-base font-black text-slate-900">{selectedGroupedTask.nama_kk || 'Tanpa Nama KK'} (No. Bang: #{selectedGroupedTask.no_bang || '-'})</h3>
              </div>
              <button 
                onClick={() => setSelectedGroupedTask(null)}
                className="p-1 text-slate-400 hover:text-slate-800 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* DAFTAR TEMUAN / RINGKASAN VARIABEL PERLU KONFIRMASI */}
            <div className="bg-slate-50 p-3 rounded-xl text-xs space-y-2 border border-slate-200">
              <span className="font-bold text-slate-700 block">Daftar Variabel Yang Di-flag ({selectedGroupedTask.anomalies.length}):</span>
              {selectedGroupedTask.anomalies.map((anom, idx) => (
                <div key={idx} className="bg-white p-2.5 rounded-lg border border-slate-200 text-[11px] space-y-0.5">
                  <div className="flex justify-between font-bold text-amber-900">
                    <span>📌 Variable: {anom.colName}</span>
                    <span className="text-rose-600">{anom.rule_name}</span>
                  </div>
                  <p className="text-slate-600 font-medium">{anom.reason}</p>
                </div>
              ))}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Catatan Hasil Konfirmasi PML <span className="text-rose-500">*</span>
              </label>
              <textarea 
                rows="3" 
                value={pmlNotes}
                onChange={(e) => setPmlNotes(e.target.value)}
                placeholder="Contoh: Sesuai kondisi lapangan (bambu lapis semen), atau Sudah dikoreksi di FASIH menjadi Kayu..."
                className="w-full p-3 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none font-medium"
              />
            </div>

            {/* OPSI KONFIRMASI LAPANGAN */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button 
                onClick={() => handleSaveVerifikasiGroup('APPROVED')}
                disabled={submitting}
                className="py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:bg-slate-300 transition-all shadow-xs flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" /> Sesuai Lapangan
              </button>
              <button 
                onClick={() => handleSaveVerifikasiGroup('RE-SURVEY')}
                disabled={submitting}
                className="py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:bg-slate-300 transition-all shadow-xs flex items-center justify-center gap-1.5"
              >
                <HelpCircle className="w-4 h-4" /> Sudah Perbaiki di FASIH
              </button>
            </div>

            <button 
              onClick={() => setSelectedGroupedTask(null)}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold cursor-pointer transition-all"
            >
              Batal
            </button>
          </div>
        </div>
      )}

    </div>
  );
}