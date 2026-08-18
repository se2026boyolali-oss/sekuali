import React, { useState, useEffect } from 'react';
import { supabaseData } from '../lib/supabase';
import { Plus, Trash2, RefreshCw, AlertTriangle, ShieldCheck, Filter, Layers } from 'lucide-react';

export default function QCRulesPerumahanTab({ onRuleChange }) {
  const [loading, setLoading] = useState(false);
  const [kolomList, setKolomList] = useState([]);
  const [ruleList, setRuleList] = useState([]);

  // Form State
  const [ruleName, setRuleName] = useState('');
  const [targetColumn, setTargetColumn] = useState('');
  const [operator, setOperator] = useState('IN');
  const [triggerValues, setTriggerValues] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReevaluating, setIsReevaluating] = useState(false);

  // State Filter Indikator pada Daftar Aturan ('ALL' untuk semua)
  const [filterKolom, setFilterKolom] = useState('ALL');

  // Fetch Master Kolom Khusus Modul PERUMAHAN
  const fetchKolom = async () => {
    try {
      const { data, error } = await supabaseData
        .from('master_kolom_qc')
        .select('*')
        .eq('modul_id', 'PERUMAHAN')
        .eq('is_active', true)
        .order('kolom_id', { ascending: true });

      if (error) throw error;
      setKolomList(data || []);
      if (data && data.length > 0) {
        setTargetColumn(data[0].nama_kolom_db);
      }
    } catch (err) {
      console.error("Gagal memuat master kolom perumahan:", err.message);
    }
  };

  // Fetch Aturan QC Khusus Modul PERUMAHAN
  const fetchRules = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabaseData
        .from('rule_configurations')
        .select('*')
        .eq('modul_id', 'PERUMAHAN')
        .order('rule_id', { ascending: false });

      if (error) throw error;
      setRuleList(data || []);
    } catch (err) {
      console.error("Gagal memuat aturan QC perumahan:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKolom();
    fetchRules();
  }, []);

  // Trigger Re-evaluasi Data
  const handleReevaluateAll = async (showAlert = true) => {
    setIsReevaluating(true);
    try {
      const { error } = await supabaseData.rpc('reevaluate_all_assignments');
      if (error) throw error;
      if (showAlert) alert("✅ Seluruh data Perumahan berhasil dievaluasi ulang dengan aturan QC terbaru!");
      if (onRuleChange) onRuleChange();
    } catch (err) {
      console.error("Gagal re-evaluasi:", err.message);
      alert("Gagal memicu evaluasi ulang: " + err.message);
    } finally {
      setIsReevaluating(false);
    }
  };

  // Tambah Aturan Baru
  const handleAddRule = async (e) => {
    e.preventDefault();
    if (!ruleName.trim() || !targetColumn) {
      alert("Harap lengkapi nama aturan dan kolom target!");
      return;
    }

    setIsSubmitting(true);
    
    // Jika operator IS_NULL atau GROUP_INCONSISTENT, triggerValues dikosongkan
    const valuesArray = (operator === 'IS_NULL' || operator === 'GROUP_INCONSISTENT')
      ? [] 
      : triggerValues.split(',').map(v => v.trim()).filter(Boolean);

    const selectedKolomObj = kolomList.find(k => k.nama_kolom_db === targetColumn);
    const valueType = selectedKolomObj?.tipe_data === 'NUMBER' ? 'NUMBER' : 'STRING';

    try {
      const { error } = await supabaseData.from('rule_configurations').insert([
        {
          modul_id: 'PERUMAHAN',
          rule_name: ruleName.trim(),
          target_column: targetColumn,
          value_type: valueType,
          operator: operator,
          trigger_values: valuesArray,
          is_active: true
        }
      ]);

      if (error) throw error;

      setRuleName('');
      setTriggerValues('');
      await fetchRules();
      await handleReevaluateAll(false); // Jalankan re-evaluasi tanpa pop-up berulang
    } catch (err) {
      alert("Gagal menyimpan aturan QC: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Hapus Aturan
  const handleDeleteRule = async (ruleId) => {
    if (!confirm("Hapus aturan QC Perumahan ini?")) return;
    try {
      const { error } = await supabaseData
        .from('rule_configurations')
        .delete()
        .eq('rule_id', ruleId);

      if (error) throw error;
      await fetchRules();
      await handleReevaluateAll(false);
    } catch (err) {
      alert("Gagal menghapus aturan: " + err.message);
    }
  };

  // Filter daftar aturan berdasarkan pilihan indikator
  const filteredRules = ruleList.filter(rule => {
    if (filterKolom === 'ALL') return true;
    return rule.target_column === filterKolom;
  });

  return (
    <div className="space-y-6">
      
      {/* HEADER CARD MODULE INFO */}
      <div className="bg-amber-500 text-white p-4 rounded-2xl shadow-xs flex justify-between items-center">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-amber-100" />
          <div>
            <h3 className="font-extrabold text-sm">Modul QC Data Perumahan</h3>
            <p className="text-xs text-amber-100">Aturan yang diatur di sini akan memicu flag konfirmasi lapangan untuk data Sensus Perumahan.</p>
          </div>
        </div>

        <button
          onClick={() => handleReevaluateAll(true)}
          disabled={isReevaluating}
          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-amber-400 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isReevaluating ? 'animate-spin' : ''}`} />
          <span>{isReevaluating ? 'Proses Evaluasi...' : 'Re-Evaluasi Data'}</span>
        </button>
      </div>

      {/* FORM TAMBAH ATURAN */}
      <section className="bg-white p-6 rounded-2xl shadow-2xs border border-slate-200 space-y-4">
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Plus className="w-4 h-4 text-orange-600" /> Tambah Aturan Konfirmasi QC Perumahan
        </h2>

        <form onSubmit={handleAddRule} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Nama Aturan </label>
            <input 
              type="text" 
              required 
              placeholder="Contoh: Beda Sumber Penerangan Dalam 1 Bangunan"
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Kolom Target Perumahan</label>
            <select 
              value={targetColumn}
              onChange={(e) => setTargetColumn(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-orange-500 focus:outline-none"
            >
              {kolomList.map(col => (
                <option key={col.kolom_id} value={col.nama_kolom_db}>
                  {col.label_tampilan} ({col.nama_kolom_db})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Operator Logika</label>
            <select 
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-medium"
            >
              <option value="IN">Termasuk Dalam (IN)</option>
              <option value="=">Sama Dengan (=)</option>
              <option value=">">Lebih Dari (&gt;)</option>
              <option value="<">Kurang Dari (&lt;)</option>
              <option value="LIKE">Mirip Teks (LIKE)</option>
              <option value="IS_NULL">Kosong / NULL</option>
              <option value="GROUP_INCONSISTENT">Beda Isian Dalam No. Bangunan Sama</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Nilai Pemicu (Pisahkan Koma)</label>
            <input 
              type="text" 
              required={operator !== 'IS_NULL' && operator !== 'GROUP_INCONSISTENT'}
              disabled={operator === 'IS_NULL' || operator === 'GROUP_INCONSISTENT'}
              placeholder={
                operator === 'GROUP_INCONSISTENT' 
                  ? 'Otomatis mengecek perbedaan nilai antar-KK di bangunan sama' 
                  : operator === 'IS_NULL' 
                  ? 'Tidak memerlukan nilai' 
                  : 'Contoh: Bambu, Kayu, Anyaman'
              }
              value={(operator === 'IS_NULL' || operator === 'GROUP_INCONSISTENT') ? '' : triggerValues}
              onChange={(e) => setTriggerValues(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
            />
          </div>

          <div className="md:col-span-2 pt-2">
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:bg-slate-300 transition-all shadow-2xs"
            >
              {isSubmitting ? 'Menyimpan Aturan...' : 'Simpan Aturan QC Perumahan Baru'}
            </button>
          </div>
        </form>
      </section>

      {/* DAFTAR ATURAN DENGAN FILTER INDIKATOR */}
      <section className="bg-white p-6 rounded-2xl shadow-2xs border border-slate-200 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span>Daftar Aturan QC Perumahan Aktif</span>
            <span className="bg-orange-100 text-orange-800 text-[11px] px-2 py-0.5 rounded-full font-mono">
              {filteredRules.length} dari {ruleList.length} aturan
            </span>
          </h2>

          {/* DROPDOWN FILTER INDIKATOR */}
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <label className="text-xs font-bold text-slate-600 whitespace-nowrap">Filter Indikator:</label>
            <select
              value={filterKolom}
              onChange={(e) => setFilterKolom(e.target.value)}
              className="p-2 border border-slate-300 rounded-xl text-xs font-bold bg-slate-50 focus:ring-2 focus:ring-orange-500 focus:outline-none"
            >
              <option value="ALL">-- Tampilkan Semua Indikator --</option>
              {kolomList.map(col => (
                <option key={col.kolom_id} value={col.nama_kolom_db}>
                  {col.label_tampilan}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2 font-bold">
            <RefreshCw className="w-4 h-4 animate-spin text-orange-500" /> Memuat Aturan...
          </div>
        ) : filteredRules.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-8 text-center">
            {ruleList.length === 0 ? "Belum ada aturan QC yang diseting untuk modul Perumahan." : "Tidak ada aturan yang cocok dengan filter indikator ini."}
          </p>
        ) : (
          <div className="space-y-3">
            {filteredRules.map(rule => (
              <div key={rule.rule_id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center gap-4 hover:border-orange-200 transition-colors">
                <div className="space-y-1">
                  <h3 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    {rule.rule_name}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Target: <span className="font-mono font-bold text-slate-700">{rule.target_column}</span> | Tipe: <span className="font-mono text-slate-600">{rule.value_type}</span> | Operator: <span className="font-bold text-orange-600">{rule.operator}</span>
                  </p>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {rule.operator === 'GROUP_INCONSISTENT' ? (
                      <span className="bg-purple-100 text-purple-900 text-[10px] font-bold px-2 py-0.5 rounded-md border border-purple-200 flex items-center gap-1">
                        <Layers className="w-3 h-3" /> Pengecekan Beda Isian Per Bangunan
                      </span>
                    ) : Array.isArray(rule.trigger_values) && rule.trigger_values.length > 0 ? (
                      rule.trigger_values.map((v, i) => (
                        <span key={i} className="bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-md border border-amber-200">
                          {v}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">Tanpa Nilai Pemicu (IS NULL)</span>
                    )}
                  </div>
                </div>

                <button 
                  onClick={() => handleDeleteRule(rule.rule_id)}
                  className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer shrink-0"
                  title="Hapus Aturan Ini"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}