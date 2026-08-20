import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabaseData } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { 
  RefreshCw, ChevronRight, Home, BarChart2, X, 
  Users, MapPin, Building, Search, AlertTriangle, 
  Check, Sliders, ExternalLink, UserCheck, ShieldCheck, User
} from 'lucide-react';

// MASTER DICTIONARY NOMOR URUT PATEN BERDASARKAN KUESIONER
const MASTER_KODE_MAP = {
  jns_lantai_label: {
    'marmer/granit': { no: 1, label: '1. Marmer/granit' },
    'keramik': { no: 2, label: '2. Keramik' },
    'parket/vinil/permadani': { no: 3, label: '3. Parket/vinil/karpet' },
    'ubin/tegel/teraso': { no: 4, label: '4. Ubin/tegel/teraso' },
    'ubin/tegel/traso': { no: 4, label: '4. Ubin/tegel/teraso' },
    'kayu/papan': { no: 5, label: '5. Kayu/papan' },
    'semen/bata merah': { no: 6, label: '6. Semen/bata merah' },
    'bambu': { no: 7, label: '7. Bambu' },
    'tanah': { no: 8, label: '8. Tanah' },
    'lainnya': { no: 9, label: '9. Lainnya' }
  },
  kondisi_lantai_label: {
    'baik': { no: 1, label: '1. Baik' },
    'rusak ringan': { no: 2, label: '2. Rusak Ringan' },
    'rusak sedang': { no: 3, label: '3. Rusak Sedang' },
    'rusak berat': { no: 4, label: '4. Rusak Berat' }
  },
  jns_dinding_label: {
    'tembok': { no: 1, label: '1. Tembok' },
    'plesteran anyaman bambu/kawat': { no: 2, label: '2. Plesteran anyaman bambu/kawat' },
    'kayu/papan/gipsum/grc/calciboard': { no: 3, label: '3. Kayu/papan/gipsum/GRC/calciboard' },
    'kayu/papan': { no: 3, label: '3. Kayu/papan/gipsum/GRC/calciboard' },
    'anyaman bambu': { no: 4, label: '4. Anyaman bambu' },
    'batang kayu': { no: 5, label: '5. Batang kayu' },
    'bambu': { no: 6, label: '6. Bambu' },
    'lainnya': { no: 7, label: '7. Lainnya' }
  },
  kondisi_dinding_label: {
    'baik': { no: 1, label: '1. Baik' },
    'rusak ringan': { no: 2, label: '2. Rusak Ringan' },
    'rusak sedang': { no: 3, label: '3. Rusak Sedang' },
    'rusak berat': { no: 4, label: '4. Rusak Berat' }
  },
  jns_atap_label: {
    'beton': { no: 1, label: '1. Beton' },
    'genteng': { no: 2, label: '2. Genteng' },
    'seng': { no: 3, label: '3. Seng' },
    'asbes': { no: 4, label: '4. Asbes' },
    'bambu': { no: 5, label: '5. Bambu' },
    'kayu/sirap': { no: 6, label: '6. Kayu/sirap' },
    'jerami/ijuk/daun daunan/rumbia': { no: 7, label: '7. Jerami/ijuk/daun-daunan/rumbia' },
    'ijuk/rumbia/daun': { no: 7, label: '7. Jerami/ijuk/daun-daunan/rumbia' },
    'lainnya': { no: 8, label: '8. Lainnya' }
  },
  kondisi_atap_label: {
    'baik': { no: 1, label: '1. Baik' },
    'rusak ringan': { no: 2, label: '2. Rusak Ringan' },
    'rusak sedang': { no: 3, label: '3. Rusak Sedang' },
    'rusak berat': { no: 4, label: '4. Rusak Berat' }
  },
  fasilitas_bab_label: {
    'ada, digunakan oleh anggota keluarga dalam satu rumah': { no: 1, label: '1. Ada, digunakan oleh anggota keluarga dalam satu rumah' },
    'ada, digunakan bersama oleh anggota keluarga dari beberapa rumah': { no: 2, label: '2. Ada, digunakan bersama oleh anggota keluarga dari beberapa rumah' },
    'ada, di mck komunal': { no: 3, label: '3. Ada, di MCK komunal' },
    'ada, di mck umum/siapapun menggunakan': { no: 4, label: '4. Ada, di MCK umum/siapapun menggunakan' },
    'ada, anggota keluarga tidak menggunakan': { no: 5, label: '5. Ada, anggota keluarga tidak menggunakan' },
    'tidak ada': { no: 6, label: '6. Tidak ada' }
  },
  jns_closet_label: {
    'leher angsa': { no: 1, label: '1. Leher angsa' },
    'plengsengan dengan tutup': { no: 2, label: '2. Plengsengan dengan tutup' },
    'plengsengan tanpa tutup': { no: 3, label: '3. Plengsengan tanpa tutup' },
    'plengsengan': { no: 2, label: '2. Plengsengan' },
    'cemplung/cubluk': { no: 4, label: '4. Cemplung/cubluk' }
  },
  buang_tinja_label: {
    'tangki septik': { no: 1, label: '1. Tangki septik' },
    'instalasi pengolahan air limbah (ipal)': { no: 2, label: '2. Instalasi Pengolahan Air Limbah (IPAL)' },
    'kolam/sawah/sungai/danau/laut': { no: 3, label: '3. Kolam/sawah/sungai/danau/laut' },
    'lubang tanah': { no: 4, label: '4. Lubang tanah' },
    'pantai/tanah lapang/kebun': { no: 5, label: '5. Pantai/tanah lapang/kebun' },
    'lainnya': { no: 6, label: '6. Lainnya' }
  },
  air_minum_label: {
    'air kemasan bermerk': { no: 1, label: '1. Air kemasan bermerek' },
    'air isi ulang': { no: 2, label: '2. Air isi ulang' },
    'leding': { no: 3, label: '3. Leding' },
    'sumur bor/pompa': { no: 4, label: '4. Sumur bor/pompa' },
    'sumur terlindung': { no: 5, label: '5. Sumur terlindung' },
    'sumur tak terlindung': { no: 6, label: '6. Sumur tak terlindung' },
    'mata air terlindung': { no: 7, label: '7. Mata air terlindung' },
    'mata air tak terlindung': { no: 8, label: '8. Mata air tak terlindung' },
    'air permukaan (sungai/danau/waduk/kolam/irigasi)': { no: 9, label: '9. Air permukaan (sungai/danau/waduk/kolam/irigasi)' },
    'air permukaan': { no: 9, label: '9. Air permukaan (sungai/danau/waduk/kolam/irigasi)' },
    'air hujan': { no: 10, label: '10. Air hujan' },
    'lainnya': { no: 11, label: '11. Lainnya' }
  },
  sumber_penerangan_label: {
    'listrik pln dengan meteran': { no: 1, label: '1. Listrik PLN dengan meteran' },
    'listrik pln tanpa meteran': { no: 2, label: '2. Listrik PLN tanpa meteran' },
    'listrik non-pln': { no: 3, label: '3. Listrik non-PLN' },
    'bukan listrik': { no: 4, label: '4. Bukan listrik' }
  }
};

const formatNumbersInString = (text) => {
  if (!text) return '';
  return String(text).replace(/\b\d+\b/g, (match) => {
    const num = Number(match);
    return isNaN(num) ? match : num.toLocaleString('id-ID');
  });
};

const getPatenCategoryInfo = (selectedKolom, catText) => {
  const rawText = String(catText || '').trim();
  const cleanKey = rawText.toLowerCase().replace(/^[0-9]+\.\s*/, '').trim();

  const kolomMap = MASTER_KODE_MAP[selectedKolom];
  if (kolomMap && kolomMap[cleanKey]) {
    return kolomMap[cleanKey];
  }

  const formattedRangeText = formatNumbersInString(rawText);
  const rangeMatch = rawText.match(/(\d+)/);
  if (rangeMatch) {
    return { no: parseInt(rangeMatch[1], 10), label: formattedRangeText };
  }

  return { no: 9999, label: formattedRangeText };
};

const sanitizeTextForCheck = (str) => {
  if (str === undefined || str === null) return '';
  return String(str)
    .toLowerCase()
    .replace(/^[0-9]+\.\s*/, '')
    .replace(/\s+/g, '')
    .trim();
};

export default function TabulasiMatrixTab({ selectedModul = 'PERUMAHAN', onRuleAdded }) {
  const { profile } = useAuth();
  const isAdmin = profile?.role?.toLowerCase() === 'admin' || profile?.tipe_akun === 'KANTOR_ADMIN';
  const [loading, setLoading] = useState(false);

  // Filter Wilayah
  const [currentKec, setCurrentKec] = useState({ code: null, name: '' });
  const [currentDesa, setCurrentDesa] = useState({ code: null, name: '' });

  // Options & Rules State
  const [kolomOptions, setKolomOptions] = useState([]);
  const [selectedKolom, setSelectedKolom] = useState('');
  const [activeRules, setActiveRules] = useState([]);

  // Matrix Data State
  const [categories, setCategories] = useState([]);
  const [matrixData, setMatrixData] = useState([]);
  const [grandTotal, setGrandTotal] = useState(0);

  // Modal Detail State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalTitleInfo, setModalTitleInfo] = useState({ 
    wilayah: '', 
    kategori: '', 
    count: 0,
    kecName: '',
    desaName: '',
    pmlName: '',
    pplName: ''
  });
  const [detailList, setDetailList] = useState([]);
  const [searchFilter, setSearchFilter] = useState('');

  // Modal Rule State
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

  const formatAngka = (val) => {
    if (val === null || val === undefined || val === '') return '-';
    const cleanStr = String(val).replace(/[^0-9.-]/g, '');
    const num = Number(cleanStr);
    if (isNaN(num)) return val;
    return `${num.toLocaleString('id-ID')}`;
  };

  const formatHeaderKategori = useCallback((catText) => {
    const info = getPatenCategoryInfo(selectedKolom, catText);
    return info.label;
  }, [selectedKolom]);

  const detectOperatorAndValue = (catText) => {
    const text = String(catText || '').trim();
    if (text.includes('-') || /\d+\s*s\/d\s*\d+/i.test(text)) return { operator: 'BETWEEN' };
    if (text.startsWith('>=') || text.includes('ke atas') || text.includes('lebih dari sama')) return { operator: '>=' };
    if (text.startsWith('>') || text.includes('lebih dari')) return { operator: '>' };
    if (text.startsWith('<=') || text.includes('ke bawah')) return { operator: '<=' };
    if (text.startsWith('<') || text.includes('kurang dari')) return { operator: '<' };
    if (text.startsWith('=')) return { operator: '=' };
    return { operator: 'IN' };
  };

  const fetchMasterKolom = useCallback(async () => {
    try {
      const { data, error } = await supabaseData
        .from('master_kolom_qc')
        .select('nama_kolom_db, label_tampilan, tipe_data')
        .eq('modul_id', selectedModul)
        .eq('is_active', true);

      if (error) throw error;

      setKolomOptions(data || []);
      if (data && data.length > 0) {
        setSelectedKolom(data[0].nama_kolom_db);
      } else {
        setSelectedKolom('');
      }
    } catch (err) {
      console.error("Gagal memuat master kolom:", err.message);
    }
  }, [selectedModul]);

  const fetchActiveRules = useCallback(async () => {
    try {
      const { data, error } = await supabaseData
        .from('rule_configurations')
        .select('*')
        .eq('modul_id', selectedModul)
        .eq('is_active', true);

      if (error) throw error;
      setActiveRules(data || []);
    } catch (err) {
      console.error("Gagal memuat aturan aktif:", err.message);
    }
  }, [selectedModul]);

  const resetToKabupaten = useCallback(() => {
    setCurrentKec({ code: null, name: '' });
    setCurrentDesa({ code: null, name: '' });
  }, []);

  useEffect(() => {
    resetToKabupaten();
    fetchMasterKolom();
    fetchActiveRules();
  }, [selectedModul, resetToKabupaten, fetchMasterKolom, fetchActiveRules]);

  const fetchMatrixTabulasi = useCallback(async () => {
    if (!selectedKolom) return;

    setLoading(true);
    try {
      const { data, error } = await supabaseData.rpc('get_tabulasi_matrix', {
        p_modul_id: selectedModul,
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

      const uniqueCategories = Array.from(catSet).sort((a, b) => {
        const infoA = getPatenCategoryInfo(selectedKolom, a);
        const infoB = getPatenCategoryInfo(selectedKolom, b);

        if (infoA.no !== infoB.no) {
          return infoA.no - infoB.no;
        }
        return String(a).localeCompare(String(b), 'id', { numeric: true });
      });

      setCategories(uniqueCategories);
      setMatrixData(rawRows);
      setGrandTotal(totalAll);

    } catch (err) {
      console.error("Gagal memuat matriks tabulasi:", err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedKolom, selectedModul, currentKec.code, currentDesa.code]);

  useEffect(() => {
    if (selectedKolom) {
      fetchMatrixTabulasi();
    }
  }, [selectedKolom, currentKec.code, currentDesa.code, fetchMatrixTabulasi]);

  const isCategoryInRule = useCallback((category) => {
    if (category === undefined || category === null) return false;

    const rawCat = String(category).trim().toLowerCase();
    const cleanCat = sanitizeTextForCheck(category);
    const patenInfo = getPatenCategoryInfo(selectedKolom, category);

    return activeRules.some(rule => {
      if (rule.target_column !== selectedKolom) return false;

      if (Array.isArray(rule.trigger_values) && rule.trigger_values.length > 0) {
        return rule.trigger_values.some(val => {
          if (val === undefined || val === null) return false;

          const rawVal = String(val).trim().toLowerCase();
          const cleanVal = sanitizeTextForCheck(val);

          if (rawCat === rawVal) return true;
          if (cleanCat !== '' && cleanVal !== '' && cleanCat === cleanVal) return true;

          const valAsNum = parseInt(rawVal.replace(/[^0-9]/g, ''), 10);
          if (!isNaN(valAsNum) && patenInfo.no !== 9999 && patenInfo.no === valAsNum) {
            return true;
          }

          return false;
        });
      }

      return false;
    });
  }, [selectedKolom, activeRules]);

  const handleWilayahClick = (row) => {
    // Membaca lvl_wil dan kode_wil dari return SQL terbaru
    const levelWil = row.lvl_wil || row.level_wilayah;
    const kodeWil = row.kode_wil || row.kode_wilayah;
    const namaWil = row.nama_wil || row.nama_wilayah;

    if (levelWil === 'KECAMATAN') {
      // Ambil kode kecamatan (3 digit angka jika formatnya '[010] KEC. BOYOLALI')
      const cleanCode = kodeWil.length > 3 ? kodeWil.slice(-3) : kodeWil;
      setCurrentKec({ code: cleanCode, name: namaWil });
    } else if (levelWil === 'DESA') {
      const cleanCode = kodeWil.length > 3 ? kodeWil.slice(-3) : kodeWil;
      setCurrentDesa({ code: cleanCode, name: namaWil });
    }
  };

  const calculateCategoryTotal = (category) => {
    return matrixData.reduce((acc, row) => {
      const count = Number((row.breakdown && row.breakdown[category]) || 0);
      return acc + count;
    }, 0);
  };

  const handleCellClick = useCallback(async (row, category, count) => {
    if (!count || count === 0 || !row) return;

    const safeCategory = typeof category === 'object' 
      ? String(category.label || category.no || '') 
      : String(category ?? '');

    const activeKolomObj = kolomOptions?.find(k => k.nama_kolom_db === selectedKolom);
    const labelKolom = activeKolomObj ? activeKolomObj.label_tampilan : selectedKolom;

    // AMBIL KODE WILAYAH DENGAN SAFE FALLBACK (karena dari fungsi matriks namanya kode_wil)
    const kodeWilayahFix = String(row.kode_wil || row.kode_wilayah || '');
    const levelWilayahFix = String(row.lvl_wil || row.level_wilayah || 'KECAMATAN');

    setModalTitleInfo({
      wilayah: row.nama_wil || row.nama_wilayah || 'Wilayah',
      kategori: `${labelKolom}: "${formatHeaderKategori(safeCategory)}"`,
      count: count,
      kecName: currentKec.name || (levelWilayahFix === 'KECAMATAN' ? (row.nama_wil || row.nama_wilayah) : ''),
      desaName: currentDesa.name || (levelWilayahFix === 'DESA' ? (row.nama_wil || row.nama_wilayah) : ''),
      pmlName: '',
      pplName: ''
    });
    
    setSearchFilter('');
    setDetailList([]);
    setIsModalOpen(true);
    setModalLoading(true);

    try {
      // Panggil RPC dengan SEMUA KEY TERDEFINISI (tidak ada undefined)
      const { data, error } = await supabaseData.rpc('get_detail_rt_tabulasi', {
        p_modul_id: selectedModul || 'PERUMAHAN',
        p_kolom: selectedKolom || '',
        p_kategori: safeCategory || '',
        p_kode_wilayah: kodeWilayahFix,
        p_level_wilayah: levelWilayahFix,
        p_kdkec: currentKec.code ? String(currentKec.code) : null
      });

      if (error) throw error;
      const resultList = data || [];
      setDetailList(resultList);

      // Ekstrak Nama PML & PPL secara otomatis
      if (resultList.length > 0) {
        const uniquePml = Array.from(new Set(resultList.map(i => i.nama_pml).filter(v => v && v !== '-')));
        const uniquePpl = Array.from(new Set(resultList.map(i => i.nama_ppl).filter(v => v && v !== '-')));

        setModalTitleInfo(prev => ({
          ...prev,
          pmlName: uniquePml.length === 1 ? uniquePml[0] : uniquePml.length > 1 ? `${uniquePml.length} PML Bertugas` : '-',
          pplName: uniquePpl.length === 1 ? uniquePpl[0] : uniquePpl.length > 1 ? `${uniquePpl.length} PPL Bertugas` : '-'
        }));
      }

    } catch (err) {
      console.error("Gagal memuat detail daftar RT:", err.message);
      alert("Gagal memuat detail data: " + err.message);
    } finally {
      setModalLoading(false);
    }
  }, [selectedKolom, selectedModul, currentKec.code, currentKec.name, currentDesa.name, kolomOptions, formatHeaderKategori]);

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

  const handleSaveRule = async (e) => {
    e.preventDefault();
    if (!ruleData.keterangan.trim()) return;

    setSavingRule(true);
    try {
      const { error } = await supabaseData.rpc('save_rule_qc', {
        p_kolom: ruleData.kolom,
        p_kategori: ruleData.kategori,
        p_keterangan: ruleData.keterangan,
        p_operator: ruleData.operator,
        p_modul_id: selectedModul
      });

      if (error) throw error;

      setIsRuleModalOpen(false);
      showToast(`Aturan QC [${ruleData.operator}] "${formatHeaderKategori(ruleData.kategori)}" berhasil ditambahkan!`);
      
      await fetchActiveRules();
      if (onRuleAdded) {
        onRuleAdded();
      }

      let targetTable = selectedModul === 'INDIVIDU' ? 'assignments_individu' : selectedModul === 'USAHA' ? 'assignments_usaha' : 'assignments';
      await supabaseData.rpc('reevaluate_all_assignments', {
        p_table_name: targetTable,
        p_modul_id: selectedModul
      });

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

  const filteredDetailList = useMemo(() => {
    if (!searchFilter.trim()) return detailList;
    const query = searchFilter.toLowerCase();
    return detailList.filter(item => 
      item.nama_kk?.toLowerCase().includes(query) ||
      item.no_bang?.toLowerCase().includes(query) ||
      item.level_5_name?.toLowerCase().includes(query) ||
      item.nama_pml?.toLowerCase().includes(query) ||
      item.nama_ppl?.toLowerCase().includes(query) ||
      item.nama_desa?.toLowerCase().includes(query)
    );
  }, [detailList, searchFilter]);

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
              <BarChart2 className="w-4 h-4 text-cyan-600" /> Profil & Tabulasi Silang Wilayah [{selectedModul}]
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
              className="p-2 border border-slate-300 rounded-xl text-xs font-bold bg-slate-50 focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
            >
              {kolomOptions.map(col => (
                <option key={col.nama_kolom_db} value={col.nama_kolom_db}>
                  {col.label_tampilan}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* BREADCRUMB NAVIGASI */}
        <div className="flex items-center gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200 font-medium overflow-x-auto">
          <button
            onClick={resetToKabupaten}
            className={`flex items-center gap-1 font-bold shrink-0 ${!currentKec.code ? 'text-cyan-600 font-extrabold' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <Home className="w-3.5 h-3.5" /> [3309] KAB. BOYOLALI
          </button>

          {currentKec.code && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <button
                onClick={() => setCurrentDesa({ code: null, name: '' })}
                className={`font-bold shrink-0 ${!currentDesa.code ? 'text-cyan-600 font-extrabold' : 'text-slate-600 hover:text-slate-900'}`}
              >
                KEC. {currentKec.name}
              </button>
            </>
          )}

          {currentDesa.code && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="font-extrabold text-cyan-600 shrink-0">DESA {currentDesa.name}</span>
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
            Total: <span className="text-cyan-600 font-mono font-black">{grandTotal.toLocaleString('id-ID')} {selectedModul === 'INDIVIDU' ? 'ART' : 'KK'}</span>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-slate-400 text-xs font-bold flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-cyan-500" /> Memuat Agregasi Data Matriks...
          </div>
        ) : matrixData.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs italic">Data tidak ditemukan pada hirarki wilayah ini.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 uppercase text-[10px] font-black border-b border-slate-200">
                  <th className="p-3 border-r border-slate-200 sticky left-0 bg-slate-100 z-10 w-64">[Kode] Wilayah</th>
                  <th className="p-3 border-r border-slate-200 text-center w-24">Total {selectedModul === 'INDIVIDU' ? 'ART' : 'KK'}</th>
                  
                  {categories.map((cat, idx) => {
                    const alreadyAdded = isCategoryInRule(cat);

                    return (
                      <th key={idx} className="p-3 border-r border-slate-200 min-w-[150px] group relative hover:bg-slate-200/70 transition-colors">
                        <div className="flex flex-col items-center justify-between gap-1.5 text-center h-full">
                          <span className="break-words line-clamp-2">{formatHeaderKategori(cat)}</span>
                          
                          {isAdmin && (
                            alreadyAdded ? (
                              <span 
                                className="mt-1 bg-slate-200 text-slate-500 text-[9px] font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1 cursor-not-allowed border border-slate-300"
                                title={`Kategori "${formatHeaderKategori(cat)}" sudah masuk dalam Aturan QC`}
                              >
                                <Check className="w-2.5 h-2.5 text-emerald-600" />
                                <span>Masuk Pengecekan</span>
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
                            )
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
                    <tr key={rIdx} className="hover:bg-cyan-50/30 transition-colors">
                      <td className="p-3 border-r border-slate-200 sticky left-0 bg-white font-bold text-slate-900">
                        {row.level_wilayah !== 'SLS' ? (
                          <button
                            onClick={() => handleWilayahClick(row)}
                            className="text-cyan-600 hover:text-cyan-800 underline font-black text-left flex items-center justify-between w-full group cursor-pointer"
                          >
                            <span>{row.nama_wil}</span>
                            <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        ) : (
                          <span>{row.nama_wil}</span>
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
                                ? 'cursor-pointer hover:bg-cyan-100/80 hover:shadow-inner' 
                                : 'opacity-40'
                            }`}
                            title={count > 0 ? `Klik untuk lihat ${count} daftar ${selectedModul === 'INDIVIDU' ? 'ART' : 'KK'} pada kategori "${formatHeaderKategori(cat)}"` : ''}
                          >
                            <div className="space-y-1">
                              <div className="flex justify-between items-center text-[11px]">
                                <span className={`font-mono font-bold ${count > 0 ? 'text-cyan-700 underline' : 'text-slate-400'}`}>
                                  {count.toLocaleString('id-ID')}
                                </span>
                                <span className="text-[10px] font-bold text-slate-500">{pct}%</span>
                              </div>
                              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden flex">
                                <div
                                  className="bg-cyan-500 h-full rounded-full transition-all duration-300"
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
                  <td className="p-3 border-r border-slate-300 text-center font-mono font-black text-cyan-700">
                    {grandTotal.toLocaleString('id-ID')}
                  </td>
                  {categories.map((cat, idx) => {
                    const catTotal = calculateCategoryTotal(cat);
                    const catPct = grandTotal > 0 ? ((catTotal / grandTotal) * 100).toFixed(1) : '0.0';

                    return (
                      <td key={idx} className="p-3 text-center border-r border-slate-300 font-mono">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="font-bold text-slate-900">{catTotal.toLocaleString('id-ID')}</span>
                          <span className="text-cyan-700 font-black">{catPct}%</span>
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

      {/* MODAL DETAIL DAFTAR KK / INDIVIDU */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* HEADER MODAL DENGAN INFORMASI LENGKAP */}
            <div className="bg-slate-900 text-white p-5 flex justify-between items-start shrink-0 space-y-2">
              <div className="space-y-2 w-full pr-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs uppercase tracking-wider">
                    <Users className="w-4 h-4" /> DAFTAR SAMPEL {selectedModul === 'INDIVIDU' ? 'INDIVIDU (ART)' : 'KK / RUMAH TANGGA'} [{selectedModul}]
                  </div>
                  <span className="bg-cyan-950 text-cyan-300 border border-cyan-800 text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full">
                    {modalTitleInfo.count} Records
                  </span>
                </div>

                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Building className="w-4 h-4 text-cyan-400" />
                  {modalTitleInfo.wilayah}
                </h3>

                {/* BADGES INFORMASI WILAYAH & PETUGAS */}
                <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                  <span className="bg-slate-800 text-slate-200 border border-slate-700 px-2.5 py-1 rounded-lg font-medium flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-cyan-400" />
                    KEC: <strong className="text-white">{modalTitleInfo.kecName || '-'}</strong>
                  </span>

                  {modalTitleInfo.desaName && (
                    <span className="bg-slate-800 text-slate-200 border border-slate-700 px-2.5 py-1 rounded-lg font-medium flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-emerald-400" />
                      DESA: <strong className="text-white">{modalTitleInfo.desaName}</strong>
                    </span>
                  )}

                  {modalTitleInfo.pmlName && (
                    <span className="bg-amber-950/80 text-amber-200 border border-amber-800 px-2.5 py-1 rounded-lg font-medium flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-amber-400" />
                      PML: <strong className="text-amber-100">{modalTitleInfo.pmlName}</strong>
                    </span>
                  )}

                  {modalTitleInfo.pplName && (
                    <span className="bg-cyan-950/80 text-cyan-200 border border-cyan-800 px-2.5 py-1 rounded-lg font-medium flex items-center gap-1">
                      <UserCheck className="w-3 h-3 text-cyan-400" />
                      PPL: <strong className="text-cyan-100">{modalTitleInfo.pplName}</strong>
                    </span>
                  )}
                </div>

                <div className="mt-1">
                  <span className="text-xs text-amber-300 bg-amber-950/60 px-3 py-1 rounded-lg border border-amber-800/80 inline-block font-semibold">
                    Kategori Terpilih: {modalTitleInfo.kategori}
                  </span>
                </div>
              </div>

              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* BAR PENCARIAN MODAL */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center gap-3 shrink-0">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input 
                  type="text"
                  placeholder="Cari Nama, Desa, PML, PPL, No. Bangunan, atau SLS..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-cyan-500 focus:outline-none font-medium"
                />
              </div>
              <div className="text-xs font-bold text-slate-600 whitespace-nowrap bg-white px-3 py-2 rounded-xl border border-slate-200">
                Menampilkan: <span className="text-cyan-600 font-black">{filteredDetailList.length}</span> / {modalTitleInfo.count} Data
              </div>
            </div>

            {/* TABEL HASIL SEARCH/LIST DETIL */}
            <div className="p-4 overflow-y-auto flex-1 bg-white">
              {modalLoading ? (
                <div className="py-16 text-center text-slate-400 text-xs font-bold flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-cyan-500" /> Memuat Detail Rincian Sampel...
                </div>
              ) : filteredDetailList.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs italic">
                  Tidak ada data yang sesuai dengan kriteria pencarian.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600 uppercase text-[10px] font-black border-b border-slate-200">
                        <th className="p-2.5 w-10 text-center">No</th>
                        <th className="p-2.5">
                          {selectedModul === 'INDIVIDU' ? 'Nama Anggota Keluarga (ART)' : 'Nama Kepala Keluarga (KK)'}
                        </th>
                        <th className="p-2.5">Wilayah & SLS</th>
                        <th className="p-2.5">Petugas Pendata (PPL / PML)</th>
                        <th className="p-2.5 text-center">No. Bangunan</th>
                        <th className="p-2.5 text-center">Isi Indikator</th>
                        <th className="p-2.5 text-center w-28">Aksi FASIH</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {filteredDetailList.map((item, idx) => {
                        // KUNCI UTAMA: Gabungkan assignment_id dan index1 (atau index_art) agar key React 100% Unik per individu
                        const artIndex = item.index1 ?? item.index_art;
                        const rowKey = artIndex !== undefined 
                          ? `${item.assignment_id}_${artIndex}` 
                          : `${item.assignment_id || idx}`;

                        return (
                          <tr key={rowKey} className="hover:bg-cyan-50/50 transition-colors">
                            <td className="p-2.5 text-center text-slate-400 font-mono">{idx + 1}</td>
                            <td className="p-2.5 font-bold text-slate-900">
                              <div className="flex items-center gap-1.5">
                                {selectedModul === 'INDIVIDU' ? (
                                  <User className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                ) : (
                                  <Building className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                                )}
                                <div>
                                  <span>{item.nama_kk || 'NAMA TIDAK TERSEDIA'}</span>
                                  {artIndex !== undefined && (
                                    <span className="text-[10px] text-slate-400 font-normal block">
                                      Index ART: #{artIndex}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="p-2.5 text-slate-600">
                              <span className="font-bold text-slate-800 block text-[11px]">
                                {item.nama_desa ? `Desa ${item.nama_desa}` : item.level_5_name || '-'}
                              </span>
                              <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                {item.nama_sls || item.idsubsls || 'SLS Wilayah'}
                              </span>
                            </td>
                            <td className="p-2.5 text-slate-700">
                              <div className="space-y-0.5 text-[11px]">
                                <div className="flex items-center gap-1 text-cyan-800 font-bold">
                                  <span className="text-[9px] bg-cyan-100 text-cyan-800 px-1 rounded">PPL</span>
                                  <span>{item.nama_ppl || '-'}</span>
                                </div>
                                <div className="flex items-center gap-1 text-amber-800 font-semibold text-[10px]">
                                  <span className="text-[9px] bg-amber-100 text-amber-800 px-1 rounded">PML</span>
                                  <span>{item.nama_pml || '-'}</span>
                                </div>
                              </div>
                            </td>
                            <td className="p-2.5 text-center">
                              <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                                #{item.no_bang || '-'}
                              </span>
                              <span className="text-[10px] text-slate-400 block mt-0.5">{item.kode_bang_label || ''}</span>
                            </td>
                            <td className="p-2.5 text-center">
                              <span className="bg-cyan-100 text-cyan-900 text-[11px] font-extrabold px-2.5 py-1 rounded-lg border border-cyan-200 inline-block font-mono">
                                {formatAngka(item.nilai_indikator)}
                              </span>
                            </td>
                            <td className="p-2.5 text-center">
                              {item.assignment_id ? (
                                <a
                                  href={`https://fasih-sm.bps.go.id/app/assignment/fd68e454-ba45-4b85-8205-f3bf777ded24/${item.assignment_id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 bg-cyan-600 hover:bg-cyan-700 text-white font-extrabold text-[10px] px-2.5 py-1.2 rounded-lg transition-all shadow-2xs hover:shadow-xs"
                                  title="Buka Dokumen Hasil Sensus di Aplikasi FASIH"
                                >
                                  <span>Lihat FASIH</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-bold italic">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
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
                  <span>Tambah Aturan Anomali QC [{selectedModul}]</span>
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