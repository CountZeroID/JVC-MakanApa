import { useState, useEffect } from 'react';
import { Trash2, Flame, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { getLogsForDateRange, deleteFoodLog, FoodLog } from '../lib/firebase';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from 'date-fns';
import { id, enUS } from 'date-fns/locale';
import BottomSheet from './BottomSheet';
import { useTranslation } from '../hooks/useTranslation';
import { useSettings } from '../contexts/SettingsContext';
import { MacroBar, VitaminBar } from './shared/NutritionBars';

type ViewMode = 'day' | 'week' | 'month';

export default function DailyLog({ targetKalori, onOpenNara }: { targetKalori: number, onOpenNara?: () => void }) {
  const { settings } = useSettings();
  const dateLocale = settings.language === 'en' ? enUS : id;
  const t = useTranslation();
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [allRangeLogs, setAllRangeLogs] = useState<FoodLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<FoodLog | null>(null);

  const startStr = viewMode === 'week' ? format(startOfWeek(selectedDate, { weekStartsOn: 1 }), 'yyyy-MM-dd') :
                   viewMode === 'month' ? format(startOfMonth(selectedDate), 'yyyy-MM-dd') :
                   format(selectedDate, 'yyyy-MM-dd');

  const endStr = viewMode === 'week' ? format(endOfWeek(selectedDate, { weekStartsOn: 1 }), 'yyyy-MM-dd') :
                 viewMode === 'month' ? format(endOfMonth(selectedDate), 'yyyy-MM-dd') :
                 format(selectedDate, 'yyyy-MM-dd');

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      const data = await getLogsForDateRange(startStr, endStr);
      setAllRangeLogs(data);
      setLoading(false);
    };
    fetchLogs();
  }, [viewMode, startStr, endStr]);

  const handleDelete = async (logId?: string) => {
    if (!logId) return;
    if (confirm("Hapus catatan ini?")) {
      await deleteFoodLog(logId);
      setAllRangeLogs(allRangeLogs.filter(l => l.id !== logId));
      if (selectedLog?.id === logId) {
          setSelectedLog(null);
      }
    }
  };

  // Filter logs exactly for selectedDate
  const logs = allRangeLogs.filter(l => l.date_key === format(selectedDate, 'yyyy-MM-dd'));

  const totals = logs.reduce((acc, log) => {
    acc.kalori += log.kalori;
    acc.karbo += log.karbohidrat_g;
    acc.protein += log.protein_g;
    acc.lemak += log.lemak_g;
    return acc;
  }, { kalori: 0, karbo: 0, protein: 0, lemak: 0 });

  const progressPerc = Math.min(100, (totals.kalori / targetKalori) * 100);
  const groupLogs = (type: string) => logs.filter(l => l.meal_type === type);

  // Group all logs by date for week/month view info
  const logsByDate = allRangeLogs.reduce((acc, log) => {
      acc[log.date_key] = (acc[log.date_key] || 0) + log.kalori;
      return acc;
  }, {} as Record<string, number>);

  const getStatusColor = (calories: number) => {
      if (calories === 0) return 'bg-border'; // no data
      const ratio = calories / targetKalori;
      if (ratio > 1.1) return 'bg-error'; // over
      if (ratio >= 0.9) return 'bg-success'; // close/on target
      return 'bg-warning'; // under
  };

  return (
    <div className="p-5 relative min-h-full pb-6 space-y-6">
      <div className="flex flex-col gap-4 mb-2">
          <div className="flex items-center justify-between">
              <h2 className="text-2xl font-extrabold font-heading text-primary tracking-tight">{t.log_title}</h2>
              <span className="text-[10px] font-bold text-text-muted bg-bg-card border border-border px-3 py-1.5 rounded-md uppercase tracking-widest">
                {format(selectedDate, 'd MMM yyyy', { locale: dateLocale })}
              </span>
          </div>

          <div className="flex bg-bg-card border border-border rounded-xl p-1">
              {(['day', 'week', 'month'] as ViewMode[]).map(mode => (
                  <button
                      key={mode}
                      onClick={() => setViewMode(mode)}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${viewMode === mode ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
                  >
                      {mode === 'day' ? t.log_hari_ini : mode === 'week' ? t.log_minggu : t.log_bulan}
                  </button>
              ))}
          </div>
      </div>

      {/* Week/Month Overview Component */}
      {viewMode === 'week' && (
          <div className="grid grid-cols-7 gap-2">
              {eachDayOfInterval({ start: new Date(startStr), end: new Date(endStr) }).map(day => {
                  const dKey = format(day, 'yyyy-MM-dd');
                  const cals = logsByDate[dKey] || 0;
                  const isSel = isSameDay(day, selectedDate);
                  return (
                      <button 
                          key={dKey}
                          onClick={() => setSelectedDate(day)}
                          className={`p-2 sm:p-3 rounded-[16px] border flex flex-col items-center justify-center gap-1.5 sm:gap-2 transition-all ${isSel ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-bg-card'}`}
                      >
                          <span className={`text-[9px] sm:text-[10px] font-bold uppercase ${isSel ? 'text-primary' : 'text-text-muted'}`}>{format(day, 'EEE', { locale: dateLocale })}</span>
                          <span className={`text-base sm:text-lg font-black font-heading ${isSel ? 'text-primary' : 'text-text-primary'}`}>{format(day, 'd')}</span>
                          <div className={`w-2 h-2 rounded-full ${getStatusColor(cals)}`}></div>
                      </button>
                  );
              })}
          </div>
      )}

      {viewMode === 'month' && (
          <div className="bg-bg-card border border-border rounded-[24px] p-5 shadow-[0_2px_16px_rgba(0,0,0,0.06)] max-w-[480px] mx-auto">
              <div className="grid grid-cols-7 gap-y-3 gap-x-1 mb-2">
                  {[t.hari_sen, t.hari_sel, t.hari_rab, t.hari_kam, t.hari_jum, t.hari_sab, t.hari_min].map(d => (
                      <div key={d} className="text-center text-[10px] font-bold text-text-muted uppercase tracking-widest">{d}</div>
                  ))}
                  {/* Empty cells before month start */}
                  {Array.from({ length: (new Date(startStr).getDay() + 6) % 7 }).map((_, i) => (
                      <div key={`empty-${i}`} />
                  ))}
                  {/* Days */}
                  {eachDayOfInterval({ start: new Date(startStr), end: new Date(endStr) }).map(day => {
                      const dKey = format(day, 'yyyy-MM-dd');
                      const cals = logsByDate[dKey] || 0;
                      const isSel = isSameDay(day, selectedDate);
                      const isTdy = isToday(day);
                      return (
                          <button 
                              key={dKey}
                              onClick={() => setSelectedDate(day)}
                              className={`aspect-square rounded-full flex items-center justify-center relative text-sm font-bold transition-all ${isSel ? 'bg-primary text-white scale-110 shadow-md z-10' : isTdy ? 'bg-border text-text-primary' : 'hover:bg-bg-main text-text-primary'}`}
                          >
                              {format(day, 'd')}
                              <div className={`absolute bottom-0 w-1.5 h-1.5 rounded-full ${isSel ? 'bg-white' : getStatusColor(cals)}`} style={{ transform: 'translateY(50%)' }}></div>
                          </button>
                      );
                  })}
              </div>
          </div>
      )}

      {/* Summary Card */}

      <div className="bg-bg-card border border-border shadow-[0_2px_16px_rgba(0,0,0,0.06)] rounded-[24px] p-6">
          <div className="flex items-center gap-6 mb-5">
              <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-border"
                        strokeWidth="4"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className="text-primary transition-all duration-1000 ease-out"
                        strokeWidth="4"
                        strokeDasharray={`${progressPerc}, 100`}
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                  </svg>
                  <div className="absolute text-center">
                      <div className="font-black font-mono text-2xl text-primary leading-none tracking-tight">{totals.kalori}</div>
                      <div className="text-[10px] text-text-muted mt-0.5 uppercase tracking-widest font-bold">/{targetKalori}</div>
                  </div>
              </div>
              
              <div className="flex-1 grid grid-cols-3 gap-2">
                  <MacroStat label={t.label_karbo} value={totals.karbo} color="text-warning" />
                  <MacroStat label={t.label_protein} value={totals.protein} color="text-success" />
                  <MacroStat label={t.label_lemak} value={totals.lemak} color="text-error" />
              </div>
          </div>
      </div>

      {loading ? (
          <div className="flex justify-center p-8">
              <div className="animate-spin text-primary"><Flame size={32} /></div>
          </div>
      ) : logs.length === 0 ? (
          <div className="text-center py-12 px-6 flex flex-col items-center">
              <div className="w-16 h-16 rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-gradient-to-br from-[#7B61FF] to-[#A28DF6] shadow-[0_4px_12px_rgba(123,97,255,0.3)] mb-4">
                  <span className="text-3xl pt-1">✨</span>
              </div>
              <div className="bg-[#EDE9FF] text-[#2A2359] p-4 rounded-[20px] rounded-tl-[4px] text-sm font-medium leading-relaxed mb-6 relative">
                  "{t.belum_ada_log}. {t.belum_ada_sub} ✨"
                  <div className="absolute -top-2 -left-2 w-4 h-4 bg-[#EDE9FF] rotate-45 hidden"></div>
              </div>
              <button 
                  onClick={onOpenNara}
                  className="bg-[#7B61FF] text-white px-6 py-3 rounded-full font-bold text-sm tracking-wide shadow-[0_4px_12px_rgba(123,97,255,0.3)] transition-transform hover:scale-105 active:scale-95"
              >
                  {t.nav_nara}
              </button>
          </div>
      ) : (
          <div className="space-y-6">
              <MealSection 
                title={t.sarapan} 
                logs={groupLogs('sarapan')} 
                onDelete={handleDelete} 
                onClickLog={setSelectedLog} 
              />
              <MealSection 
                title={t.makan_siang} 
                logs={groupLogs('makan_siang')} 
                onDelete={handleDelete} 
                onClickLog={setSelectedLog} 
              />
              <MealSection 
                title={t.makan_malam} 
                logs={groupLogs('makan_malam')} 
                onDelete={handleDelete} 
                onClickLog={setSelectedLog} 
              />
              <MealSection 
                title={t.camilan} 
                logs={groupLogs('camilan')} 
                onDelete={handleDelete} 
                onClickLog={setSelectedLog} 
              />
          </div>
      )}

      {/* Log Detail Bottom Sheet */}
      <BottomSheet isOpen={!!selectedLog} onClose={() => setSelectedLog(null)}>
          {selectedLog && (
              <div className="space-y-6 mt-4">
                  {/* Photo or Gradient Emoji */}
                  {selectedLog.imageUrl ? (
                      <div className="w-full aspect-[16/9] rounded-[24px] overflow-hidden shadow-sm relative bg-border">
                          <img src={selectedLog.imageUrl} alt={selectedLog.nama_makanan} className="w-full h-full object-cover" />
                      </div>
                  ) : (
                      <div className="w-full aspect-[16/9] rounded-[24px] shadow-sm flex items-center justify-center bg-gradient-to-br from-primary-light/40 to-primary/20 border border-primary/10 text-6xl">
                          {selectedLog.emoji}
                      </div>
                  )}

                  {/* Header */}
                  <div className="flex justify-between items-start pt-2">
                      <div className="pr-2 flex-1">
                          <div className="inline-block px-3 py-1 bg-bg-main text-primary text-[10px] font-bold uppercase tracking-widest rounded-md mb-2">
                              {selectedLog.kategori}
                          </div>
                          <h2 className="text-2xl font-bold text-text-primary leading-tight font-heading mb-1 break-words">
                              {selectedLog.nama_makanan} {selectedLog.emoji}
                          </h2>
                          <p className="text-xs text-text-muted font-medium">
                              {selectedLog.timestamp && typeof selectedLog.timestamp.toDate === 'function' ? format(selectedLog.timestamp.toDate(), "HH:mm") : format(new Date(), "HH:mm")}
                          </p>
                      </div>
                      <div className="text-right shrink-0">
                          <p className="text-text-muted text-[10px] font-bold uppercase tracking-widest mb-1">{t.totalKalori}</p>
                          <div className="flex items-baseline justify-end">
                              <p className="text-4xl font-black text-primary font-mono leading-none tracking-tight">{selectedLog.kalori}</p>
                          </div>
                          <p className="text-primary text-xs font-bold leading-none mt-1">{t.label_kcal}</p>
                      </div>
                  </div>

                  {/* Macros */}
                  <div>
                      <h3 className="font-bold text-text-primary mb-3 font-heading text-lg">Makronutrien</h3>
                      <div className="bg-bg-main p-5 rounded-[24px] border border-border/50">
                          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                               <MacroBar label={t.label_karbo} value={selectedLog.karbohidrat_g} color="bg-warning" max={300} unit={t.label_gram} />
                              <MacroBar label={t.label_protein} value={selectedLog.protein_g} color="bg-success" max={60} unit={t.label_gram} />
                              <MacroBar label={t.label_lemak} value={selectedLog.lemak_g} color="bg-accent" max={70} unit={t.label_gram} />
                              <MacroBar label={t.label_serat} value={selectedLog.serat_g} color="bg-primary-light" max={30} unit={t.label_gram} />
                              {selectedLog.gula_g !== undefined && <MacroBar label={t.label_gula} value={selectedLog.gula_g} color="bg-[#F87171]" max={50} unit={t.label_gram} />}
                          </div>
                      </div>
                  </div>

                  {/* Vitamin & Mineral */}
                  {(selectedLog.kalsium_mg !== undefined || selectedLog.zat_besi_mg !== undefined || selectedLog.vitamin_c_mg !== undefined || selectedLog.vitamin_a_mcg !== undefined || selectedLog.kalium_mg !== undefined || selectedLog.natrium_mg !== undefined) && (
                      <div>
                          <h3 className="font-bold text-text-primary mb-3 font-heading text-lg">Vitamin & Mineral</h3>
                          <div className="bg-bg-main p-5 rounded-[24px] border border-border/50">
                              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                                  {selectedLog.kalsium_mg !== undefined && <VitaminBar label="🦴 Kalsium" value={selectedLog.kalsium_mg} akg={1000} unit="mg" />}
                                  {selectedLog.zat_besi_mg !== undefined && <VitaminBar label="🩸 Zat Besi" value={selectedLog.zat_besi_mg} akg={26} unit="mg" />}
                                  {selectedLog.vitamin_c_mg !== undefined && <VitaminBar label="🍊 Vitamin C" value={selectedLog.vitamin_c_mg} akg={90} unit="mg" />}
                                  {selectedLog.vitamin_a_mcg !== undefined && <VitaminBar label="👁️ Vitamin A" value={selectedLog.vitamin_a_mcg} akg={650} unit="mcg" />}
                                  {selectedLog.kalium_mg !== undefined && <VitaminBar label="⚡ Kalium" value={selectedLog.kalium_mg} akg={4700} unit="mg" />}
                                  {selectedLog.natrium_mg !== undefined && <VitaminBar label="🧂 Natrium" value={selectedLog.natrium_mg} akg={2300} unit="mg" />}
                              </div>
                          </div>
                      </div>
                  )}

                  {/* Ingredients */}
                  {selectedLog.bahan_makanan && selectedLog.bahan_makanan.length > 0 && (
                      <div>
                          <h3 className="font-bold text-text-primary mb-3 font-heading text-lg">{t.rincian_bahan}</h3>
                          <div className="bg-bg-main rounded-[20px] p-2 border border-border/50">
                              <div className="grid gap-1">
                                  {selectedLog.bahan_makanan.map((bahan, idx) => (
                                      <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-[14px]">
                                          <div className="min-w-0 flex-1 pr-3">
                                              <p className="font-bold text-sm text-text-primary truncate">{bahan.nama}</p>
                                              <p className="text-xs text-text-secondary mt-0.5">{bahan.estimasi_porsi}</p>
                                          </div>
                                          <div className="text-right shrink-0">
                                              <p className="font-black text-primary font-mono">{bahan.kalori}</p>
                                              <p className="text-[10px] text-text-muted font-bold tracking-widest uppercase">{t.label_kcal}</p>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      </div>
                  )}

                  {/* Tip */}
                  {selectedLog.catatan_gizi && (
                      <div className="bg-primary/5 border border-primary/10 p-5 rounded-[20px] flex items-start gap-4">
                          <span className="text-2xl leading-none pt-1">💡</span>
                          <p className="text-sm text-text-secondary italic leading-relaxed font-medium">"{selectedLog.catatan_gizi}"</p>
                      </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 pt-4">
                      <button 
                          onClick={() => handleDelete(selectedLog.id)}
                          className="flex-1 bg-white border-2 border-error text-error font-bold py-4 rounded-[16px] text-sm hover:bg-error/5 transition-colors flex items-center justify-center gap-2"
                      >
                          <Trash2 size={18} />
                          {t.btn_hapus}
                      </button>
                      <button 
                          onClick={() => setSelectedLog(null)}
                          className="flex-1 bg-bg-main border border-border text-text-primary font-bold py-4 rounded-[16px] hover:bg-border/60 transition-colors flex items-center justify-center text-sm"
                      >
                          ✕ {t.btn_cancel}
                      </button>
                  </div>
              </div>
          )}
      </BottomSheet>
    </div>
  );
}

function MacroStat({ label, value, color }: { label: string, value: number, color: string }) {
    return (
        <div className="text-center bg-bg-main rounded-xl py-2.5 border border-border/50">
            <div className={`text-lg font-black font-mono tracking-tight leading-none ${color}`}>{Math.round(value)}g</div>
            <div className="text-[9px] text-text-secondary font-bold uppercase tracking-widest mt-1.5">{label}</div>
        </div>
    );
}

function MealSection({ title, logs, onDelete, onClickLog }: { title: string, logs: FoodLog[], onDelete: (id?: string) => void, onClickLog: (log: FoodLog) => void }) {
    if (logs.length === 0) return null;
    
    return (
        <div>
            <h3 className="font-bold text-lg text-text-primary mb-3 font-heading tracking-tight">{title}</h3>
            <div className="space-y-3">
                {logs.map(log => (
                    <div key={log.id} 
                         onClick={() => onClickLog(log)}
                         className="bg-bg-card border border-border p-4 rounded-[20px] flex items-center shadow-[0_2px_16px_rgba(0,0,0,0.06)] cursor-pointer group hover:border-primary-light/50 transition-colors">
                        <div className="w-12 h-12 bg-bg-main rounded-xl border border-border/50 flex items-center justify-center text-2xl shrink-0 overflow-hidden">
                            {log.imageUrl ? (
                                <img src={log.imageUrl} alt={log.nama_makanan} className="w-full h-full object-cover" />
                            ) : (
                                log.emoji
                            )}
                        </div>
                        <div className="ml-4 flex-1 min-w-0">
                            <h4 className="font-bold text-text-primary truncate">{log.nama_makanan}</h4>
                            <p className="text-[11px] text-text-secondary mt-1 font-bold tracking-wide uppercase truncate">
                                {log.kategori} • {log.karbohidrat_g}C | {log.protein_g}P | {log.lemak_g}F
                            </p>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                            <div className="font-black text-primary font-mono tracking-tight text-xl">{log.kalori}</div>
                            <div className="text-[10px] text-text-muted mt-0.5 font-bold uppercase tracking-widest">kcal</div>
                        </div>
                        <button 
                            onClick={(e) => { e.stopPropagation(); onDelete(log.id); }}
                            className="ml-3 p-2 text-text-muted hover:text-error hover:bg-error/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
