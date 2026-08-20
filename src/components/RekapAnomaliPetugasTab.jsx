import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabaseData } from '../lib/supabase';
import { 
  Users, ChevronRight, ChevronDown, MapPin, AlertTriangle, 
  X, FileText, RefreshCw, CheckCircle2, UserCheck, Search, Loader2, Clock, Layers,
  User, Home, Package, Info, Filter, Briefcase
} from 'lucide-react';

export default function RekapAnomaliPetugasTab({ selectedModul = 'PERUMAHAN' }) {
  const [loading, setLoading] = useState(true);
  const [rekapData, setRekapData] = useState([]);
  const [rules, setRules] = useState([]);

  // Filter Indikator / Target Kolom
  const [selectedTargetColumn, setSelectedTargetColumn] = useState('ALL');

  // State Expand/Collapse Hirarki
  const [expandedKec, setExpandedKec] = useState({});
  const [expandedPml, setExpandedPml] = useState({});

  // State Modal 1: List KK / Individu (Lazy Fetching)
  const [selectedCellInfo, setSelectedCellInfo] = useState(null);
  const [cellTasks, setCellTasks] = useState([]);
  const [loadingCellTasks, setLoadingCellTasks] = useState(false);

  // State Modal 2: Detail Kuesioner Sampel
  const [selectedKkDetail, setSelectedKkDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Filter Pencarian di dalam Modal List Sampel
  const [modalSearch, setModalSearch] = useState('');

  // Function Merapikan Nama Rule (Menghapus teks penjelasan di dalam tanda kurung)
  const cleanRuleName = (name) => {
    if (!name) return '-';
    return name.replace(/\s*\([^)]*\)/g, '').trim();
  };

  // 1. FETCH DATA AGREGASI REKAP & ATURAN QC
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch Rules Configuration
      const { data: rulesData, error: rulesErr } = await supabaseData
        .from('rule_configurations')
        .select('rule_id, rule_name, target_column, rule_type, operator, modul_id')
        .eq('modul_id', selectedModul)
        .eq('is_active', true)
        .order('rule_id', { ascending: true });

      if (rulesErr) throw rulesErr;
      setRules(rulesData || []);

      // Fetch Ringkasan Rekap dari View Agregasi
      const { data: summary, error: summaryErr } = await supabaseData
        .from('view_pml_rekap_petugas')
        .select('*')
        .eq('modul_id', selectedModul);

      if (summaryErr) throw summaryErr;
      setRekapData(summary || []);

    } catch (err) {
      console.error("Gagal memuat rekap pml_tasks:", err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedModul]);

  useEffect(() => {
    fetchData();
    setSelectedTargetColumn('ALL'); // Reset filter saat modul berubah
  }, [fetchData, selectedModul]);

  // Daftar Unique Target Column untuk Dropdown Filter
  const uniqueTargetColumns = useMemo(() => {
    const cols = new Set();
    rules.forEach(r => {
      const label = r.target_column || r.rule_type;
      if (label) cols.add(label);
    });
    return Array.from(cols);
  }, [rules]);

  // Filter Rules yang Tampil di Header Tabel
  const activeRules = useMemo(() => {
    if (selectedTargetColumn === 'ALL') return rules;
    return rules.filter(r => (r.target_column || r.rule_type) === selectedTargetColumn);
  }, [rules, selectedTargetColumn]);

  // 2. OLAH DATA HIERARKI (Kecamatan -> PML -> PPL)
  const treeData = useMemo(() => {
    if (!rekapData.length || !activeRules.length) return [];

    const kecGroup = {};

    rekapData.forEach(item => {
      const kec = item.nama_kec || 'KECAMATAN LAIN';
      const kdkec = item.kdkec || '999';
      const pml = item.nama_pml || 'TANPA PML';
      const ppl = item.nama_ppl || 'TANPA PPL';
      const emailPpl = item.email_ppl || 'TANPA_EMAIL';

      if (!kecGroup[kec]) {
        kecGroup[kec] = { name: kec, kdkec: kdkec, pmlGroup: {}, totals: {}, pendingCount: 0, verifiedCount: 0 };
      }
      if (!kecGroup[kec].pmlGroup[pml]) {
        kecGroup[kec].pmlGroup[pml] = { name: pml, pplGroup: {}, totals: {}, pendingCount: 0, verifiedCount: 0 };
      }
      if (!kecGroup[kec].pmlGroup[pml].pplGroup[emailPpl]) {
        kecGroup[kec].pmlGroup[pml].pplGroup[emailPpl] = { name: ppl, emailPpl, totals: {}, pendingCount: 0, verifiedCount: 0 };
      }

      const pplObj = kecGroup[kec].pmlGroup[pml].pplGroup[emailPpl];
      const ruleId = item.rule_id;
      const pending = parseInt(item.pending_count || 0, 10);
      const verified = parseInt(item.verified_count || 0, 10);

      if (!pplObj.totals[ruleId]) {
        pplObj.totals[ruleId] = { pending: 0, verified: 0, total: 0 };
      }

      pplObj.totals[ruleId].pending += pending;
      pplObj.totals[ruleId].verified += verified;
      pplObj.totals[ruleId].total += (pending + verified);

      pplObj.pendingCount += pending;
      pplObj.verifiedCount += verified;
    });

    // Rollup Totals ke PML & Kecamatan
    Object.values(kecGroup).forEach(kecObj => {
      activeRules.forEach(r => { kecObj.totals[r.rule_id] = { pending: 0, verified: 0 }; });

      Object.values(kecObj.pmlGroup).forEach(pmlObj => {
        activeRules.forEach(r => { pmlObj.totals[r.rule_id] = { pending: 0, verified: 0 }; });

        Object.values(pmlObj.pplGroup).forEach(pplObj => {
          activeRules.forEach(r => {
            const t = pplObj.totals[r.rule_id] || { pending: 0, verified: 0 };
            pmlObj.totals[r.rule_id].pending += t.pending;
            pmlObj.totals[r.rule_id].verified += t.verified;
          });
          pmlObj.pendingCount += pplObj.pendingCount;
          pmlObj.verifiedCount += pplObj.verifiedCount;
        });

        activeRules.forEach(r => {
          kecObj.totals[r.rule_id].pending += pmlObj.totals[r.rule_id].pending;
          kecObj.totals[r.rule_id].verified += pmlObj.totals[r.rule_id].verified;
        });
        kecObj.pendingCount += pmlObj.pendingCount;
        kecObj.verifiedCount += pmlObj.verifiedCount;
      });
    });

    return Object.values(kecGroup).sort((a, b) => parseInt(a.kdkec, 10) - parseInt(b.kdkec, 10));
  }, [rekapData, activeRules]);

  // LAZY FETCH DETAIL TASK
  const handleCellClick = async (pplObj, rule) => {
    setSelectedCellInfo({ pplName: pplObj.name, rule });
    setCellTasks([]);
    setModalSearch('');
    setLoadingCellTasks(true);

    try {
      const { data, error } = await supabaseData
        .from('view_pml_tasks')
        .select('*')
        .eq('modul_id', selectedModul)
        .eq('rule_id', rule.rule_id)
        .eq('email_ppl', pplObj.emailPpl);

      if (error) throw error;
      setCellTasks(data || []);
    } catch (err) {
      alert("Gagal mengambil detail sampel: " + err.message);
    } finally {
      setLoadingCellTasks(false);
    }
  };

  // Grouping Modal List Sampel per SLS
  const slsGroupedTasks = useMemo(() => {
    if (!cellTasks.length) return [];

    const filtered = cellTasks.filter(task => 
      !modalSearch.trim() || 
      task.nama_kk?.toLowerCase().includes(modalSearch.toLowerCase()) ||
      String(task.no_bang)?.toLowerCase().includes(modalSearch.toLowerCase()) ||
      task.nama_sls?.toLowerCase().includes(modalSearch.toLowerCase()) ||
      String(task.idsubsls)?.toLowerCase().includes(modalSearch.toLowerCase())
    );

    const groups = {};
    filtered.forEach(task => {
      const slsKey = task.idsubsls || task.level_6_full_code || 'TANPA_SLS';
      const slsName = task.nama_sls || 'SLS / Sub-SLS Wilayah';

      if (!groups[slsKey]) {
        groups[slsKey] = { idsubsls: slsKey, nama_sls: slsName, items: [] };
      }
      groups[slsKey].items.push(task);
    });

    return Object.values(groups);
  }, [cellTasks, modalSearch]);

  // FETCH DETAIL KUESIONER SAMPEL (MODAL 2) - SUPPORT INDEX1 UNTUK INDIVIDU
  const handleFetchKkDetail = async (rawAssignmentId, itemIndex1) => {
    setLoadingDetail(true);
    let targetTable = 'assignments';
    let cleanId = rawAssignmentId;
    let cleanIndex = itemIndex1;

    if (selectedModul === 'INDIVIDU') {
      targetTable = 'assignments_individu';
      // Jika rawAssignmentId berupa gabungan string "ASSIGNID_INDEX1"
      if (rawAssignmentId && String(rawAssignmentId).includes('_')) {
        const parts = String(rawAssignmentId).split('_');
        cleanId = parts[0];
        if (!cleanIndex && parts[1]) cleanIndex = parts[1];
      }
    } else if (selectedModul === 'USAHA') {
      targetTable = 'assignments_usaha';
    }

    try {
      let query = supabaseData
        .from(targetTable)
        .select('*')
        .eq('assignment_id', cleanId);

      // Proteksi khusus modul INDIVIDU agar filter menggunakan index1
      if (selectedModul === 'INDIVIDU' && cleanIndex !== undefined && cleanIndex !== null) {
        query = query.eq('index1', cleanIndex);
      }

      const { data, error } = await query.limit(1).single();

      if (error) throw error;
      setSelectedKkDetail(data);
    } catch (err) {
      alert("Gagal memuat detail sampel: " + err.message);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Pengelompokan Data Kuesioner Sampel secara Dinamis
  const groupedKkDetail = useMemo(() => {
    if (!selectedKkDetail) return null;

    const identitasKeys = [
      'assignment_id', 'index1', 'nama_kk', 'nama_krt', 'nama_dtsen', 
      'nama_pemilik', 'nama_usaha', 'level_5_name', 'level_6_full_code', 
      'idsubsls', 'created_at', 'updated_at'
    ];

    const karakteristikKeys = [
      // Perumahan
      'no_bang', 'kode_bang_label', 'status_kepemilikan_label', 'luas_lantai', 
      'biaya_sewa', 'jns_dinding_label', 'jns_lantai_label', 'jns_atap_label', 
      'jns_closet_label', 'buang_tinja_label', 'air_minum_label', 
      'sumber_penerangan_label', 'jml_meteran',
      // Individu
      'hubungan_label', 'status_kawin_label', 'profesi_label', 
      'nilai_pend_pekerjaan', 'nilai_pend_lain', 'pend_usaha',
      // Usaha
      'kegiatan_usaha', 'omset_usaha', 'jumlah_tenaga_kerja'
    ];

    const asetKeys = [
      'jumlah_tabung3kg_new', 'jumlah_tabung5kg_new', 'jumlah_kulkas_new', 
      'jumlah_ac_new', 'jumlah_emas_new', 'jumlah_laptop_new', 
      'jumlah_motor_new', 'jumlah_mobil_new'
    ];

    const excludedKeys = ['anomali_flags', 'modul_id'];

    const identitas = [];
    const perumahan = [];
    const aset = [];
    const lainnya = [];

    identitasKeys.forEach(key => {
      if (key in selectedKkDetail) identitas.push([key, selectedKkDetail[key]]);
    });

    karakteristikKeys.forEach(key => {
      if (key in selectedKkDetail) perumahan.push([key, selectedKkDetail[key]]);
    });

    asetKeys.forEach(key => {
      if (key in selectedKkDetail) aset.push([key, selectedKkDetail[key]]);
    });

    Object.entries(selectedKkDetail).forEach(([key, value]) => {
      if (
        !identitasKeys.includes(key) &&
        !karakteristikKeys.includes(key) &&
        !asetKeys.includes(key) &&
        !excludedKeys.includes(key)
      ) {
        lainnya.push([key, value]);
      }
    });

    return { identitas, perumahan, aset, lainnya };
  }, [selectedKkDetail]);

  const formatKeyLabel = (key) => {
    return key
      .replace(/_label|_new/g, '')
      .replace(/_/g, ' ')
      .toUpperCase();
  };

  if (loading) {
    return (
      <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
        <RefreshCw className="w-8 h-8 text-cyan-600 animate-spin mx-auto" />
        <p className="text-xs font-bold text-slate-600">Memuat Rekapitulasi Petugas [{selectedModul}]...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER BAR & DROPDOWN FILTER KOLOM TARGET */}
      <div className="bg-white p-6 rounded-2xl shadow-2xs border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-600" />
            Rekapitulasi Pengecekan Per Petugas [{selectedModul}]
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Status: <span className="text-amber-600 font-bold">Pending (⏳)</span> / <span className="text-emerald-600 font-bold">Selesai (✅)</span>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Dropdown Filter Berdasarkan Target Kolom */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl flex-1 md:flex-initial">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={selectedTargetColumn}
              onChange={(e) => setSelectedTargetColumn(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none w-full md:w-60 cursor-pointer truncate"
            >
              <option value="ALL">-- Semua Indikator QC ({rules.length}) --</option>
              {uniqueTargetColumns.map(col => (
                <option key={col} value={col}>
                  Indikator: {col}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchData}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh Rekap
          </button>
        </div>
      </div>

      {/* TABEL HIERARKIS REKAP ANOMALI */}
      <div className="bg-white rounded-2xl shadow-2xs border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white font-bold text-[11px] tracking-wider uppercase">
                <th className="p-3.5 min-w-[280px] border-r border-slate-800">Wilayah / Petugas Pendata</th>
                {activeRules.map(rule => (
                  <th key={rule.rule_id} className="p-3.5 text-center min-w-[150px] border-r border-slate-800">
                    <div className="font-bold text-white text-xs leading-snug" title={rule.rule_name}>
                      {cleanRuleName(rule.rule_name)}
                    </div>
                    <span className="text-[9px] text-cyan-400 block font-semibold font-mono mt-1">
                      {rule.target_column || rule.rule_type}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-medium">
              {treeData.map(kec => {
                const isKecOpen = expandedKec[kec.name];

                return (
                  <React.Fragment key={kec.name}>
                    {/* LEVEL 1: KECAMATAN */}
                    <tr 
                      onClick={() => setExpandedKec(p => ({ ...p, [kec.name]: !p[kec.name] }))}
                      className="bg-cyan-50/70 hover:bg-cyan-100/80 cursor-pointer font-bold text-cyan-900 transition-colors"
                    >
                      <td className="p-3.5 flex items-center justify-between border-r border-cyan-200/60">
                        <div className="flex items-center gap-2">
                          {isKecOpen ? <ChevronDown className="w-4 h-4 text-cyan-600" /> : <ChevronRight className="w-4 h-4 text-cyan-600" />}
                          <MapPin className="w-4 h-4 text-cyan-600 shrink-0" />
                          <span>[{kec.kdkec}] KECAMATAN: {kec.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px]">
                          <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md">⏳ {kec.pendingCount}</span>
                          <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">✅ {kec.verifiedCount}</span>
                        </div>
                      </td>
                      {activeRules.map(rule => {
                        const stat = kec.totals[rule.rule_id] || { pending: 0, verified: 0 };
                        return (
                          <td key={rule.rule_id} className="p-3 text-center border-r border-cyan-200/60">
                            <span className="font-bold text-amber-600">{stat.pending}</span>
                            <span className="text-slate-400 mx-1">/</span>
                            <span className="font-bold text-emerald-600">{stat.verified}</span>
                          </td>
                        );
                      })}
                    </tr>

                    {/* LEVEL 2: PML (PENGAWAS) */}
                    {isKecOpen && Object.values(kec.pmlGroup).map(pml => {
                      const pmlKey = `${kec.name}_${pml.name}`;
                      const isPmlOpen = expandedPml[pmlKey];

                      return (
                        <React.Fragment key={pmlKey}>
                          <tr 
                            onClick={() => setExpandedPml(p => ({ ...p, [pmlKey]: !p[pmlKey] }))}
                            className="bg-amber-50/50 hover:bg-amber-100/60 cursor-pointer text-amber-950 font-bold transition-colors"
                          >
                            <td className="p-3 pl-8 flex items-center justify-between border-r border-amber-200/50">
                              <div className="flex items-center gap-2">
                                {isPmlOpen ? <ChevronDown className="w-3.5 h-3.5 text-amber-600" /> : <ChevronRight className="w-3.5 h-3.5 text-amber-600" />}
                                <UserCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                <span>PML: {pml.name}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px]">
                                <span className="bg-amber-200 text-amber-900 px-2 py-0.5 rounded-md">⏳ {pml.pendingCount}</span>
                                <span className="bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-md">✅ {pml.verifiedCount}</span>
                              </div>
                            </td>
                            {activeRules.map(rule => {
                              const stat = pml.totals[rule.rule_id] || { pending: 0, verified: 0 };
                              return (
                                <td key={rule.rule_id} className="p-3 text-center border-r border-amber-200/50">
                                  <span className="font-bold text-amber-700">{stat.pending}</span>
                                  <span className="text-amber-400 mx-1">/</span>
                                  <span className="font-bold text-emerald-700">{stat.verified}</span>
                                </td>
                              );
                            })}
                          </tr>

                          {/* LEVEL 3: PPL (PENDATA) */}
                          {isPmlOpen && Object.values(pml.pplGroup).map(ppl => (
                            <tr key={ppl.emailPpl} className="hover:bg-slate-50 transition-colors">
                              <td className="p-2.5 pl-14 font-semibold text-slate-700 flex items-center justify-between border-r border-slate-200">
                                <div className="flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                  <span>PPL: {ppl.name}</span>
                                </div>
                              </td>

                              {activeRules.map(rule => {
                                const stat = ppl.totals[rule.rule_id] || { total: 0, pending: 0, verified: 0 };

                                return (
                                  <td key={rule.rule_id} className="p-2 text-center border-r border-slate-200">
                                    {stat.total > 0 ? (
                                      <button
                                        onClick={() => handleCellClick(ppl, rule)}
                                        className="px-2.5 py-1 bg-white hover:bg-cyan-50 border border-slate-200 hover:border-cyan-400 rounded-lg font-bold text-xs transition-all cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                                      >
                                        {stat.pending > 0 && <span className="text-amber-600 font-black">⏳{stat.pending}</span>}
                                        {stat.pending > 0 && stat.verified > 0 && <span className="text-slate-300">|</span>}
                                        {stat.verified > 0 && <span className="text-emerald-600 font-black">✅{stat.verified}</span>}
                                      </button>
                                    ) : (
                                      <span className="text-slate-300 font-mono text-[11px]">-</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: LAZY FETCH LIST SAMPEL KK / INDIVIDU */}
      {selectedCellInfo && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150">
            {/* Header Modal 1 */}
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm text-cyan-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  Task: {cleanRuleName(selectedCellInfo.rule.rule_name)}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Pendata: <span className="text-white font-semibold">{selectedCellInfo.pplName}</span>
                </p>
              </div>
              <button 
                onClick={() => setSelectedCellInfo(null)}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Box Modal 1 */}
            <div className="p-3 bg-slate-100 border-b border-slate-200">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input 
                  type="text"
                  placeholder="Cari Nama, SLS, Kode SLS, atau No Bangunan..."
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>

            {/* List Sampel Modal 1 */}
            <div className="p-4 overflow-y-auto space-y-4 flex-1 bg-slate-50">
              {loadingCellTasks ? (
                <div className="p-12 text-center space-y-2">
                  <Loader2 className="w-7 h-7 animate-spin mx-auto text-cyan-600" />
                  <p className="text-xs font-bold text-slate-500">Memuat data sampel...</p>
                </div>
              ) : slsGroupedTasks.length === 0 ? (
                <p className="text-center text-xs text-slate-500 py-6">Data sampel tidak ditemukan.</p>
              ) : (
                slsGroupedTasks.map(slsGroup => (
                  <div key={slsGroup.idsubsls} className="space-y-2">
                    <div className="bg-cyan-100/70 border border-cyan-200 px-3 py-1.5 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Layers className="w-3.5 h-3.5 text-cyan-700" />
                        <span className="font-black text-xs text-cyan-950">{slsGroup.nama_sls}</span>
                        <span className="text-[10px] text-cyan-700 font-mono font-semibold">({slsGroup.idsubsls})</span>
                      </div>
                      <span className="text-[10px] bg-cyan-200 text-cyan-900 font-bold px-2 py-0.5 rounded-md">
                        {slsGroup.items.length} Sampel
                      </span>
                    </div>

                    <div className="space-y-2 pl-2">
                      {slsGroup.items.map(task => {
                        // KUNCI UTAMA: Penanganan Index1 untuk unik key React di Modul INDIVIDU
                        const artIndex = task.index1 ?? task.index_art;
                        const rowKey = (selectedModul === 'INDIVIDU' && artIndex !== undefined)
                          ? `${task.assignment_id}_${artIndex}`
                          : `${task.confirmation_id || task.assignment_id}`;

                        return (
                          <div 
                            key={rowKey}
                            onClick={() => handleFetchKkDetail(task.assignment_id, artIndex)}
                            className="bg-white p-3.5 rounded-xl border border-slate-200 hover:border-cyan-400 hover:shadow-md transition-all cursor-pointer flex justify-between items-center"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-slate-900">{task.nama_kk || 'NAMA TIDAK TERSEDIA'}</span>
                                {selectedModul === 'INDIVIDU' && artIndex !== undefined && (
                                  <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.5 rounded font-mono font-bold">
                                    Index: #{artIndex}
                                  </span>
                                )}
                                <span className="text-[10px] bg-cyan-50 text-cyan-700 border border-cyan-200 px-2 py-0.5 rounded-md font-mono font-bold">
                                  No. Bang: {task.no_bang || '-'}
                                </span>
                              </div>

                              <p className="text-[11px] text-slate-600">
                                {task.reason ? (
                                  <strong className="text-rose-600 font-semibold">{task.reason}</strong>
                                ) : (
                                  <>
                                    Isian Kolom ({task.target_column || 'Multi'}): <strong className="text-rose-600">{task.value_found || 'KOSONG'}</strong>
                                  </>
                                )}
                              </p>

                              {task.pml_notes && (
                                <p className="text-[10px] text-slate-600 bg-slate-50 p-1.5 rounded-lg border border-slate-100 italic">
                                  Catatan PML: "{task.pml_notes}"
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              {task.status_konfirmasi !== 'PENDING' ? (
                                <span className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 ${
                                  task.status_konfirmasi === 'APPROVED' || task.status_konfirmasi === 'SESUAI_LAPANGAN'
                                    ? 'bg-emerald-100 text-emerald-800' 
                                    : 'bg-cyan-100 text-cyan-800'
                                }`}>
                                  <CheckCircle2 className="w-3 h-3" />
                                  {task.status_konfirmasi}
                                </span>
                              ) : (
                                <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded-lg text-[10px] font-bold flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> PENDING
                                </span>
                              )}
                              <FileText className="w-4 h-4 text-cyan-600" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 bg-white border-t border-slate-200 text-right">
              <button 
                onClick={() => setSelectedCellInfo(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: DETAIL ISIAN KUESIONER SAMPEL */}
      {(loadingDetail || selectedKkDetail) && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150">
            {loadingDetail ? (
              <div className="p-12 text-center space-y-3">
                <Loader2 className="w-8 h-8 text-cyan-600 animate-spin mx-auto" />
                <p className="text-xs font-bold text-slate-600">Memuat Isian Sampel Modul [{selectedModul}]...</p>
              </div>
            ) : (
              <>
                <div className="p-4 bg-cyan-900 text-white flex justify-between items-center shrink-0">
                  <div>
                    <h3 className="font-bold text-sm text-cyan-300 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Detail Isian Kuesioner Sampel [{selectedModul}]
                    </h3>
                    <p className="text-[11px] text-cyan-100 mt-0.5">
                      Subjek: <span className="font-bold text-white">
                        {selectedKkDetail?.nama_kk || selectedKkDetail?.nama_dtsen || selectedKkDetail?.nama_krt || selectedKkDetail?.nama_pemilik || '-'}
                      </span>
                      {selectedModul === 'INDIVIDU' && selectedKkDetail?.index1 !== undefined && (
                        <span className="ml-2 bg-cyan-800 text-cyan-200 px-2 py-0.5 rounded font-mono text-[10px]">
                          Index ART: #{selectedKkDetail.index1}
                        </span>
                      )}
                    </p>
                  </div>
                  <button 
                    onClick={() => setSelectedKkDetail(null)}
                    className="p-1 hover:bg-cyan-800 rounded-lg text-cyan-200 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6 text-xs bg-slate-50 flex-1">
                  {groupedKkDetail && (
                    <>
                      {/* SECTION 1: IDENTITAS */}
                      {groupedKkDetail.identitas.length > 0 && (
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                          <h4 className="font-extrabold text-xs text-cyan-900 flex items-center gap-2 border-b border-slate-100 pb-2 uppercase tracking-wide">
                            <User className="w-4 h-4 text-cyan-600" />
                            Identitas & Wilayah
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {groupedKkDetail.identitas.map(([key, value]) => (
                              <div key={key} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                                <span className="text-[10px] text-slate-400 font-mono uppercase block truncate">
                                  {formatKeyLabel(key)}
                                </span>
                                <span className="font-bold text-slate-800 text-xs break-all">
                                  {String(value ?? '-')}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* SECTION 2: KARAKTERISTIK UTAMA */}
                      {groupedKkDetail.perumahan.length > 0 && (
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                          <h4 className="font-extrabold text-xs text-amber-900 flex items-center gap-2 border-b border-slate-100 pb-2 uppercase tracking-wide">
                            {selectedModul === 'INDIVIDU' ? (
                              <>
                                <User className="w-4 h-4 text-amber-600" />
                                Karakteristik Pekerjaan & Pendapatan Individu
                              </>
                            ) : selectedModul === 'USAHA' ? (
                              <>
                                <Briefcase className="w-4 h-4 text-amber-600" />
                                Karakteristik & Omset Kegiatan Usaha
                              </>
                            ) : (
                              <>
                                <Home className="w-4 h-4 text-amber-600" />
                                Karakteristik Bangunan & Sanitasi Perumahan
                              </>
                            )}
                          </h4>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {groupedKkDetail.perumahan.map(([key, value]) => (
                              <div key={key} className="bg-amber-50/30 p-2.5 rounded-lg border border-amber-200/50">
                                <span className="text-[10px] text-amber-700/70 font-mono uppercase block truncate">
                                  {formatKeyLabel(key)}
                                </span>
                                <span className="font-bold text-slate-800 text-xs break-words">
                                  {typeof value === 'number' ? value.toLocaleString('id-ID') : String(value ?? '-')}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* SECTION 3: ASET & FASILITAS */}
                      {groupedKkDetail.aset.length > 0 && (
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                          <h4 className="font-extrabold text-xs text-emerald-900 flex items-center gap-2 border-b border-slate-100 pb-2 uppercase tracking-wide">
                            <Package className="w-4 h-4 text-emerald-600" />
                            Kepemilikan Aset & Fasilitas
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            {groupedKkDetail.aset.map(([key, value]) => (
                              <div key={key} className="bg-emerald-50/30 p-2.5 rounded-lg border border-emerald-200/50">
                                <span className="text-[10px] text-emerald-700/70 font-mono uppercase block truncate">
                                  {formatKeyLabel(key)}
                                </span>
                                <span className="font-bold text-slate-800 text-xs">
                                  {String(value ?? '-')}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* SECTION 4: INFORMASI LAINNYA */}
                      {groupedKkDetail.lainnya.length > 0 && (
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                          <h4 className="font-extrabold text-xs text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-2 uppercase tracking-wide">
                            <Info className="w-4 h-4 text-slate-500" />
                            Informasi Tambahan Lainnya
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {groupedKkDetail.lainnya.map(([key, value]) => (
                              <div key={key} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                                <span className="text-[10px] text-slate-400 font-mono uppercase block truncate">
                                  {formatKeyLabel(key)}
                                </span>
                                <span className="font-bold text-slate-800 text-xs break-words">
                                  {String(value ?? '-')}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="p-3 bg-white border-t border-slate-200 text-right shrink-0">
                  <button 
                    onClick={() => setSelectedKkDetail(null)}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    Kembali
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}