import React, { useState, useEffect } from 'react';
import { supabaseData } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import Papa from 'papaparse';
import QCRulesPerumahanTab from '../components/QCRulesPerumahanTab';
// 💡 PERUBAHAN: Import komponen generik (reusable)
import TabulasiMatrixTab from '../components/TabulasiMatrixTab';
import RekapAnomaliPetugasTab from '../components/RekapAnomaliPetugasTab';
import { 
  Settings, ShieldAlert, Upload, Users,
  Sliders, Database, LogOut, CheckCircle2, FileSpreadsheet, AlertCircle, BarChart2, Edit3, Trash2
} from 'lucide-react';

export default function AdminDashboardPage() {
  const { profile, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('TABULASI');
  const [selectedModul, setSelectedModul] = useState('PERUMAHAN'); 

  // Pengecekan Hak Akses Admin
  const isAdmin = profile?.role?.toLowerCase() === 'admin' || profile?.tipe_akun === 'KANTOR_ADMIN';

  // State Data Master
  const [modulList, setModulList] = useState([]);
  const [kolomList, setKolomList] = useState([]);

  // State Form Kolom Baru / Edit
  const [editingKolomId, setEditingKolomId] = useState(null);
  const [namaKolomDb, setNamaKolomDb] = useState('');
  const [labelTampilan, setLabelTampilan] = useState('');
  const [tipeDataKolom, setTipeDataKolom] = useState('STRING');
  const [rangeConfig, setRangeConfig] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State Import CSV
  const [csvFile, setCsvFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState(null);

  // Fetch Modul Sektor
  const fetchModul = async () => {
    const { data, error } = await supabaseData.from('master_modul_qc').select('*');
    if (error) console.error("Gagal ambil modul:", error.message);
    setModulList(data || []);
  };

  // Fetch Kolom DB Berdasarkan Modul
  const fetchKolom = async () => {
    const { data, error } = await supabaseData
      .from('master_kolom_qc')
      .select('*')
      .eq('modul_id', selectedModul)
      .order('kolom_id', { ascending: true });
    
    if (error) console.error("Gagal ambil master kolom:", error.message);
    setKolomList(data || []);
  };

  useEffect(() => {
    fetchModul();
  }, []);

  useEffect(() => {
    fetchKolom();
  }, [selectedModul]);

  // Handler Simpan / Update Kolom
  const handleSaveKolom = async (e) => {
    e.preventDefault();
    if (!namaKolomDb.trim() || !labelTampilan.trim()) return;

    setIsSubmitting(true);
    const payload = {
      modul_id: selectedModul,
      nama_kolom_db: namaKolomDb.trim(),
      label_tampilan: labelTampilan.trim(),
      tipe_data: tipeDataKolom,
      range_config: tipeDataKolom === 'NUMBER' ? rangeConfig.trim() : null,
      is_active: true
    };

    let error = null;
    if (editingKolomId) {
      const res = await supabaseData.from('master_kolom_qc').update(payload).eq('kolom_id', editingKolomId);
      error = res.error;
    } else {
      const res = await supabaseData.from('master_kolom_qc').insert([payload]);
      error = res.error;
    }

    if (error) {
      alert("Gagal menyimpan kolom: " + error.message);
    } else {
      resetKolomForm();
      fetchKolom();
    }
    setIsSubmitting(false);
  };

  const handleEditKolomClick = (col) => {
    setEditingKolomId(col.kolom_id);
    setNamaKolomDb(col.nama_kolom_db);
    setLabelTampilan(col.label_tampilan);
    setTipeDataKolom(col.tipe_data || 'STRING');
    setRangeConfig(col.range_config || '');
  };

  const resetKolomForm = () => {
    setEditingKolomId(null);
    setNamaKolomDb('');
    setLabelTampilan('');
    setTipeDataKolom('STRING');
    setRangeConfig('');
  };

  const handleToggleKolom = async (kolomId, currentStatus) => {
    await supabaseData
      .from('master_kolom_qc')
      .update({ is_active: !currentStatus })
      .eq('kolom_id', kolomId);
    fetchKolom();
  };

  const handleDeleteKolom = async (kolomId) => {
    if (!confirm("Hapus pengaturan kolom ini?")) return;
    await supabaseData.from('master_kolom_qc').delete().eq('kolom_id', kolomId);
    fetchKolom();
  };

  // Helper Pembersih Teks CSV (Contoh: "01. Leding" -> "Leding")
  const cleanValue = (val) => {
    if (typeof val === 'string') {
      let cleaned = val.trim();
      return cleaned.replace(/^\d+[\.\s\-]+\s*/, '').trim();
    }
    return val;
  };

  // =========================================================================
  // HANDLER PROCESS UPLOAD CSV (TERHUBUNG KE SEMUA MODUL: PERUMAHAN & INDIVIDU)
  // =========================================================================
  const handleProcessCsvUpload = (e) => {
    e.preventDefault();
    if (!csvFile) return alert("Silakan pilih file CSV terlebih dahulu!");

    setUploading(true);
    setUploadProgress(0);
    setUploadStatus(null);

    // 1. Tentukan Tabel Target & Unique Conflict Keys
    let targetTable = 'assignments';
    let conflictKeys = 'assignment_id';

    if (selectedModul === 'INDIVIDU') {
      targetTable = 'assignments_individu';
      conflictKeys = 'assignment_id, index1'; // Composite Key untuk Modul INDIVIDU
    } else if (selectedModul === 'USAHA') {
      targetTable = 'assignments_usaha';
      conflictKeys = 'assignment_id, no_usaha';
    }

    Papa.parse(csvFile, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: async (results) => {
        const rawRows = results.data;
        if (rawRows.length === 0) {
          setUploadStatus({ type: 'error', message: 'File CSV kosong / tidak valid.' });
          setUploading(false);
          return;
        }

        try {
          // 2. Pembersihan Data (Sanitasi)
          const cleanedRows = rawRows.map(row => {
            const processedRow = {};
            
            Object.keys(row).forEach(key => {
              const cleanKey = key.trim();
              if (cleanKey === 'assignment_id') {
                processedRow[cleanKey] = String(row[key] || '').trim();
              } else if (cleanKey === 'index1') {
                processedRow[cleanKey] = Number(row[key]) || 1; // Pastikan Angka/Integer
              } else {
                processedRow[cleanKey] = cleanValue(row[key]);
              }
            });

            return processedRow;
          });

          // 3. Batch Insert / Upsert (Per 100 Baris)
          const BATCH_SIZE = 100;
          const totalRows = cleanedRows.length;
          let insertedCount = 0;

          for (let i = 0; i < totalRows; i += BATCH_SIZE) {
            const batch = cleanedRows.slice(i, i + BATCH_SIZE);
            
            const { error } = await supabaseData.from(targetTable).upsert(batch, {
              onConflict: conflictKeys
            });

            if (error) throw error;

            insertedCount += batch.length;
            setUploadProgress(Math.round((insertedCount / totalRows) * 100));
          }

          // 4. Jalankan Re-Evaluasi QC Otomatis Pasca Upsert
          try {
            await supabaseData.rpc('reevaluate_all_assignments');
          } catch (evalErr) {
            console.warn("Re-evaluasi QC timeout / warning:", evalErr);
          }

          setUploadStatus({ 
            type: 'success', 
            message: `Berhasil mengimpor / mengupdate ${insertedCount} data pada tabel [${targetTable}]!` 
          });
          setCsvFile(null);
        } catch (err) {
          console.error("Error Import CSV:", err);
          setUploadStatus({ type: 'error', message: `Gagal menyimpan data: ${err.message}` });
        } finally {
          setUploading(false);
        }
      }
    });
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 pb-12 antialiased">
      {/* NAVBAR HEADER */}
      <header className="bg-slate-900 text-white p-4 shadow-md sticky top-0 z-20 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Settings className="w-6 h-6 text-sky-400" />
          <div>
            <h1 className="font-black text-base sm:text-lg tracking-wide text-sky-400">
              SIBULAK - {isAdmin ? 'PANEL ADMIN' : 'DASHBOARD MONITORS'}
            </h1>
            <p className="text-[10px] text-slate-400">
              {isAdmin ? 'Pengelolaan Sektor, Aturan QC & Import Data CSV' : 'Monitoring Tabulasi & Rekap Pengecekan Petugas'}
            </p>
          </div>
        </div>

        <button 
          onClick={logout}
          className="bg-slate-800 hover:bg-rose-600 p-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white transition-all cursor-pointer flex items-center gap-1"
        >
          <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Keluar</span>
        </button>
      </header>

      <main className="max-w mx-auto p-4 space-y-6 mt-2">
        {/* SELEKSI SEKTOR / MODUL */}
        <section className="bg-white p-4 rounded-2xl shadow-2xs border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Pilih Sektor / Modul QC Data</label>
            <div className="flex flex-wrap gap-2">
              {modulList.map(mod => (
                <button
                  key={mod.modul_id}
                  onClick={() => setSelectedModul(mod.modul_id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    selectedModul === mod.modul_id
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {mod.nama_modul}
                </button>
              ))}
            </div>
          </div>

          <div className="text-right hidden sm:block">
            <span className="text-[10px] font-mono text-slate-400 block">Modul Aktif:</span>
            <span className="text-xs font-black text-sky-600 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-200">
              {selectedModul}
            </span>
          </div>
        </section>

        {/* TAB NAVIGATION HIERARKI */}
        <div className="flex border-b border-slate-200 gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('TABULASI')}
            className={`py-2.5 px-4 font-bold text-xs rounded-t-xl transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'TABULASI' 
                ? 'bg-white text-sky-600 border-t-2 border-sky-600 shadow-2xs' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <BarChart2 className="w-4 h-4" /> Tabulasi Hasil Pendataan
          </button>

          <button
            onClick={() => setActiveTab('REKAP_PETUGAS')}
            className={`py-2.5 px-4 font-bold text-xs rounded-t-xl transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'REKAP_PETUGAS' 
                ? 'bg-white text-sky-600 border-t-2 border-sky-600 shadow-2xs' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" /> Rekap Pengecekan Petugas
          </button>

          {isAdmin && (
            <>
              <button
                onClick={() => setActiveTab('RULES')}
                className={`py-2.5 px-4 font-bold text-xs rounded-t-xl transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                  activeTab === 'RULES' 
                    ? 'bg-white text-sky-600 border-t-2 border-sky-600 shadow-2xs' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <ShieldAlert className="w-4 h-4" /> Aturan QC Pengecekan
              </button>

              <button
                onClick={() => setActiveTab('KOLOM')}
                className={`py-2.5 px-4 font-bold text-xs rounded-t-xl transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                  activeTab === 'KOLOM' 
                    ? 'bg-white text-sky-600 border-t-2 border-sky-600 shadow-2xs' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Sliders className="w-4 h-4" /> Pengaturan Kolom & Grouping Range
              </button>

              <button
                onClick={() => setActiveTab('IMPORT')}
                className={`py-2.5 px-4 font-bold text-xs rounded-t-xl transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                  activeTab === 'IMPORT' 
                    ? 'bg-white text-sky-600 border-t-2 border-sky-600 shadow-2xs' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Upload className="w-4 h-4" /> Import Data CSV
              </button>
            </>
          )}
        </div>

        {/* CONTENT VIEW TABULASI */}
        {/* 💡 PERUBAHAN: Masukkan props selectedModul */}
        {activeTab === 'TABULASI' && <TabulasiMatrixTab selectedModul={selectedModul} />}

        {/* CONTENT VIEW REKAP PETUGAS */}
        {/* 💡 PERUBAHAN: Masukkan props selectedModul */}
        {activeTab === 'REKAP_PETUGAS' && <RekapAnomaliPetugasTab selectedModul={selectedModul} />}

        {/* KONTEN TERKUNCI KHUSUS ADMIN */}
        {isAdmin && (
          <>
            {/* TAB RULES */}
            {activeTab === 'RULES' && (
              // 💡 PERUBAHAN: Tambahkan prop modul ke komponen Rules Perumahan
              selectedModul === 'PERUMAHAN' ? (
                <QCRulesPerumahanTab selectedModul={selectedModul} />
              ) : (
                <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-2">
                  <ShieldAlert className="w-10 h-10 text-slate-300 mx-auto" />
                  <h3 className="font-bold text-slate-700 text-sm">Modul [{selectedModul}] Dalam Pengembangan</h3>
                  <p className="text-xs text-slate-400">Komponen Aturan QC Cross-Column untuk sektor ini dapat dibuat terpisah nanti.</p>
                </div>
              )
            )}

            {/* TAB PENGATURAN KOLOM */}
            {activeTab === 'KOLOM' && (
              <div className="space-y-6">
                <section className="bg-white p-6 rounded-2xl shadow-2xs border border-slate-200 space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Database className="w-4 h-4 text-sky-600" /> 
                      {editingKolomId ? 'Edit Registrasi Kolom' : 'Registrasi Kolom DB & Setting Range Tabulasi'} [{selectedModul}]
                    </h2>
                    {editingKolomId && (
                      <button onClick={resetKolomForm} className="text-xs font-bold text-rose-600 hover:underline cursor-pointer">
                        Batal Edit
                      </button>
                    )}
                  </div>

                  <form onSubmit={handleSaveKolom} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Nama Kolom DB / CSV</label>
                      <input 
                        type="text" 
                        required 
                        placeholder="Contoh: biaya_sewa"
                        value={namaKolomDb}
                        onChange={(e) => setNamaKolomDb(e.target.value)}
                        className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-sky-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Label Tampilan UI</label>
                      <input 
                        type="text" 
                        required 
                        placeholder="Contoh: Biaya Sewa Bulanan"
                        value={labelTampilan}
                        onChange={(e) => setLabelTampilan(e.target.value)}
                        className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Tipe Data Target</label>
                      <select 
                        value={tipeDataKolom}
                        onChange={(e) => setTipeDataKolom(e.target.value)}
                        className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                      >
                        <option value="STRING">Teks / Kategori (STRING)</option>
                        <option value="NUMBER">Angka / Rentang (NUMBER)</option>
                        <option value="BOOLEAN">Ya / Tidak (BOOLEAN)</option>
                        <option value="GROUP">Grouping (Grup Khusus)</option>
                      </select>
                    </div>

                    {(tipeDataKolom === 'NUMBER' || tipeDataKolom === 'GROUP') && (
                      <div className="md:col-span-3 bg-amber-50/80 p-4 rounded-xl border border-amber-200 space-y-2">
                        <label className="block text-xs font-bold text-amber-900">
                          Pengelompokan Range Tabulasi (Khusus Tipe Data NUMBER atau GROUP)
                        </label>
                        <input 
                          type="text" 
                          placeholder="Contoh: 0-50000, 50001-500000, >500000"
                          value={rangeConfig}
                          onChange={(e) => setRangeConfig(e.target.value)}
                          className="w-full p-2.5 bg-white border border-amber-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                    )}

                    <div className="md:col-span-3 pt-1">
                      <button 
                        type="submit" 
                        disabled={isSubmitting}
                        className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer disabled:bg-slate-300 transition-all shadow-2xs"
                      >
                        {editingKolomId ? 'Update Pengaturan Kolom' : 'Registrasikan Kolom Baru'}
                      </button>
                    </div>
                  </form>
                </section>

                <section className="bg-white p-6 rounded-2xl shadow-2xs border border-slate-200 space-y-4">
                  <h2 className="text-sm font-bold text-slate-900">Daftar Kolom Terdaftar [{selectedModul}]</h2>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px]">
                        <tr>
                          <th className="p-3">Nama Kolom DB</th>
                          <th className="p-3">Label UI Dropdown</th>
                          <th className="p-3">Tipe Data</th>
                          <th className="p-3">Aturan Range Tabulasi</th>
                          <th className="p-3">Status</th>
                          <th className="p-3 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {kolomList.map(col => (
                          <tr key={col.kolom_id} className="hover:bg-slate-50">
                            <td className="p-3 font-mono text-slate-700">{col.nama_kolom_db}</td>
                            <td className="p-3 font-bold text-slate-900">{col.label_tampilan}</td>
                            <td className="p-3 text-slate-500">{col.tipe_data}</td>
                            <td className="p-3 font-mono text-[11px] text-amber-900">
                              {col.range_config || <span className="text-slate-300 italic">-</span>}
                            </td>
                            <td className="p-3">
                              <button
                                onClick={() => handleToggleKolom(col.kolom_id, col.is_active)}
                                className={`px-2.5 py-1 rounded-full text-[10px] font-black cursor-pointer ${
                                  col.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'
                                }`}
                              >
                                {col.is_active ? 'AKTIF' : 'NONAKTIF'}
                              </button>
                            </td>
                            <td className="p-3 text-right space-x-1">
                              <button 
                                onClick={() => handleEditKolomClick(col)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer inline-block"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleDeleteKolom(col.kolom_id)}
                                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer inline-block"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}

            {/* TAB IMPORT CSV */}
            {activeTab === 'IMPORT' && (
              <div className="space-y-6">
                <section className="bg-white p-6 rounded-2xl shadow-2xs border border-slate-200 space-y-4">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="w-8 h-8 text-sky-600" />
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">Import File CSV Data Hasil Sensus [{selectedModul}]</h2>
                      <p className="text-xs text-slate-500">
                        {selectedModul === 'INDIVIDU' 
                          ? 'Unggah CSV Bagian 1 atau Bagian 2 Individu. Data akan otomatis di-merge berdasarkan (assignment_id + index1).' 
                          : 'Unggah file CSV hasil pendataan. Data akan otomatis dievaluasi dengan aturan QC aktif.'}
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleProcessCsvUpload} className="space-y-4 pt-2">
                    <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center space-y-3 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                      <Upload className="w-10 h-10 text-slate-400 mx-auto" />
                      <div>
                        <label htmlFor="csv-file-input" className="cursor-pointer text-xs font-bold text-sky-600 hover:underline">
                          Pilih File CSV
                        </label>
                        <input 
                          id="csv-file-input"
                          type="file" 
                          accept=".csv"
                          onChange={(e) => setCsvFile(e.target.files[0])}
                          className="hidden"
                        />
                        <p className="text-[11px] text-slate-400 mt-1">
                          {csvFile ? `File terpilih: ${csvFile.name}` : 'Format yang didukung: .CSV'}
                        </p>
                      </div>
                    </div>

                    {uploading && (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-bold text-slate-600">
                          <span>Mengunggah Data...</span>
                          <span>{uploadProgress}%</span>
                        </div>
                        <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                          <div className="bg-sky-600 h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                        </div>
                      </div>
                    )}

                    {uploadStatus && (
                      <div className={`p-3.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
                        uploadStatus.type === 'success' 
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                          : 'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}>
                        {uploadStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
                        {uploadStatus.message}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={uploading || !csvFile}
                      className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:bg-slate-300 transition-all shadow-2xs"
                    >
                      {uploading ? 'Memproses Import...' : `Mulai Import CSV [Modul ${selectedModul}]`}
                    </button>
                  </form>
                </section>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}