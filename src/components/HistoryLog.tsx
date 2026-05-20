import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Trash2 } from 'lucide-react';
import { getLogsForDateRange, deleteFoodLog, FoodLog } from '../lib/firebase';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, isAfter, startOfDay } from 'date-fns';
import { id, enUS } from 'date-fns/locale';
import BottomSheet from './BottomSheet';
import { useTranslation } from '../hooks/useTranslation';
import { useSettings } from '../contexts/SettingsContext';
import { MacroBar, VitaminBar } from './shared/NutritionBars';

export default function HistoryLog({ targetKalori }: { targetKalori: number }) {
  const { settings } = useSettings();
  const dateLocale = settings.language === 'en' ? enUS : id;
  const t = useTranslation();
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  // The month currently being viewed in the calendar
  const [viewMonth, setViewMonth] = useState<Date>(startOfMonth(new Date()));
  const [allLogs, setAllLogs] = useState<FoodLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<FoodLog | null>(null);

  const startStr = format(startOfMonth(viewMonth), 'yyyy-MM-dd');
  const endStr = format(endOfMonth(viewMonth), 'yyyy-MM-dd');

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      const data = await getLogsForDateRange(startStr, endStr);
      setAllLogs(data);
      setLoading(false);
    };
    fetchLogs();
  }, [startStr, endStr]);

  const handlePrevMonth = () => {
    setViewMonth(prev => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() - 1);
      return d;
    });
  };

  const handleNextMonth = () => {
    setViewMonth(prev => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + 1);
      return d;
    });
  };

  const handleGoToToday = () => {
    const today = new Date();
    setViewMonth(startOfMonth(today));
    setSelectedDate(today);
  };

  const handleDelete = async (logId?: string) => {
    if (!logId) return;
    if (confirm("Hapus catatan ini?")) {
      await deleteFoodLog(logId);
      setAllLogs(allLogs.filter(l => l.id !== logId));
      if (selectedLog?.id === logId) {
          setSelectedLog(null);
      }
    }
  };

  const logsForSelectedDate = allLogs.filter(l => l.date_key === format(selectedDate, 'yyyy-MM-dd'));
  const groupLogs = (type: string) => logsForSelectedDate.filter(l => l.meal_type === type);

  // Group all logs by date for calendar dots
  const logsByDate = allLogs.reduce((acc, log) => {
      acc[log.date_key] = (acc[log.date_key] || 0) + log.kalori;
      return acc;
  }, {} as Record<string, number>);

  const getStatusColor = (calories: number) => {
      if (calories === 0) return 'bg-border';
      const ratio = calories / targetKalori;
      if (ratio > 1.1) return 'bg-error';
      if (ratio >= 0.9) return 'bg-success';
      return 'bg-warning';
  };

  return (
    <div className="p-5 relative min-h-full pb-6 space-y-6 animate-in fade-in">
      <div className="flex flex-col gap-4 mb-2">
          <div className="flex items-center justify-between">
              <h2 className="text-2xl font-extrabold font-heading text-primary tracking-tight">History</h2>
              {!isSameDay(selectedDate, new Date()) && (
                  <button 
                      onClick={handleGoToToday}
                      className="flex items-center gap-1.5 text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-lg uppercase tracking-widest cursor-pointer active:scale-95 transition-all hover:bg-primary/20"
                  >
                      <Calendar size={12} />
                      {t.log_hari_ini}
                  </button>
              )}
          </div>

          {/* Month Navigator */}
          <div className="flex items-center justify-between bg-bg-card border border-border px-3 py-2 rounded-xl">
              <button 
                  onClick={handlePrevMonth}
                  className="p-2 hover:bg-bg-main rounded-lg text-text-secondary hover:text-primary transition-colors cursor-pointer active:scale-95"
              >
                  <ChevronLeft size={20} />
              </button>
              <span className="text-sm font-bold text-text-primary text-center flex-1 capitalize">
                  {format(viewMonth, 'MMMM yyyy', { locale: dateLocale })}
              </span>
              <button 
                  onClick={handleNextMonth}
                  className="p-2 hover:bg-bg-main rounded-lg text-text-secondary hover:text-primary transition-colors cursor-pointer active:scale-95"
              >
                  <ChevronRight size={20} />
              </button>
          </div>
      </div>

      {/* Calendar View */}
      <div className="bg-bg-card border border-border rounded-[24px] p-5 shadow-[0_2px_16px_rgba(0,0,0,0.06)] max-w-[480px] mx-auto">
          <div className="grid grid-cols-7 gap-y-3 gap-x-1 mb-2">
              {[t.hari_sen, t.hari_sel, t.hari_rab, t.hari_kam, t.hari_jum, t.hari_sab, t.hari_min].map(d => (
                  <div key={d} className="text-center text-[10px] font-bold text-text-muted uppercase tracking-widest">{d}</div>
              ))}
              {/* Empty cells before month start */}
              {Array.from({ length: (viewMonth.getDay() + 6) % 7 }).map((_, i) => (
                  <div key={`empty-${i}`} />
              ))}
              {/* Days */}
              {eachDayOfInterval({ start: viewMonth, end: endOfMonth(viewMonth) }).map(day => {
                  const dKey = format(day, 'yyyy-MM-dd');
                  const cals = logsByDate[dKey] || 0;
                  const isSel = isSameDay(day, selectedDate);
                  const isTdy = isToday(day);
                  const isFuture = isAfter(day, startOfDay(new Date()));
                  
                  return (
                      <button 
                          key={dKey}
                          onClick={() => setSelectedDate(day)}
                          disabled={isFuture}
                          className={`aspect-square rounded-full flex items-center justify-center relative text-sm font-bold transition-all ${
                              isFuture ? 'opacity-30 cursor-not-allowed text-text-muted' : 'cursor-pointer hover:bg-bg-main'
                          } ${
                              isSel ? 'bg-primary text-white scale-110 shadow-md z-10' : isTdy ? 'bg-border text-text-primary' : (!isFuture ? 'text-text-primary' : '')
                          }`}
                      >
                          {format(day, 'd')}
                          {cals > 0 && <div className={`absolute bottom-0 w-1.5 h-1.5 rounded-full ${isSel ? 'bg-white' : getStatusColor(cals)}`} style={{ transform: 'translateY(50%)' }}></div>}
                      </button>
                  );
              })}
          </div>
      </div>

      <div className="flex items-center justify-between mt-8 mb-2">
          <h3 className="font-bold text-lg text-text-primary tracking-tight">
              {format(selectedDate, 'd MMMM yyyy', { locale: dateLocale })}
          </h3>
          <span className="text-sm font-bold text-primary bg-primary/10 px-3 py-1 rounded-lg">
              {logsForSelectedDate.reduce((acc, log) => acc + log.kalori, 0)} kcal
          </span>
      </div>

      {loading ? (
          <div className="flex justify-center p-8">
              <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
          </div>
      ) : logsForSelectedDate.length === 0 ? (
          <div className="text-center py-8 px-6 bg-bg-card rounded-[24px] border border-border border-dashed flex flex-col items-center">
              <span className="text-4xl mb-3 opacity-50">🍃</span>
              <p className="text-sm font-bold text-text-secondary">Belum ada makanan</p>
              <p className="text-xs text-text-muted mt-1">Tidak ada catatan pada hari ini.</p>
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
