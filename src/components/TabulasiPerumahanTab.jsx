import React, { useState, useEffect } from 'react';
import { supabaseData } from '../lib/supabase';
import { RefreshCw, ChevronRight, Home, BarChart2, X, Users, MapPin, Building, Search, AlertTriangle, Check, Sliders } from 'lucide-react';

export default function TabulasiPerumahanTab({ onRuleAdded }) {
  const [loading, setLoading] = useState(false);

  // Filter Wilayah Active (Breadcrumb Navigation)
  const [currentKec, setCurrentKec] = useState({ code: null, name: '' });
  const [currentDesa, setCurrentDesa] = useState({ code: null, name: '' });

  // Target Variabel
  const [kolomOptions, setKolomOptions] = useState([]);
  const [selectedKolom, setSelectedKolom] = useState('jns_dinding_label');

  // Active Rules State (Untuk mengecek aturan yang sudah ada)
  const [activeRules, setActiveRules] = useState([]);

  // Matrix Data State
  const [categories, setCategories] = useState([]);
  const [matrixData, setMatrixData] = useState([]);
  const [grandTotal, setGrandTotal] = useState(0);

  // State Modal Detail Sel KK
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalTitleInfo, setModalTitleInfo] = useState({ wilayah: '', kategori: '', count: 0 });
  const [detailList, setDetailList] = useState([]);
  const [searchFilter, setSearchFilter] = useState('');

  // State Modal Tambah Aturan QC Anomali (Dengan Support Operator)
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [savingRule, setSavingRule] = useState(false);
  const [ruleData, setRuleData] = useState({ 
    kolom: '', 
    labelKolom: '', 
    kategori: '', 
    operator: 'IN', 
    keterangan: '' 
  });
  const [toastMessage, setToastMessage] = useState(null);

  // HELPER FORMAT ANGKA RIBUAN INDONESIA
  const formatAngka = (val) => {
    if (val === null || val === undefined || val === '') return '-';
    const num = Number(val);
    if (isNaN(num)) return val;
    return num.toLocaleString('id-ID');
  };

  // HELPER FORMAT HEADER KATEGORI (MENDUKUNG ANGKA TUNGGAL ATAU RENTANG MISAL "100000 - 500000")
  const formatHeaderKategori = (catText) => {
    const text = String(catText || '').trim();

    // 1. Jika berupa angka murni (misal: "700000" -> "700.000")
    if (/^[0-9.]+$/.test(text)) {
      return formatAngka(text);
    }

    // 2. Jika berupa rentang (misal: "250000 - 500000" -> "250.000 - 500.000")
    if (/^[0-9.]+\s*-\s*[0-9.]+$/.test(text)) {
      const parts = text.split('-').map(p => p.trim());
      if (parts.length === 2) {
        return `${formatAngka(parts[0])} - ${formatAngka(parts[1])}`;
      }
    }

    // 3. Jika operator perbandingan (misal: ">= 50000" atau "> 50000")
    const matchOp = text.match(/^(>=|<=|>|<|=)\s*([0-9.]+)$/);
    if (matchOp) {
      return `${matchOp[1]} ${formatAngka(matchOp[2])}`;
    }

    // Default: kembalikan teks asli (misal: "Bambu", "Seng", dll)
    return text;
  };

  // HELPER DETEKSI OPERATOR DARI TEKS KATEGORI
  const detectOperatorAndValue = (catText) => {
    const text = String(catText || '').trim();

    if (/^[0-9.]+\s*-\s*[0-9.]+$/.test(text)) {
      return { operator: 'BETWEEN' };
    }
    if (/^>=\s*[0-9.]+$/.test(text)) {
      return { operator: '>=' };
    }
    if (/^>\s*[0-9.]+$/.test(text)) {
      return { operator: '>' };
    }
    if (/^<=\s*[0-9.]+$/.test(text)) {
      return { operator: '<=' };
    }
    if (/^<\s*[0-9.]+$/.test(text)) {
      return { operator: '<' };
    }
    if (/^=\s*[0-9.]+$/.test(text)) {
      return { operator: '=' };
    }
    return { operator: 'IN' };
  };

  // 1. Fetch Master Kolom
  const fetchMasterKolom = async () => {
    try {
      const { data, error } = await supabaseData
        .from('master_kolom_qc')
        .select('nama_kolom_db, label_tampilan, tipe_data')
        .eq('modul_id', 'PERUMAHAN')
        .eq('is_active', true);

      if (error) throw error;

      setKolomOptions(data || []);
      if (data && data.length > 0) {
        setSelectedKolom(data[0].nama_kolom_db);
      }
    } catch (err) {
      console.error("Gagal memuat master kolom:", err.message);
    }
  };

  // 2. Fetch Aturan QC Aktif untuk Kolom Terpilih
  const fetchActiveRules = async () => {
    try {
      const { data, error } = await supabaseData
        .from('rule_configurations')
        .select('*')
        .eq('modul_id', 'PERUMAHAN')
        .eq('is_active', true);

      if (error) throw error;
      setActiveRules(data || []);
    } catch (err) {
      console.error("Gagal memuat aturan aktif:", err.message);
    }
  };

  useEffect(() => {
    fetchMasterKolom();
    fetchActiveRules();
  }, []);

  // 3. Fetch Matrix Tabulasi
  const fetchMatrixTabulasi = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabaseData.rpc('get_tabulasi_matrix_perumahan', {
        p_kolom: selectedKolom,
        p_kdkec: currentKec.code,
        p_kddesa: currentDesa.code
      });

      if (error) throw error;

      const rawRows = data || [];

      const catSet = new Set();
      let totalAll = 0;

      rawRows.forEach(row => {
        totalAll += Number(row.total_rt || 0);
        if (row.breakdown && typeof row.breakdown === 'object') {
          Object.keys(row.breakdown).forEach(k => catSet.add(k));
        }
      });

      const uniqueCategories = Array.from(catSet).sort();
      setCategories(uniqueCategories);
      setMatrixData(rawRows);
      setGrandTotal(totalAll);

    } catch (err) {
      console.error("Gagal memuat matriks tabulasi:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedKolom) {
      fetchMatrixTabulasi();
    }
  }, [selectedKolom, currentKec.code, currentDesa.code]);

  // Fungsi Cek Apakah Kategori Sudah Ada di Aturan QC
  const isCategoryInRule = (category) => {
    return activeRules.some(rule => {
      if (rule.target_column !== selectedKolom) return false;
      if (Array.isArray(rule.trigger_values)) {
        return rule.trigger_values.includes(category);
      }
      return false;
    });
  };

  // Handle Klik Wilayah untuk Drill-down
  const handleWilayahClick = (row) => {
    if (row.level_wilayah === 'KECAMATAN') {
      setCurrentKec({ code: row.kode_wilayah, name: row.nama_wilayah });
    } else if (row.level_wilayah === 'DESA') {
      setCurrentDesa({ code: row.kode_wilayah, name: row.nama_wilayah });
    }
  };

  // Reset Navigasi Ke Level Kabupaten
  const resetToKabupaten = () => {
    setCurrentKec({ code: null, name: '' });
    setCurrentDesa({ code: null, name: '' });
  };

  // Hitung Total Per Kategori
  const calculateCategoryTotal = (category) => {
    return matrixData.reduce((acc, row) => {
      const count = Number((row.breakdown && row.breakdown[category]) || 0);
      return acc + count;
    }, 0);
  };

  // HANDLE KLIK CELL UNTUK MEMBUKA MODAL DETAIL KK
  const handleCellClick = async (row, category, count) => {
    if (count === 0) return;

    const activeKolomObj = kolomOptions.find(k => k.nama_kolom_db === selectedKolom);
    const labelKolom = activeKolomObj ? activeKolomObj.label_tampilan : selectedKolom;

    setModalTitleInfo({
      wilayah: row.nama_wilayah,
      kategori: `${labelKolom}: "${formatHeaderKategori(category)}"`,
      count: count
    });
    setSearchFilter('');
    setDetailList([]);
    setIsModalOpen(true);
    setModalLoading(true);

    try {
      const { data, error } = await supabaseData.rpc('get_detail_rt_tabulasi', {
        p_kolom: selectedKolom,
        p_kategori: category,
        p_kode_wilayah: row.kode_wilayah,
        p_level_wilayah: row.level_wilayah
      });

      if (error) throw error;
      setDetailList(data || []);
    } catch (err) {
      console.error("Gagal memuat detail daftar RT:", err.message);
    } finally {
      setModalLoading(false);
    }
  };

  // BUKA MODAL TAMBAH ATURAN ANOMALI (DENGAN DETEKSI OPERATOR)
  const handleOpenRuleModal = (e, category) => {
    e.stopPropagation();
    if (isCategoryInRule(category)) return;

    const activeKolomObj = kolomOptions.find(k => k.nama_kolom_db === selectedKolom);
    const labelKolom = activeKolomObj ? activeKolomObj.label_tampilan : selectedKolom;
    const { operator } = detectOperatorAndValue(category);

    setRuleData({
      kolom: selectedKolom,
      labelKolom: labelKolom,
      kategori: category,
      operator: operator,
      keterangan: `Perlu konfirmasi/pengecekan lapangan untuk indikator ${labelKolom} (${operator} ${category})`
    });
    setIsRuleModalOpen(true);
  };

  // SIMPAN ATURAN QC KE DATABASE
  const handleSaveRule = async (e) => {
    e.preventDefault();
    if (!ruleData.keterangan.trim()) return;

    setSavingRule(true);
    try {
      const { error } = await supabaseData.rpc('save_rule_qc', {
        p_kolom: ruleData.kolom,
        p_kategori: ruleData.kategori,
        p_keterangan: ruleData.keterangan,
        p_operator: ruleData.operator
      });

      if (error) throw error;

      setIsRuleModalOpen(false);
      showToast(`Aturan QC [${ruleData.operator}] "${formatHeaderKategori(ruleData.kategori)}" berhasil ditambahkan!`);
      
      await fetchActiveRules();
      if (onRuleAdded) {
        onRuleAdded();
      }

      await supabaseData.rpc('reevaluate_all_assignments');

    } catch (err) {
      console.error("Gagal menyimpan aturan QC:", err.message);
      alert("Gagal menyimpan aturan QC: " + err.message);
    } finally {
      setSavingRule(false);
    }
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const filteredDetailList = detailList.filter(item => 
    item.nama_kk?.toLowerCase().includes(searchFilter.toLowerCase()) ||
    item.no_bang?.toLowerCase().includes(searchFilter.toLowerCase()) ||
    item.level_5_name?.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="space-y-6 relative">
      
      {/* TOAST NOTIFIKASI */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-bold animate-in slide-in-from-top-4 duration-200">
          <Check className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* PANEL CONTROL / FILTER */}
      <section className="bg-white p-6 rounded-2xl shadow-2xs border border-slate-200 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-sky-600" /> Profil & Tabulasi Silang Wilayah
            </h2>
            <p className="text-xs text-slate-500">
              Klik ikon <span className="font-bold text-amber-600">+ Rule QC</span> di header tabel untuk menjadikan kategori tersebut sebagai Aturan Anomali.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-600 whitespace-nowrap">Indikator:</label>
            <select
              value={selectedKolom}
              onChange={(e) => setSelectedKolom(e.target.value)}
              disabled={loading}
              className="p-2 border border-slate-300 rounded-xl text-xs font-bold bg-slate-50 focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
            >
              {kolomOptions.map(col => (
                <option key={col.nama_kolom_db} value={col.nama_kolom_db}>
                  {col.label_tampilan}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* BREADCRUMB HIRARKI NAVIGASI */}
        <div className="flex items-center gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200 font-medium overflow-x-auto">
          <button
            onClick={resetToKabupaten}
            className={`flex items-center gap-1 font-bold shrink-0 ${!currentKec.code ? 'text-sky-600 font-extrabold' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <Home className="w-3.5 h-3.5" /> [3309] KAB. BOYOLALI
          </button>

          {currentKec.code && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <button
                onClick={() => setCurrentDesa({ code: null, name: '' })}
                className={`font-bold shrink-0 ${!currentDesa.code ? 'text-sky-600 font-extrabold' : 'text-slate-600 hover:text-slate-900'}`}
              >
                KEC. {currentKec.name}
              </button>
            </>
          )}

          {currentDesa.code && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="font-extrabold text-sky-600 shrink-0">DESA {currentDesa.name}</span>
            </>
          )}
        </div>
      </section>

      {/* TABEL MATRIKS TABULASI */}
      <section className="bg-white p-6 rounded-2xl shadow-2xs border border-slate-200 space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="text-xs text-slate-500">
            Agregasi Level: <span className="font-extrabold text-slate-800">
              {currentDesa.code ? 'SATUAN LINGKUNGAN (SLS)' : currentKec.code ? 'DESA / KELURAHAN' : 'KECAMATAN'}
            </span>
          </div>
          <div className="text-xs font-bold text-slate-700">
            Total Sampel Wilayah: <span className="text-sky-600 font-mono font-black">{grandTotal.toLocaleString('id-ID')} RT</span>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-slate-400 text-xs font-bold flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-sky-500" /> Memuat Agregasi Data Matriks...
          </div>
        ) : matrixData.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs italic">Data tidak ditemukan pada hirarki wilayah ini.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 uppercase text-[10px] font-black border-b border-slate-200">
                  <th className="p-3 border-r border-slate-200 sticky left-0 bg-slate-100 z-10 w-64">[Kode] Wilayah</th>
                  <th className="p-3 border-r border-slate-200 text-center w-24">Total RT</th>
                  
                  {categories.map((cat, idx) => {
                    const alreadyAdded = isCategoryInRule(cat);

                    return (
                      <th key={idx} className="p-3 border-r border-slate-200 min-w-[150px] group relative hover:bg-slate-200/70 transition-colors">
                        <div className="flex flex-col items-center justify-between gap-1.5 text-center h-full">
                          {/* 🔥 Memanggil formatHeaderKategori agar angka/rentang di header ikut bertitik ribuan */}
                          <span className="break-words line-clamp-2">{formatHeaderKategori(cat)}</span>
                          
                          {alreadyAdded ? (
                            <span 
                              className="mt-1 bg-slate-200 text-slate-500 text-[9px] font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1 cursor-not-allowed border border-slate-300"
                              title={`Kategori "${formatHeaderKategori(cat)}" sudah masuk dalam Aturan QC`}
                            >
                              <Check className="w-2.5 h-2.5 text-emerald-600" />
                              <span>Sudah Ada</span>
                            </span>
                          ) : (
                            <button
                              onClick={(e) => handleOpenRuleModal(e, cat)}
                              className="mt-1 opacity-70 group-hover:opacity-100 hover:scale-105 transition-all bg-amber-500 hover:bg-amber-600 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1 cursor-pointer shadow-xs"
                              title={`Jadikan "${formatHeaderKategori(cat)}" sebagai Aturan Anomali QC`}
                            >
                              <AlertTriangle className="w-2.5 h-2.5" />
                              <span>+ Rule QC</span>
                            </button>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {matrixData.map((row, rIdx) => {
                  const rowTotal = Number(row.total_rt || 0);

                  return (
                    <tr key={rIdx} className="hover:bg-sky-50/30 transition-colors">
                      <td className="p-3 border-r border-slate-200 sticky left-0 bg-white font-bold text-slate-900">
                        {row.level_wilayah !== 'SLS' ? (
                          <button
                            onClick={() => handleWilayahClick(row)}
                            className="text-sky-600 hover:text-sky-800 underline font-black text-left flex items-center justify-between w-full group cursor-pointer"
                          >
                            <span>{row.nama_wilayah}</span>
                            <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        ) : (
                          <span>{row.nama_wilayah}</span>
                        )}
                      </td>

                      <td className="p-3 border-r border-slate-200 text-center font-mono font-bold text-slate-800 bg-slate-50/50">
                        {rowTotal.toLocaleString('id-ID')}
                      </td>

                      {categories.map((cat, cIdx) => {
                        const count = Number((row.breakdown && row.breakdown[cat]) || 0);
                        const pct = rowTotal > 0 ? ((count / rowTotal) * 100).toFixed(1) : '0.0';

                        return (
                          <td 
                            key={cIdx} 
                            onClick={() => handleCellClick(row, cat, count)}
                            className={`p-2 border-r border-slate-100 align-middle transition-all ${
                              count > 0 
                                ? 'cursor-pointer hover:bg-sky-100/80 hover:shadow-inner' 
                                : 'opacity-40'
                            }`}
                            title={count > 0 ? `Klik untuk lihat ${count} daftar KK pada kategori "${formatHeaderKategori(cat)}"` : ''}
                          >
                            <div className="space-y-1">
                              <div className="flex justify-between items-center text-[11px]">
                                <span className={`font-mono font-bold ${count > 0 ? 'text-sky-700 underline' : 'text-slate-400'}`}>
                                  {count.toLocaleString('id-ID')}
                                </span>
                                <span className="text-[10px] font-bold text-slate-500">{pct}%</span>
                              </div>
                              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden flex">
                                <div
                                  className="bg-sky-500 h-full rounded-full transition-all duration-300"
                                  style={{ width: `${pct}%` }}
                                ></div>
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>

              <tfoot>
                <tr className="bg-slate-200 text-slate-900 font-extrabold text-xs border-t-2 border-slate-300">
                  <td className="p-3 border-r border-slate-300 sticky left-0 bg-slate-200 z-10 uppercase">
                    TOTAL KESELURUHAN
                  </td>
                  <td className="p-3 border-r border-slate-300 text-center font-mono font-black text-sky-700">
                    {grandTotal.toLocaleString('id-ID')}
                  </td>
                  {categories.map((cat, idx) => {
                    const catTotal = calculateCategoryTotal(cat);
                    const catPct = grandTotal > 0 ? ((catTotal / grandTotal) * 100).toFixed(1) : '0.0';

                    return (
                      <td key={idx} className="p-3 text-center border-r border-slate-300 font-mono">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="font-bold text-slate-900">{catTotal.toLocaleString('id-ID')}</span>
                          <span className="text-sky-700 font-black">{catPct}%</span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {/* MODAL DETAIL DAFTAR KK */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-slate-900 text-white p-4 flex justify-between items-start shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sky-400 font-bold text-xs">
                  <Users className="w-4 h-4" /> DAFTAR RUMAH TANGGA / KK
                </div>
                <h3 className="text-base font-black text-white">{modalTitleInfo.wilayah}</h3>
                <p className="text-xs text-slate-300 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700 inline-block font-medium">
                  {modalTitleInfo.kategori}
                </p>
              </div>

              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center gap-3 shrink-0">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input 
                  type="text"
                  placeholder="Cari Nama KK, No. Bangunan, atau RT/Dusun..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none font-medium"
                />
              </div>
              <div className="text-xs font-bold text-slate-600 whitespace-nowrap bg-white px-3 py-2 rounded-xl border border-slate-200">
                Total: <span className="text-sky-600 font-black">{filteredDetailList.length}</span> / {modalTitleInfo.count} RT
              </div>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              {modalLoading ? (
                <div className="py-16 text-center text-slate-400 text-xs font-bold flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-sky-500" /> Memuat Daftar Nama Kepala Keluarga...
                </div>
              ) : filteredDetailList.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs italic">
                  Tidak ada nama Kepala Keluarga yang sesuai dengan pencarian.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600 uppercase text-[10px] font-black border-b border-slate-200">
                        <th className="p-2.5 w-10 text-center">No</th>
                        <th className="p-2.5">Nama Kepala Keluarga (KK)</th>
                        <th className="p-2.5">No. Bangunan & Jenis</th>
                        <th className="p-2.5">Satuan SLS / Dusun</th>
                        <th className="p-2.5 text-center">Isi Indikator</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {filteredDetailList.map((item, idx) => (
                        <tr key={item.assignment_id || idx} className="hover:bg-sky-50/50 transition-colors">
                          <td className="p-2.5 text-center text-slate-400 font-mono">{idx + 1}</td>
                          <td className="p-2.5 font-bold text-slate-900 flex items-center gap-1.5">
                            <Building className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                            <span>{item.nama_kk}</span>
                          </td>
                          <td className="p-2.5 text-slate-600">
                            <span className="font-mono font-bold text-slate-800">#{item.no_bang}</span>
                            <span className="text-[11px] text-slate-400 block">{item.kode_bang_label}</span>
                          </td>
                          <td className="p-2.5 text-slate-600">
                            <span className="flex items-center gap-1 text-[11px]">
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                              {item.level_5_name}
                            </span>
                          </td>
                          <td className="p-2.5 text-center">
                            <span className="bg-sky-100 text-sky-900 text-[11px] font-extrabold px-2.5 py-1 rounded-lg border border-sky-200 inline-block font-mono">
                              {formatAngka(item.nilai_indikator)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-slate-50 p-3 border-t border-slate-200 flex justify-between items-center text-xs shrink-0">
              <p className="text-[11px] text-slate-400 italic">Klik di luar modal atau tombol X untuk menutup.</p>
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs cursor-pointer transition-colors"
              >
                Tutup Modal
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL PEMBUATAN ATURAN QC ANOMALI */}
      {isRuleModalOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onClick={() => setIsRuleModalOpen(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleSaveRule}>
              <div className="bg-amber-500 text-white p-4 flex justify-between items-center">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <AlertTriangle className="w-5 h-5 text-amber-100" />
                  <span>Tambah Aturan Anomali QC</span>
                </div>
                <button 
                  type="button"
                  onClick={() => setIsRuleModalOpen(false)}
                  className="p-1 text-amber-100 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs font-medium">
                
                {/* RINGKASAN VARIABEL */}
                <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200 space-y-2">
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase font-bold block">Indikator Target:</span>
                    <span className="font-bold text-slate-900 text-xs">{ruleData.labelKolom}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase font-bold block">Nilai Kategori Header:</span>
                    <span className="font-extrabold text-amber-900 text-xs bg-amber-100/80 px-2.5 py-1 rounded-lg border border-amber-300 inline-block font-mono mt-0.5">
                      "{formatHeaderKategori(ruleData.kategori)}"
                    </span>
                  </div>
                </div>

                {/* DROPDOWN OPERATOR QC */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-amber-600" /> Operator Perbandingan QC:
                  </label>
                  <select
                    value={ruleData.operator}
                    onChange={(e) => setRuleData({ ...ruleData, operator: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="IN">IN (Sesuai Salah Satu List Teks / String)</option>
                    <option value="BETWEEN">BETWEEN (Rentang / Custom Range Nilai)</option>
                    <option value="=">= (Sama Dengan Nilai Spesifik)</option>
                    <option value=">">&gt; (Lebih Dari)</option>
                    <option value=">=">&gt;= (Lebih Dari Sama Dengan)</option>
                    <option value="<">&lt; (Kurang Dari)</option>
                    <option value="<=">&lt;= (Kurang Dari Sama Dengan)</option>
                  </select>
                </div>

                {/* CATATAN / REASON */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 block">
                    Keterangan / Catatan Aturan Anomali:
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={ruleData.keterangan}
                    onChange={(e) => setRuleData({ ...ruleData, keterangan: e.target.value })}
                    placeholder="Masukkan alasan mengapa kondisi/kategori ini dikategorikan anomali..."
                    className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none text-slate-800 font-medium"
                  ></textarea>
                </div>
              </div>

              <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end gap-2 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setIsRuleModalOpen(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl cursor-pointer transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingRule}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl cursor-pointer transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {savingRule ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Menyimpan...
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" /> Simpan Aturan
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}