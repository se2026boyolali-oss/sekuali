import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabaseData } from '../lib/supabase';
import { 
  Plus, Trash2, RefreshCw, AlertTriangle, ShieldCheck, Filter, 
  GitMerge, Users, CheckCircle2, X 
} from 'lucide-react';

export default function QCRulesTab({ selectedModul = 'PERUMAHAN', onRuleChange }) {
  const [loading, setLoading] = useState(false);
  const [kolomList, setKolomList] = useState([]);
  const [ruleList, setRuleList] = useState([]);

  // Form State
  const [ruleType, setRuleType] = useState('SINGLE_COLUMN'); 
  const [ruleName, setRuleName] = useState('');
  const [reason, setReason] = useState('');
  
  // Dynamic Conditions Array
  const [conditions, setConditions] = useState([
    { target_column: '', operator: 'IN', trigger_values: '' }
  ]);

  // Aggregation Config
  const [groupByColumn, setGroupByColumn] = useState('no_bang');
  const [aggTargetColumn, setAggTargetColumn] = useState('');
  const [aggTriggerValues, setAggTriggerValues] = useState('');
  const [aggregationOperator, setAggregationOperator] = useState('COUNT');
  const [aggregationThreshold, setAggregationThreshold] = useState(1);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReevaluating, setIsReevaluating] = useState(false);

  // Filter List State
  const [filterKolom, setFilterKolom] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');

  // 1. Fetch Master Kolom Terfilter Modul
  const fetchKolom = useCallback(async () => {
    try {
      const { data, error } = await supabaseData
        .from('master_kolom_qc')
        .select('kolom_id, modul_id, nama_kolom_db, label_tampilan, tipe_data')
        .eq('modul_id', selectedModul)
        .eq('is_active', true)
        .order('kolom_id', { ascending: true });

      if (error) throw error;
      setKolomList(data || []);
      if (data && data.length > 0) {
        setConditions([
          { target_column: data[0].nama_kolom_db, operator: 'IN', trigger_values: '' }
        ]);
        setAggTargetColumn(data[0].nama_kolom_db);
      }
    } catch (err) {
      console.error("Gagal memuat master kolom:", err.message);
    }
  }, [selectedModul]);

  // 2. Fetch Aturan QC Terfilter Modul
  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabaseData
        .from('rule_configurations')
        .select('rule_id, rule_name, target_column, value_type, operator, trigger_values, is_active, modul_id, reason, rule_type, conditions, group_by_column, aggregation_operator, aggregation_threshold')
        .eq('modul_id', selectedModul)
        .order('rule_id', { ascending: false });

      if (error) throw error;
      setRuleList(data || []);
    } catch (err) {
      console.error("Gagal memuat aturan QC:", err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedModul]);

  useEffect(() => {
    fetchKolom();
    fetchRules();
  }, [fetchKolom, fetchRules]);

  // 3. Trigger Re-evaluasi Data
  const handleReevaluateAll = async (showAlert = true) => {
    setIsReevaluating(true);
    try {
      let tableName = 'assignments';
      if (selectedModul === 'INDIVIDU') tableName = 'assignments_individu';
      if (selectedModul === 'USAHA') tableName = 'assignments_usaha';

      const { error } = await supabaseData.rpc('reevaluate_all_assignments', {
        p_table_name: tableName,
        p_modul_id: selectedModul
      });
      if (error) throw error;

      if (showAlert) alert(`✅ Seluruh data [${selectedModul}] berhasil dievaluasi ulang!`);
      if (onRuleChange) onRuleChange();
    } catch (err) {
      console.error("Gagal re-evaluasi:", err.message);
      alert("Gagal memicu evaluasi ulang: " + err.message);
    } finally {
      setIsReevaluating(false);
    }
  };

  // Handler Dynamic Conditions Form
  const handleAddCondition = () => {
    const defaultCol = kolomList.length > 0 ? kolomList[0].nama_kolom_db : '';
    setConditions(prev => [...prev, { target_column: defaultCol, operator: 'IN', trigger_values: '' }]);
  };

  const handleRemoveCondition = (index) => {
    if (conditions.length <= 1 && ruleType !== 'AGGREGATION') {
      alert("Aturan harus memiliki minimal 1 kondisi.");
      return;
    }
    setConditions(prev => prev.filter((_, i) => i !== index));
  };

  const handleConditionChange = (index, field, value) => {
    setConditions(prev => {
      const updated = [...prev];
      updated[index][field] = value;
      return updated;
    });
  };

  // 4. Tambah Aturan Baru
  const handleAddRule = async (e) => {
    e.preventDefault();
    if (!ruleName.trim()) {
      alert("Harap isi nama aturan QC!");
      return;
    }

    setIsSubmitting(true);

    try {
      let primaryCol = '';
      let primaryOp = '';
      let primaryVals = [];
      let primaryValType = 'STRING';
      let formattedConditions = [];

      if (ruleType === 'AGGREGATION') {
        primaryCol = aggTargetColumn || groupByColumn;
        primaryOp = aggregationOperator;
        primaryVals = aggTriggerValues.split(',').map(v => v.trim()).filter(Boolean);
        const selectedColObj = kolomList.find(k => k.nama_kolom_db === primaryCol);
        primaryValType = selectedColObj?.tipe_data === 'NUMBER' ? 'NUMBER' : 'STRING';
      } else {
        formattedConditions = conditions.map(c => {
          const selectedKolomObj = kolomList.find(k => k.nama_kolom_db === c.target_column);
          const valType = selectedKolomObj?.tipe_data === 'NUMBER' ? 'NUMBER' : 'STRING';
          
          const noValOps = ['IS_NULL', 'GROUP_INCONSISTENT'];
          const valsArray = noValOps.includes(c.operator)
            ? [] 
            : c.trigger_values.split(',').map(v => v.trim()).filter(Boolean);

          return {
            target_column: c.target_column,
            value_type: valType,
            operator: c.operator,
            trigger_values: valsArray
          };
        });

        primaryCol = formattedConditions[0]?.target_column || '';
        primaryOp = formattedConditions[0]?.operator || 'IN';
        primaryVals = formattedConditions[0]?.trigger_values || [];
        primaryValType = formattedConditions[0]?.value_type || 'STRING';
      }

      const payload = {
        modul_id: selectedModul,
        rule_name: ruleName.trim(),
        rule_type: ruleType,
        target_column: primaryCol,
        operator: primaryOp,
        value_type: primaryValType,
        trigger_values: primaryVals,
        conditions: ruleType === 'AGGREGATION' ? [] : formattedConditions,
        group_by_column: ruleType === 'AGGREGATION' ? groupByColumn : null,
        aggregation_operator: ruleType === 'AGGREGATION' ? aggregationOperator : null,
        aggregation_threshold: ruleType === 'AGGREGATION' ? Number(aggregationThreshold) : null,
        reason: reason.trim() || ruleName.trim(),
        is_active: true
      };

      const { error } = await supabaseData.from('rule_configurations').insert([payload]);
      if (error) throw error;

      // Reset Form State
      setRuleName('');
      setReason('');
      setAggTriggerValues('');
      if (kolomList.length > 0) {
        setConditions([{ target_column: kolomList[0].nama_kolom_db, operator: 'IN', trigger_values: '' }]);
      }

      await fetchRules();
      await handleReevaluateAll(false);
    } catch (err) {
      alert("Gagal menyimpan aturan QC: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 5. Hapus Aturan
  const handleDeleteRule = async (ruleId) => {
    if (!confirm("Hapus aturan QC ini?")) return;
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

  // Filter daftar aturan
  const filteredRules = useMemo(() => {
    return ruleList.filter(rule => {
      const matchType = filterType === 'ALL' || (rule.rule_type || 'SINGLE_COLUMN') === filterType;
      const matchKolom = filterKolom === 'ALL' || rule.target_column === filterKolom;
      return matchType && matchKolom;
    });
  }, [ruleList, filterType, filterKolom]);

  return (
    <div className="space-y-6">
      
      {/* HEADER CARD MODULE INFO */}
      <div className="bg-amber-500 text-white p-4 rounded-2xl shadow-xs flex justify-between items-center">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-amber-100" />
          <div>
            <h3 className="font-extrabold text-sm">Modul QC Data [{selectedModul}]</h3>
            <p className="text-xs text-amber-100">Konfigurasi aturan tunggal, lintas indikator (Multi-Kondisi), maupun agregasi per nomor bangunan.</p>
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
      <section className="bg-white p-6 rounded-2xl shadow-2xs border border-slate-200 space-y-5">
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Plus className="w-4 h-4 text-orange-600" /> Tambah Aturan Konfirmasi QC Baru [{selectedModul}]
        </h2>

        {/* TABS TIPE ATURAN */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => { setRuleType('SINGLE_COLUMN'); setConditions([{ target_column: kolomList[0]?.nama_kolom_db || '', operator: 'IN', trigger_values: '' }]); }}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${ruleType === 'SINGLE_COLUMN' ? 'border-orange-500 bg-orange-50/50 ring-2 ring-orange-200' : 'border-slate-200 hover:border-slate-300'}`}
          >
            <div className={`p-2 rounded-lg ${ruleType === 'SINGLE_COLUMN' ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">1 Indikator (Standar)</p>
              <p className="text-[10px] text-slate-500">Pemeriksaan nilai tunggal per kolom</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setRuleType('CROSS_COLUMN')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${ruleType === 'CROSS_COLUMN' ? 'border-cyan-500 bg-cyan-50/50 ring-2 ring-cyan-200' : 'border-slate-200 hover:border-slate-300'}`}
          >
            <div className={`p-2 rounded-lg ${ruleType === 'CROSS_COLUMN' ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
              <GitMerge className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">Lintas Indikator (AND)</p>
              <p className="text-[10px] text-slate-500">Kombinasi multi-kondisi lintas kolom</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setRuleType('AGGREGATION')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${ruleType === 'AGGREGATION' ? 'border-purple-500 bg-purple-50/50 ring-2 ring-purple-200' : 'border-slate-200 hover:border-slate-300'}`}
          >
            <div className={`p-2 rounded-lg ${ruleType === 'AGGREGATION' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
              <Users className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">Agregasi Per Bangunan</p>
              <p className="text-[10px] text-slate-500">Jumlah/hitung per No. Bangunan</p>
            </div>
          </button>
        </div>

        <form onSubmit={handleAddRule} className="space-y-4 pt-2">
          {/* INFORMASI UTAMA ATURAN */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Nama Aturan QC *</label>
              <input 
                type="text" 
                required 
                placeholder="Contoh: Kloset Leher Angsa tapi Pembuangan di Lapang"
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Alasan Penjelasan Anomali (Reason)</label>
              <input 
                type="text" 
                placeholder="Contoh: Pembuangan akhir tinja tidak memenuhi standar sanitasi"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
              />
            </div>
          </div>

          {/* DYNAMIC CONDITIONS FIELD (UNTUK SINGLE & CROSS COLUMN) */}
          {(ruleType === 'SINGLE_COLUMN' || ruleType === 'CROSS_COLUMN') && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <GitMerge className="w-3.5 h-3.5 text-cyan-600" />
                  Kondisi Syarat {ruleType === 'CROSS_COLUMN' && '(Seluruh Syarat Harus Terpenuhi - LOGIKA AND)'}
                </label>

                {ruleType === 'CROSS_COLUMN' && (
                  <button
                    type="button"
                    onClick={handleAddCondition}
                    className="text-xs font-bold text-cyan-600 hover:text-cyan-700 flex items-center gap-1 cursor-pointer bg-white px-2.5 py-1 rounded-lg border border-cyan-200 shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tambah Syarat (AND)
                  </button>
                )}
              </div>

              {conditions.map((cond, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center bg-white p-3 rounded-xl border border-slate-200">
                  <div className="md:col-span-4">
                    <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Indikator Kolom Target</label>
                    <select
                      value={cond.target_column}
                      onChange={(e) => handleConditionChange(idx, 'target_column', e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    >
                      {kolomList.map(col => (
                        <option key={col.kolom_id} value={col.nama_kolom_db}>
                          {col.label_tampilan} ({col.nama_kolom_db})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-3">
                    <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Operator</label>
                    <select
                      value={cond.operator}
                      onChange={(e) => handleConditionChange(idx, 'operator', e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs font-medium focus:outline-none"
                    >
                      <option value="IN">Termasuk Dalam (IN)</option>
                      <option value="=">Sama Dengan (=)</option>
                      <option value=">">Lebih Dari (&gt;)</option>
                      <option value=">=">Lebih Dari Sama Dengan (&gt;=)</option>
                      <option value="<">Kurang Dari (&lt;)</option>
                      <option value="<=">Kurang Dari Sama Dengan (&lt;=)</option>
                      <option value="BETWEEN">Rentang Nilai (BETWEEN)</option>
                      <option value="LIKE">Mirip Teks (LIKE)</option>
                      <option value="IS_NULL">Kosong / NULL</option>
                      <option value="GROUP_INCONSISTENT">Beda Isian Per Bangunan</option>
                    </select>
                  </div>

                  <div className="md:col-span-4">
                    <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Nilai Pemicu (Koma)</label>
                    <input
                      type="text"
                      disabled={cond.operator === 'IS_NULL' || cond.operator === 'GROUP_INCONSISTENT'}
                      placeholder={
                        cond.operator === 'IS_NULL' ? 'Tanpa Nilai' :
                        cond.operator === 'BETWEEN' ? 'Contoh: 10, 50' : 'Contoh: Bambu, Kayu'
                      }
                      value={(cond.operator === 'IS_NULL' || cond.operator === 'GROUP_INCONSISTENT') ? '' : cond.trigger_values}
                      onChange={(e) => handleConditionChange(idx, 'trigger_values', e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs font-medium focus:outline-none disabled:bg-slate-100"
                    />
                  </div>

                  {ruleType === 'CROSS_COLUMN' && conditions.length > 1 && (
                    <div className="md:col-span-1 flex justify-end pt-3 md:pt-0">
                      <button
                        type="button"
                        onClick={() => handleRemoveCondition(idx)}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                        title="Hapus Syarat Ini"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* FORM KHUSUS TIPE AGGREGATION */}
          {ruleType === 'AGGREGATION' && (
            <div className="bg-purple-50 p-4 rounded-xl border border-purple-200 space-y-3">
              <label className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-purple-600" />
                Pengaturan Agregasi & Pemeriksaan Isian Ganda Bangunan
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-white p-3 rounded-xl border border-purple-100">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Kelompokkan Berdasarkan</label>
                  <select
                    value={groupByColumn}
                    onChange={(e) => setGroupByColumn(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs font-bold bg-slate-50"
                  >
                    <option value="no_bang">Nomor Bangunan (no_bang)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Indikator Kolom Yang Diperiksa *</label>
                  <select
                    value={aggTargetColumn}
                    onChange={(e) => setAggTargetColumn(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  >
                    {kolomList.map(col => (
                      <option key={col.kolom_id} value={col.nama_kolom_db}>
                        {col.label_tampilan} ({col.nama_kolom_db})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-0.5">
                    Nilai Pemicu Spesifik (Dipisah Koma, Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Milik Sendiri (Kosongkan jika semua nilai sama dihitung)"
                    value={aggTriggerValues}
                    onChange={(e) => setAggTriggerValues(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs font-medium focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Batas Lebih Dari (&gt;)</label>
                  <div className="flex items-center gap-2">
                    <select
                      value={aggregationOperator}
                      onChange={(e) => setAggregationOperator(e.target.value)}
                      className="p-2 border border-slate-300 rounded-lg text-xs font-bold bg-slate-50 shrink-0"
                    >
                      <option value="COUNT">COUNT &gt;</option>
                    </select>
                    <input
                      type="number"
                      min="1"
                      value={aggregationThreshold}
                      onChange={(e) => setAggregationThreshold(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs font-bold"
                    />
                    <span className="text-xs text-slate-500 font-medium shrink-0">Baris</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="pt-2">
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-amber-400 rounded-xl text-xs font-bold cursor-pointer disabled:bg-slate-300 transition-all shadow-2xs flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Menyimpan Aturan...' : `Simpan Aturan QC [${selectedModul}] Baru`}</span>
            </button>
          </div>
        </form>
      </section>

      {/* DAFTAR ATURAN */}
      <section className="bg-white p-6 rounded-2xl shadow-2xs border border-slate-200 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span>Daftar Aturan QC [{selectedModul}] Aktif</span>
            <span className="bg-orange-100 text-orange-800 text-[11px] px-2 py-0.5 rounded-full font-mono">
              {filteredRules.length} dari {ruleList.length} aturan
            </span>
          </h2>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="p-1.5 border border-slate-300 rounded-xl text-xs font-bold bg-slate-50 focus:ring-2 focus:ring-orange-500 focus:outline-none"
              >
                <option value="ALL">-- Semua Tipe Logika --</option>
                <option value="SINGLE_COLUMN">1 Indikator (Standar)</option>
                <option value="CROSS_COLUMN">Lintas Indikator (Multi)</option>
                <option value="AGGREGATION">Agregasi Bangunan</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <select
                value={filterKolom}
                onChange={(e) => setFilterKolom(e.target.value)}
                className="p-1.5 border border-slate-300 rounded-xl text-xs font-bold bg-slate-50 focus:ring-2 focus:ring-orange-500 focus:outline-none"
              >
                <option value="ALL">-- Semua Indikator --</option>
                {kolomList.map(col => (
                  <option key={col.kolom_id} value={col.nama_kolom_db}>
                    {col.label_tampilan}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2 font-bold">
            <RefreshCw className="w-4 h-4 animate-spin text-orange-500" /> Memuat Aturan...
          </div>
        ) : filteredRules.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-8 text-center">
            {ruleList.length === 0 ? `Belum ada aturan QC yang diatur untuk modul [${selectedModul}].` : "Tidak ada aturan yang cocok dengan filter ini."}
          </p>
        ) : (
          <div className="space-y-3">
            {filteredRules.map(rule => {
              const ruleT = rule.rule_type || 'SINGLE_COLUMN';
              return (
                <div key={rule.rule_id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center gap-4 hover:border-orange-200 transition-colors">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${
                        ruleT === 'CROSS_COLUMN' ? 'bg-cyan-100 text-cyan-800 border-cyan-200' :
                        ruleT === 'AGGREGATION' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                        'bg-orange-100 text-orange-800 border-orange-200'
                      }`}>
                        {ruleT === 'CROSS_COLUMN' ? 'CROSS COLUMN' : ruleT === 'AGGREGATION' ? 'AGGREGATION' : 'SINGLE COLUMN'}
                      </span>
                      <h3 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                        {rule.rule_name}
                      </h3>
                    </div>

                    <p className="text-[11px] text-slate-500">
                      Reason: <span className="italic text-slate-700">{rule.reason || rule.rule_name}</span>
                    </p>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {Array.isArray(rule.conditions) && rule.conditions.length > 0 ? (
                        rule.conditions.map((c, ci) => (
                          <span key={ci} className="bg-white text-slate-800 text-[10px] font-medium px-2 py-0.5 rounded-md border border-slate-300 flex items-center gap-1 shadow-2xs">
                            <span className="font-bold text-slate-900">{c.target_column}</span>
                            <span className="text-orange-600 font-bold">{c.operator}</span>
                            <span className="text-cyan-700 font-bold">[{Array.isArray(c.trigger_values) ? c.trigger_values.join(', ') : ''}]</span>
                          </span>
                        ))
                      ) : (
                        <span className="bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-md">
                          {rule.target_column} {rule.operator || 'COUNT'} [{Array.isArray(rule.trigger_values) ? rule.trigger_values.join(', ') : 'SEMUA NILAI GANDA'}] (Threshold: &gt; {rule.aggregation_threshold || 1})
                        </span>
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
              );
            })}
          </div>
        )}
      </section>

    </div>
  );
}