import React, { useState, useEffect, useMemo } from 'react';
import { supabaseData } from '../lib/supabase';
import { 
  Users, ChevronRight, ChevronDown, MapPin, AlertTriangle, 
  X, FileText, RefreshCw, CheckCircle2, UserCheck, Search, Loader2, Clock, Layers,
  User, Home, Package, Info
} from 'lucide-react';

export default function RekapAnomaliPetugasTab() {
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [rules, setRules] = useState([]);

  // State Expand/Collapse Hirarki
  const [expandedKec, setExpandedKec] = useState({});
  const [expandedPml, setExpandedPml] = useState({});

  // State Modal List KK
  const [selectedCellInfo, setSelectedCellInfo] = useState(null); // { pplName, rule, taskList: [] }

  // State Modal Detail Perumahan KK (Lazy Fetch)
  const [selectedKkDetail, setSelectedKkDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Filter pencarian di dalam modal
  const [modalSearch, setModalSearch] = useState('');

  // 1. Fetch Data dari view_pml_tasks & rule_configurations
  const fetchData = async () => {
    setLoading(true);
    try {
      // Ambil daftar Aturan QC Aktif (Sertakan rule_type)
      const { data: rulesData } = await supabaseData
        .from('rule_configurations')
        .select('rule_id, rule_name, target_column, rule_type, operator')
        .eq('is_active', true)
        .order('rule_id', { ascending: true });
      setRules(rulesData || []);

      // Ambil Data Anomali dari View pml_tasks versi baru
      const { data: tasksData, error: tasksErr } = await supabaseData
        .from('view_pml_tasks')
        .select(`
          confirmation_id, assignment_id, rule_id, status_konfirmasi, reason, 
          pml_notes, rule_name, target_column, modul_id, rule_type, operator_qc,
          level_6_full_code, kdkec, kddesa, nama_kec, nama_desa, nama_pml, 
          nama_ppl, no_bang, nama_kk, value_found, idsubsls, nama_sls
        `);

      if (tasksErr) throw tasksErr;
      setTasks(tasksData || []);

    } catch (err) {
      console.error("Gagal memuat rekap pml_tasks:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 2. Olah Data Hirarki (Kecamatan -> PML -> PPL -> Total Pending & Verified per Rule)
  const treeData = useMemo(() => {
    if (!tasks.length || !rules.length) return [];

    const kecGroup = {};

    tasks.forEach(task => {
      const kec = task.nama_kec || 'KECAMATAN LAIN';
      // Mengambil kdkec dengan fallback aman jika null dari view
      const kdkec = task.kdkec || (task.level_6_full_code ? task.level_6_full_code.substring(2, 5) : '999');
      const pml = task.nama_pml || 'TANPA PML';
      const ppl = task.nama_ppl || 'TANPA PPL';

      if (!kecGroup[kec]) {
        kecGroup[kec] = { name: kec, kdkec: kdkec, pmlGroup: {}, totals: {}, pendingCount: 0, verifiedCount: 0 };
      }
      if (!kecGroup[kec].pmlGroup[pml]) {
        kecGroup[kec].pmlGroup[pml] = { name: pml, pplGroup: {}, totals: {}, pendingCount: 0, verifiedCount: 0 };
      }
      if (!kecGroup[kec].pmlGroup[pml].pplGroup[ppl]) {
        kecGroup[kec].pmlGroup[pml].pplGroup[ppl] = { name: ppl, tasks: [], totals: {}, pendingCount: 0, verifiedCount: 0 };
      }

      kecGroup[kec].pmlGroup[pml].pplGroup[ppl].tasks.push(task);
    });

    // Hitung Totals (Pending & Verified) per Level
    Object.values(kecGroup).forEach(kecObj => {
      rules.forEach(r => { kecObj.totals[r.rule_id] = { total: 0, pending: 0, verified: 0 }; });

      Object.values(kecObj.pmlGroup).forEach(pmlObj => {
        rules.forEach(r => { pmlObj.totals[r.rule_id] = { total: 0, pending: 0, verified: 0 }; });

        Object.values(pmlObj.pplGroup).forEach(pplObj => {
          rules.forEach(r => { pplObj.totals[r.rule_id] = { total: 0, pending: 0, verified: 0 }; });

          pplObj.tasks.forEach(task => {
            const ruleId = task.rule_id;
            const isPending = task.status_konfirmasi === 'PENDING';

            if (pplObj.totals[ruleId]) {
              pplObj.totals[ruleId].total += 1;
              if (isPending) {
                pplObj.totals[ruleId].pending += 1;
                pplObj.pendingCount += 1;
              } else {
                pplObj.totals[ruleId].verified += 1;
                pplObj.verifiedCount += 1;
              }
            }
          });

          // Akumulasi ke Level PML
          rules.forEach(r => {
            pmlObj.totals[r.rule_id].total += pplObj.totals[r.rule_id].total;
            pmlObj.totals[r.rule_id].pending += pplObj.totals[r.rule_id].pending;
            pmlObj.totals[r.rule_id].verified += pplObj.totals[r.rule_id].verified;
          });
          pmlObj.pendingCount += pplObj.pendingCount;
          pmlObj.verifiedCount += pplObj.verifiedCount;
        });

        // Akumulasi ke Level Kecamatan
        rules.forEach(r => {
          kecObj.totals[r.rule_id].total += pmlObj.totals[r.rule_id].total;
          kecObj.totals[r.rule_id].pending += pmlObj.totals[r.rule_id].pending;
          kecObj.totals[r.rule_id].verified += pmlObj.totals[r.rule_id].verified;
        });
        kecObj.pendingCount += pmlObj.pendingCount;
        kecObj.verifiedCount += pmlObj.verifiedCount;
      });
    });

    // Urutkan daftar kecamatan berdasarkan kdkec secara ascending
    return Object.values(kecGroup).sort((a, b) => {
      const codeA = parseInt(a.kdkec, 10);
      const codeB = parseInt(b.kdkec, 10);

      if (!isNaN(codeA) && !isNaN(codeB)) {
        return codeA - codeB;
      }
      return String(a.kdkec || '').localeCompare(String(b.kdkec || ''), undefined, { numeric: true });
    });
  }, [tasks, rules]);

  // Grouping TaskList per SLS di dalam Modal List KK
  const slsGroupedTasks = useMemo(() => {
    if (!selectedCellInfo?.taskList) return [];

    const filtered = selectedCellInfo.taskList.filter(task => 
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
        groups[slsKey] = {
          idsubsls: slsKey,
          nama_sls: slsName,
          items: []
        };
      }
      groups[slsKey].items.push(task);
    });

    Object.values(groups).forEach(group => {
      group.items.sort((a, b) => {
        const numA = parseInt(a.no_bang, 10);
        const numB = parseInt(b.no_bang, 10);
        if (!isNaN(numA) && !isNaN(numB)) {
          return numA - numB;
        }
        return String(a.no_bang || '').localeCompare(String(b.no_bang || ''), undefined, { numeric: true });
      });
    });

    return Object.values(groups);
  }, [selectedCellInfo, modalSearch]);

  // Format pengelompokan data detail perumahan untuk Modal 2
  const groupedKkDetail = useMemo(() => {
    if (!selectedKkDetail) return null;

    const identitasKeys = [
      'assignment_id', 'nama_kk', 'nama_krt', 'level_5_name', 
      'level_6_full_code', 'idsubsls', 'created_at', 'updated_at'
    ];

    const perumahanKeys = [
      'no_bang', 'kode_bang_label', 'status_kepemilikan_label', 'luas_lantai', 
      'biaya_sewa', 'jns_dinding_label', 'jns_lantai_label', 'jns_atap_label', 
      'jns_closet_label', 'buang_tinja_label', 'air_minum_label', 
      'sumber_penerangan_label', 'jml_meteran'
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
      if (key in selectedKkDetail) {
        identitas.push([key, selectedKkDetail[key]]);
      }
    });

    perumahanKeys.forEach(key => {
      if (key in selectedKkDetail) {
        perumahan.push([key, selectedKkDetail[key]]);
      }
    });

    asetKeys.forEach(key => {
      if (key in selectedKkDetail) {
        aset.push([key, selectedKkDetail[key]]);
      }
    });

    Object.entries(selectedKkDetail).forEach(([key, value]) => {
      if (
        !identitasKeys.includes(key) &&
        !perumahanKeys.includes(key) &&
        !asetKeys.includes(key) &&
        !excludedKeys.includes(key)
      ) {
        lainnya.push([key, value]);
      }
    });

    return { identitas, perumahan, aset, lainnya };
  }, [selectedKkDetail]);

  const toggleKec = (kecName) => {
    setExpandedKec(prev => ({ ...prev, [kecName]: !prev[kecName] }));
  };

  const togglePml = (pmlKey) => {
    setExpandedPml(prev => ({ ...prev, [pmlKey]: !prev[pmlKey] }));
  };

  const handleCellClick = (pplName, rule, pplTasks) => {
    const affectedTasks = pplTasks.filter(t => t.rule_id === rule.rule_id);
    if (affectedTasks.length === 0) return;

    setModalSearch('');
    setSelectedCellInfo({
      pplName,
      rule,
      taskList: affectedTasks
    });
  };

  const handleFetchKkDetail = async (assignmentId) => {
    setLoadingDetail(true);
    try {
      const { data, error } = await supabaseData
        .from('assignments')
        .select('*')
        .eq('assignment_id', assignmentId)
        .single();

      if (error) throw error;
      setSelectedKkDetail(data);
    } catch (err) {
      alert("Gagal memuat detail perumahan: " + err.message);
    } finally {
      setLoadingDetail(false);
    }
  };

  const formatKeyLabel = (key) => {
    return key
      .replace(/_label|_new/g, '')
      .replace(/_/g, ' ')
      .toUpperCase();
  };

  if (loading) {
    return (
      <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
        <RefreshCw className="w-8 h-8 text-sky-600 animate-spin mx-auto" />
        <p className="text-xs font-bold text-slate-600">Memuat Rekapitulasi Petugas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER BAR */}
      <div className="bg-white p-6 rounded-2xl shadow-2xs border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-sky-600" />
            Rekapitulasi Pengecekan Per Petugas (Kecamatan ➔ PML ➔ PPL)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Indikator: <span className="text-amber-600 font-bold">Pending (⏳)</span> / <span className="text-emerald-600 font-bold">Selesai (✅)</span>. Klik angka di sel untuk melihat rincian KK.
          </p>
        </div>

        <button
          onClick={fetchData}
          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Rekap
        </button>
      </div>

      {/* TABEL HIERARKIS REKAP ANOMALI */}
      <div className="bg-white rounded-2xl shadow-2xs border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white font-bold text-[11px] tracking-wider uppercase">
                <th className="p-3.5 min-w-[280px] border-r border-slate-800">Wilayah / Petugas Pendata</th>
                {rules.map(rule => (
                  <th key={rule.rule_id} className="p-3.5 text-center min-w-[140px] border-r border-slate-800">
                    <div className="truncate max-w-[150px]" title={rule.rule_name}>
                      {rule.rule_name}
                    </div>
                    {/* Display Fleksibel Target Column / Rule Type */}
                    <span className="text-[9px] text-sky-400 block font-normal font-mono mt-0.5">
                      {rule.target_column || (
                        rule.rule_type === 'AGGREGATION' ? '[AGREGASI NO. BANG]' :
                        rule.rule_type === 'CROSS_COLUMN' ? '[MULTI-KONDISI]' : '[LINTAS INDIKATOR]'
                      )}
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
                      onClick={() => toggleKec(kec.name)}
                      className="bg-sky-50/70 hover:bg-sky-100/80 cursor-pointer font-bold text-sky-900 transition-colors"
                    >
                      <td className="p-3.5 flex items-center justify-between border-r border-sky-200/60">
                        <div className="flex items-center gap-2">
                          {isKecOpen ? <ChevronDown className="w-4 h-4 text-sky-600" /> : <ChevronRight className="w-4 h-4 text-sky-600" />}
                          <MapPin className="w-4 h-4 text-sky-600 shrink-0" />
                          <span>[{kec.kdkec}] KECAMATAN: {kec.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px]">
                          <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md">⏳ {kec.pendingCount}</span>
                          <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">✅ {kec.verifiedCount}</span>
                        </div>
                      </td>
                      {rules.map(rule => {
                        const stat = kec.totals[rule.rule_id] || { pending: 0, verified: 0 };
                        return (
                          <td key={rule.rule_id} className="p-3 text-center border-r border-sky-200/60">
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
                            onClick={() => togglePml(pmlKey)}
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
                            {rules.map(rule => {
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
                            <tr key={ppl.name} className="hover:bg-slate-50 transition-colors">
                              <td className="p-2.5 pl-14 font-semibold text-slate-700 flex items-center justify-between border-r border-slate-200">
                                <div className="flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                  <span>PPL: {ppl.name}</span>
                                </div>
                                <span className="text-[10px] text-slate-400 font-normal">({ppl.tasks.length} Temuan)</span>
                              </td>

                              {rules.map(rule => {
                                const stat = ppl.totals[rule.rule_id] || { total: 0, pending: 0, verified: 0 };

                                return (
                                  <td key={rule.rule_id} className="p-2 text-center border-r border-slate-200">
                                    {stat.total > 0 ? (
                                      <button
                                        onClick={() => handleCellClick(ppl.name, rule, ppl.tasks)}
                                        className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg font-bold text-xs transition-all cursor-pointer inline-flex items-center gap-1 shadow-2xs"
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

      {/* MODAL 1: DAFTAR KK TERKENA ANOMALI */}
      {selectedCellInfo && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm text-sky-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  Task: {selectedCellInfo.rule.rule_name}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Pendata: <span className="text-white font-semibold">{selectedCellInfo.pplName}</span> | Total: {selectedCellInfo.taskList.length} Pengecekan
                </p>
              </div>
              <button 
                onClick={() => setSelectedCellInfo(null)}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-100 border-b border-slate-200">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input 
                  type="text"
                  placeholder="Cari Nama KK, SLS, Kode SLS, atau No Bangunan..."
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 flex-1 bg-slate-50">
              {slsGroupedTasks.length === 0 ? (
                <p className="text-center text-xs text-slate-500 py-6">Data tidak ditemukan.</p>
              ) : (
                slsGroupedTasks.map(slsGroup => (
                  <div key={slsGroup.idsubsls} className="space-y-2">
                    <div className="bg-sky-100/70 border border-sky-200 px-3 py-1.5 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Layers className="w-3.5 h-3.5 text-sky-700" />
                        <span className="font-black text-xs text-sky-950">{slsGroup.nama_sls}</span>
                        <span className="text-[10px] text-sky-700 font-mono font-semibold">({slsGroup.idsubsls})</span>
                      </div>
                      <span className="text-[10px] bg-sky-200 text-sky-900 font-bold px-2 py-0.5 rounded-md">
                        {slsGroup.items.length} KK
                      </span>
                    </div>

                    <div className="space-y-2 pl-2">
                      {slsGroup.items.map(task => (
                        <div 
                          key={task.confirmation_id || task.assignment_id}
                          onClick={() => handleFetchKkDetail(task.assignment_id)}
                          className="bg-white p-3.5 rounded-xl border border-slate-200 hover:border-sky-400 hover:shadow-md transition-all cursor-pointer flex justify-between items-center"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-slate-900">{task.nama_kk || 'NAMA TIDAK TERSEDIA'}</span>
                              <span className="text-[10px] bg-sky-50 text-sky-700 border border-sky-200 px-2 py-0.5 rounded-md font-mono font-bold">
                                No. Bang: {task.no_bang || '-'}
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-600 flex items-center gap-2">
                              <span>
                                {task.reason ? (
                                  <strong className="text-rose-600 font-semibold">{task.reason}</strong>
                                ) : (
                                  <>
                                    Isian Kolom ({task.target_column || 'Multi'}): <strong className="text-rose-600">{task.value_found || 'KOSONG'}</strong>
                                  </>
                                )}
                              </span>
                            </p>

                            {task.pml_notes && (
                              <p className="text-[10px] text-slate-600 bg-slate-50 p-1.5 rounded-lg border border-slate-100 italic">
                                Catatan PML: "{task.pml_notes}"
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-3">
                            {task.status_konfirmasi !== 'PENDING' ? (
                              <span className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 ${
                                task.status_konfirmasi === 'APPROVED' || task.status_konfirmasi === 'SESUAI_LAPANGAN'
                                  ? 'bg-emerald-100 text-emerald-800' 
                                  : 'bg-blue-100 text-blue-800'
                              }`}>
                                <CheckCircle2 className="w-3 h-3" />
                                {task.status_konfirmasi}
                              </span>
                            ) : (
                              <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded-lg text-[10px] font-bold flex items-center gap-1">
                                <Clock className="w-3 h-3" /> PENDING
                              </span>
                            )}
                            <FileText className="w-4 h-4 text-sky-600" />
                          </div>
                        </div>
                      ))}
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

      {/* MODAL 2: DETAIL PERUMAHAN LENGKAP */}
      {(loadingDetail || selectedKkDetail) && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150">
            {loadingDetail ? (
              <div className="p-12 text-center space-y-3">
                <Loader2 className="w-8 h-8 text-sky-600 animate-spin mx-auto" />
                <p className="text-xs font-bold text-slate-600">Memuat Isian Perumahan Keluarga...</p>
              </div>
            ) : (
              <>
                <div className="p-4 bg-sky-900 text-white flex justify-between items-center shrink-0">
                  <div>
                    <h3 className="font-bold text-sm text-sky-300 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Detail Isian Kuesioner Perumahan
                    </h3>
                    <p className="text-[11px] text-sky-100 mt-0.5">
                      KK: <span className="font-bold text-white">{selectedKkDetail?.nama_kk || selectedKkDetail?.nama_krt || '-'}</span>
                    </p>
                  </div>
                  <button 
                    onClick={() => setSelectedKkDetail(null)}
                    className="p-1 hover:bg-sky-800 rounded-lg text-sky-200 hover:text-white transition-colors cursor-pointer"
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
                          <h4 className="font-extrabold text-xs text-sky-900 flex items-center gap-2 border-b border-slate-100 pb-2 uppercase tracking-wide">
                            <User className="w-4 h-4 text-sky-600" />
                            Identitas KK & Wilayah
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

                      {/* SECTION 2: PERUMAHAN */}
                      {groupedKkDetail.perumahan.length > 0 && (
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                          <h4 className="font-extrabold text-xs text-amber-900 flex items-center gap-2 border-b border-slate-100 pb-2 uppercase tracking-wide">
                            <Home className="w-4 h-4 text-amber-600" />
                            Karakteristik Bangunan & Perumahan
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {groupedKkDetail.perumahan.map(([key, value]) => (
                              <div key={key} className="bg-amber-50/30 p-2.5 rounded-lg border border-amber-200/50">
                                <span className="text-[10px] text-amber-700/70 font-mono uppercase block truncate">
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

                      {/* SECTION 3: ASET */}
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

                      {/* SECTION 4: LAINNYA */}
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