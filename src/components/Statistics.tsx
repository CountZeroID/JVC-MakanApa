import { useState, useEffect } from 'react';
import { getLogsForDateRange, FoodLog } from '../lib/firebase';
import { generateWeeklyInsights } from '../lib/gemini';
import { format, subDays, differenceInDays, startOfWeek, addDays } from 'date-fns';
import { id, enUS } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Flame, RefreshCw, Trophy, Medal, Award, Crown } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { useSettings } from '../contexts/SettingsContext';
import { useUnits } from '../hooks/useUnits';

export default function Statistics({ targetKalori }: { targetKalori: number }) {
  const { settings } = useSettings();
  const dateLocale = settings.language === 'en' ? enUS : id;
  const t = useTranslation();
  const { unitLabel } = useUnits();
  const [allLogs, setAllLogs] = useState<FoodLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<string[]>([]);
  const [generatingInsights, setGeneratingInsights] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    // Only fetch last 14 days (current week + previous week) instead of entire history
    const startDate = format(subDays(new Date(), 13), 'yyyy-MM-dd');
    const endDate = format(new Date(), 'yyyy-MM-dd');
    const data = await getLogsForDateRange(startDate, endDate);
    setAllLogs(data);
    setLoading(false);
  };

  const today = new Date();
  
  // -- GET WEEK LOGS --
  const startOfCurrentWeek = startOfWeek(today, { weekStartsOn: 1 });
  const weekDays = Array.from({length: 7}, (_, i) => {
      const d = addDays(startOfCurrentWeek, i);
      return {
          date: d,
          dateKey: format(d, 'yyyy-MM-dd'),
          label: format(d, 'EEE', { locale: dateLocale })
      };
  });

  const weekLogs = allLogs.filter(l => weekDays.some(wd => wd.dateKey === l.date_key));
  const startOfPreviousWeek = subDays(startOfCurrentWeek, 7);
  const previousWeekDays = Array.from({length: 7}, (_, i) => format(addDays(startOfPreviousWeek, i), 'yyyy-MM-dd'));
  const previousWeekLogs = allLogs.filter(l => previousWeekDays.includes(l.date_key));

  // -- SECTION 1: Ringkasan Minggu Ini --
  const chartData = weekDays.map(day => {
      const dayLogs = weekLogs.filter(l => l.date_key === day.dateKey);
      const cals = dayLogs.reduce((sum, l) => sum + (Number(l.kalori) || 0), 0);
      const karbo = dayLogs.reduce((sum, l) => sum + (Number(l.karbohidrat_g) || 0), 0);
      const protein = dayLogs.reduce((sum, l) => sum + (Number(l.protein_g) || 0), 0);
      const lemak = dayLogs.reduce((sum, l) => sum + (Number(l.lemak_g) || 0), 0);
      return { ...day, kalori: cals, karbo, protein, lemak };
  });

  const daysOnTarget = chartData.filter(d => d.kalori > 0 && d.kalori <= targetKalori + (targetKalori*0.1) && d.kalori >= targetKalori - (targetKalori*0.2)).length;
  
  const currentWeekAvg = Math.round(weekLogs.reduce((acc, l) => acc + l.kalori, 0) / 7);
  const previousWeekAvg = Math.round(previousWeekLogs.reduce((acc, l) => acc + l.kalori, 0) / 7);
  const isCalsDown = previousWeekAvg > 0 && currentWeekAvg < previousWeekAvg;
  const calsDiffPerc = previousWeekAvg > 0 ? Math.round(Math.abs((currentWeekAvg - previousWeekAvg) / previousWeekAvg * 100)) : 0;

  // -- SECTION 2: Keseimbangan Nutrisi --
  const totalKarbo = weekLogs.reduce((sum, l) => sum + (Number(l.karbohidrat_g) || 0), 0) * 4;
  const totalProtein = weekLogs.reduce((sum, l) => sum + (Number(l.protein_g) || 0), 0) * 4;
  const totalLemak = weekLogs.reduce((sum, l) => sum + (Number(l.lemak_g) || 0), 0) * 9;
  const totalMacroCals = totalKarbo + totalProtein + totalLemak;

  const karboPerc = totalMacroCals ? Math.round((totalKarbo/totalMacroCals)*100) : 0;
  const proteinPerc = totalMacroCals ? Math.round((totalProtein/totalMacroCals)*100) : 0;
  const lemakPerc = totalMacroCals ? Math.round((totalLemak/totalMacroCals)*100) : 0;
  
  const macroData = [
    { name: 'Karbo', value: karboPerc, fill: '#F59E0B' }, // warning
    { name: 'Protein', value: proteinPerc, fill: '#10B981' }, // success
    { name: 'Lemak', value: lemakPerc, fill: '#EF4444' } // error
  ];

  const getMacroStatus = (type: string, val: number) => {
      if (type === 'Karbo') {
        if (val < 45) return t.status_kurang;
        if (val > 65) return t.status_berlebih;
        return t.status_seimbang;
      }
      if (type === 'Protein') {
          if (val < 15) return t.status_kurang;
          if (val > 25) return t.status_berlebih;
          return t.status_seimbang;
      }
      if (type === 'Lemak') {
          if (val < 20) return t.status_kurang;
          if (val > 35) return t.status_berlebih;
          return t.status_seimbang;
      }
      return t.status_seimbang;
  };

  // Vitamins & Minerals
  const vitamins = {
      kalsium_mg: Math.round(weekLogs.reduce((sum, l) => sum + (l.kalsium_mg || 0), 0) / 7),
      zat_besi_mg: Math.round(weekLogs.reduce((sum, l) => sum + (l.zat_besi_mg || 0), 0) / 7),
      vitamin_c_mg: Math.round(weekLogs.reduce((sum, l) => sum + (l.vitamin_c_mg || 0), 0) / 7),
  };

  // -- SECTION 3: Streak & Pencapaian --
  const getStreaks = () => {
    let current = 0;
    let longest = 0;
    
    // Group all dates
    const loggedDates = [...new Set(allLogs.map(l => l.date_key))].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    
    let tempStreak = 0;
    let prevDate: Date | null = null;
    
    // calculate longest
    const ascDates = [...loggedDates].reverse();
    for (let i = 0; i < ascDates.length; i++) {
        const d = new Date(ascDates[i]);
        if (!prevDate) {
            tempStreak = 1;
        } else {
            const diff = differenceInDays(d, prevDate);
            if (diff === 1) {
                tempStreak++;
            } else if (diff > 1) {
                tempStreak = 1;
            }
        }
        if (tempStreak > longest) longest = tempStreak;
        prevDate = d;
    }

    // calculate current
    if (loggedDates.length > 0) {
        const first = new Date(loggedDates[0]);
        const diffToday = differenceInDays(today, first);
        if (diffToday <= 1) {
            current = 1;
            let checkDate = first;
            for (let i = 1; i < loggedDates.length; i++) {
                const nextD = new Date(loggedDates[i]);
                if (differenceInDays(checkDate, nextD) === 1) {
                    current++;
                    checkDate = nextD;
                } else {
                    break;
                }
            }
        }
    }
    return { current, longest, totalDays: loggedDates.length };
  };

  const streaks = getStreaks();
  const totalMeals = allLogs.length;

  // -- SECTION 4: Makanan Terfavorit --
  const foodCounts: Record<string, {name: string, emoji: string, count: number, totalCals: number}> = {};
  weekLogs.forEach(l => {
      if (!foodCounts[l.nama_makanan]) {
          foodCounts[l.nama_makanan] = { name: l.nama_makanan, emoji: l.emoji, count: 0, totalCals: 0 };
      }
      foodCounts[l.nama_makanan].count++;
      foodCounts[l.nama_makanan].totalCals += l.kalori;
  });
  const topFoods = Object.values(foodCounts)
      .sort((a,b) => b.count - a.count)
      .slice(0, 5);

  // -- SECTION 5: Insight AI --
  const generateInsights = async () => {
      if (weekLogs.length === 0) {
          setInsights([t.insight_empty]);
          return;
      }
      setGeneratingInsights(true);
      const metricsStr = `
Rata-rata Kalori: ${currentWeekAvg} (Target: ${targetKalori})
Persentase Makro: Karbo ${karboPerc}%, Protein ${proteinPerc}%, Lemak ${lemakPerc}%
Hari sesuai target: ${daysOnTarget}/7
Makanan favorit: ${topFoods.map(f => f.name).join(', ')}
`;
      const aiInsights = await generateWeeklyInsights(metricsStr);
      setInsights(aiInsights.length > 0 ? aiInsights : [t.insight_perbarui]);
      setGeneratingInsights(false);
  };

  useEffect(() => {
      if (!loading && insights.length === 0) {
          generateInsights();
      }
  }, [loading]);


  return (
    <div className="p-5 relative min-h-full pb-8">
      <h2 className="text-2xl font-extrabold font-heading text-primary mb-6 tracking-tight">{t.statistik_title}</h2>

      {loading ? (
        <div className="space-y-8 animate-pulse pb-20">
            {/* Weekly summary skeleton */}
            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="h-5 w-36 bg-border rounded-lg"></div>
                    <div className="h-4 w-28 bg-border rounded-md"></div>
                </div>
                <div className="bg-bg-card p-5 rounded-[24px] border border-border space-y-4">
                    <div className="flex items-baseline justify-between">
                        <div className="space-y-2">
                            <div className="h-3 w-24 bg-border rounded"></div>
                            <div className="h-8 w-20 bg-border rounded-lg"></div>
                        </div>
                        <div className="h-6 w-20 bg-border rounded-lg"></div>
                    </div>
                    {/* Chart placeholder */}
                    <div className="w-full h-40 bg-border/30 rounded-xl flex items-end justify-around px-4 pb-4 gap-2">
                        {[60, 80, 45, 90, 70, 55, 40].map((h, i) => (
                            <div key={i} className="flex-1 bg-border rounded-md" style={{ height: `${h}%` }}></div>
                        ))}
                    </div>
                </div>
                {/* Macro trend skeleton */}
                <div className="bg-bg-card p-5 rounded-[24px] border border-border space-y-4">
                    <div className="h-3 w-20 bg-border rounded"></div>
                    <div className="w-full h-32 bg-border/30 rounded-xl"></div>
                </div>
            </section>
            {/* Insight cards skeleton */}
            <section className="space-y-4">
                <div className="h-5 w-28 bg-border rounded-lg"></div>
                <div className="bg-bg-card p-5 rounded-[24px] border border-border space-y-3">
                    <div className="h-4 w-full bg-border rounded-lg"></div>
                    <div className="h-4 w-3/4 bg-border rounded-lg"></div>
                    <div className="h-4 w-5/6 bg-border rounded-lg"></div>
                </div>
            </section>
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            {/* SECTION 1 — Ringkasan Minggu Ini */}
            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-bold text-lg text-text-primary tracking-tight">{t.ringkasan_minggu}</h3>
                    <div className="text-[10px] font-bold text-text-muted bg-border/40 px-2.5 py-1 rounded-md uppercase tracking-widest">
                        {previousWeekAvg > 0 ? (
                            isCalsDown ? `↓ ${calsDiffPerc}% ${t.dari_mg_lalu}` : `↑ ${calsDiffPerc}% ${t.dari_mg_lalu}`
                        ) : '-'}
                    </div>
                </div>

                <div className="bg-bg-card p-5 rounded-[24px] shadow-[0_2px_16px_rgba(0,0,0,0.06)] border border-border">
                    <div className="flex items-baseline justify-between mb-6">
                        <div>
                            <p className="text-[10px] text-text-secondary font-bold uppercase tracking-widest mb-1">{t.rata_rata_harian}</p>
                            <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-black text-primary font-mono tracking-tight leading-none">{currentWeekAvg}</span>
                                <span className="text-[10px] uppercase font-bold text-text-muted">{t.label_kcal}</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="inline-flex items-center gap-1 bg-success/10 text-success text-xs font-bold px-2.5 py-1 rounded-lg">
                                ✓ {daysOnTarget}/7 {t.hari_streak}
                            </span>
                        </div>
                    </div>

                    <div className="w-full h-40">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#8F8A9B', fontWeight: 700 }} dy={10} interval={0} />
                                <YAxis hide domain={[0, 'dataMax + 200']} />
                                <RechartsTooltip 
                                    cursor={{fill: 'transparent'}}
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="bg-text-primary text-white text-[10px] font-bold px-2 py-1 rounded shadow-md">
                                                    {payload[0].value} kkal
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Bar dataKey="kalori" radius={[6, 6, 6, 6]}>
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.dateKey === format(today, 'yyyy-MM-dd') ? '#7B61FF' : '#D1C8FF'} />
                                    ))}
                                </Bar>
                                <ReferenceLine y={targetKalori} stroke="#10B981" strokeDasharray="3 3" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-bg-card p-5 rounded-[24px] shadow-[0_2px_16px_rgba(0,0,0,0.06)] border border-border">
                    <p className="text-[10px] text-text-secondary font-bold uppercase tracking-widest mb-4">{t.tren_makro}</p>
                    <div className="w-full h-32">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#8F8A9B', fontWeight: 600 }} dy={5} interval={0} />
                                <YAxis hide />
                                <RechartsTooltip 
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="bg-white border border-border shadow-md rounded-lg p-2 text-[10px] font-bold">
                                                    <div className="text-warning">{t.label_karbo}: {payload[0].value}{unitLabel.gram}</div>
                                                    <div className="text-success">{t.label_protein}: {payload[1].value}{unitLabel.gram}</div>
                                                    <div className="text-error">{t.label_lemak}: {payload[2].value}{unitLabel.gram}</div>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Line type="monotone" dataKey="karbo" stroke="#F59E0B" strokeWidth={2} dot={false} />
                                <Line type="monotone" dataKey="protein" stroke="#10B981" strokeWidth={2} dot={false} />
                                <Line type="monotone" dataKey="lemak" stroke="#EF4444" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </section>

            {/* SECTION 2 — Keseimbangan Nutrisi */}
            <section className="space-y-4">
                <h3 className="font-bold text-lg text-text-primary tracking-tight">{t.keseimbangan}</h3>
                <div className="bg-bg-card p-5 rounded-[24px] shadow-[0_2px_16px_rgba(0,0,0,0.06)] border border-border flex flex-col sm:flex-row items-center gap-6">
                    <div className="w-32 h-32 shrink-0 relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={macroData}
                                    innerRadius={45}
                                    outerRadius={60}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    
                    <div className="flex-1 w-full space-y-4">
                        <div className="flex justify-between items-center text-sm font-bold">
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-warning"></div>{t.label_karbo} ({karboPerc}%)</div>
                            <span className="text-[10px] uppercase font-bold text-text-muted px-2 py-0.5 rounded-full border border-border bg-bg-main shadow-sm">{getMacroStatus('Karbo', karboPerc)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm font-bold">
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-success"></div>{t.label_protein} ({proteinPerc}%)</div>
                            <span className="text-[10px] uppercase font-bold text-text-muted px-2 py-0.5 rounded-full border border-border bg-bg-main shadow-sm">{getMacroStatus('Protein', proteinPerc)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm font-bold">
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-error"></div>{t.label_lemak} ({lemakPerc}%)</div>
                            <span className="text-[10px] uppercase font-bold text-text-muted px-2 py-0.5 rounded-full border border-border bg-bg-main shadow-sm">{getMacroStatus('Lemak', lemakPerc)}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-bg-card p-5 rounded-[24px] shadow-[0_2px_16px_rgba(0,0,0,0.06)] border border-border">
                    <p className="text-[10px] text-text-secondary font-bold uppercase tracking-widest mb-4">{t.rata_rata_vitamin}</p>
                    <div className="space-y-3">
                        {[
                            { label: 'Kalsium', val: vitamins.kalsium_mg, akg: 1000, unit: 'mg', icon: '🥛' },
                            { label: 'Zat Besi', val: vitamins.zat_besi_mg, akg: 18, unit: 'mg', icon: '🥩' },
                            { label: 'Vit C', val: vitamins.vitamin_c_mg, akg: 90, unit: 'mg', icon: '🍊' },
                        ].map((v, i) => {
                            const perc = Math.min(100, (v.val / v.akg) * 100);
                            return (
                                <div key={i} className="space-y-1">
                                    <div className="flex justify-between text-xs font-bold text-text-primary">
                                        <span>{v.icon} {v.label}</span>
                                        <span className="text-text-muted">{v.val}{v.unit} <span className="font-medium text-[10px]">/ {v.akg}{v.unit}</span></span>
                                    </div>
                                    <div className="w-full h-2 bg-bg-main rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full transition-all duration-700 ${perc >= 100 ? 'bg-success' : 'bg-primary'}`} style={{ width: `${perc}%` }}></div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </section>

            {/* SECTION 3 — Streak & Pencapaian */}
            <section className="space-y-4">
                <h3 className="font-bold text-lg text-text-primary tracking-tight">{t.streak_title}</h3>
                
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gradient-to-br from-[#FFF0E5] to-[#FFECD9] dark:from-[#EA580C]/20 dark:to-[#EA580C]/10 p-5 rounded-[24px] border border-[#FFD8B5] dark:border-[#EA580C]/30 relative overflow-hidden group">
                        <div className="relative z-10">
                            <p className="text-[10px] text-[#D97706] font-bold uppercase tracking-widest mb-1">{t.streak_terkini}</p>
                            <div className="flex items-baseline gap-1">
                                <span className="text-4xl font-black text-[#EA580C] font-mono tracking-tight">{streaks.current}</span>
                                <span className="text-xs uppercase font-bold text-[#F59E0B]">{t.hari_title}</span>
                            </div>
                        </div>
                        <Flame size={64} className="absolute -bottom-4 -right-2 text-[#F97316] opacity-20 group-hover:scale-110 transition-transform duration-500" />
                    </div>
                    
                    <div className="bg-bg-card p-5 rounded-[24px] border border-border flex flex-col justify-between">
                        <p className="text-[10px] text-text-secondary font-bold uppercase tracking-widest mb-1">{t.rekor_terbaik}</p>
                        <div className="flex items-center gap-2">
                            <Trophy size={20} className="text-warning" />
                            <span className="font-bold text-text-primary">{streaks.longest} {t.hari_title}</span>
                        </div>
                        
                        <div className="mt-4 pt-4 border-t border-border/50">
                            <p className="text-[10px] text-text-secondary font-bold uppercase tracking-widest mb-1">{t.total_makanan}</p>
                            <span className="font-bold text-text-primary">{totalMeals}x {t.disimpan}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-bg-card p-5 rounded-[24px] border border-border grid grid-cols-4 gap-2">
                    {[
                        { days: 3, icon: Medal, color: streaks.longest >= 3 ? 'text-[#CD7F32] bg-[#CD7F32]/10' : 'text-border bg-bg-main' },
                        { days: 7, icon: Medal, color: streaks.longest >= 7 ? 'text-[#94A3B8] bg-[#94A3B8]/10' : 'text-border bg-bg-main' },
                        { days: 14, icon: Award, color: streaks.longest >= 14 ? 'text-[#FBBF24] bg-[#FBBF24]/10' : 'text-border bg-bg-main' },
                        { days: 30, icon: Crown, color: streaks.longest >= 30 ? 'text-primary bg-primary/10' : 'text-border bg-bg-main' },
                    ].map((badge, idx) => (
                        <div key={idx} className="flex flex-col items-center gap-2 text-center">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${badge.color} border border-white`}>
                                <badge.icon size={24} />
                            </div>
                            <span className="text-[10px] font-bold text-text-secondary">{badge.days} {t.hari_title}</span>
                        </div>
                    ))}
                </div>
            </section>

            {/* SECTION 4 — Makanan Terfavorit */}
            <section className="space-y-4">
                <h3 className="font-bold text-lg text-text-primary tracking-tight">{t.makanan_favorit}</h3>
                <div className="bg-bg-card border border-border rounded-[24px] overflow-hidden">
                    {topFoods.length > 0 ? topFoods.map((food, idx) => (
                        <div key={idx} className="flex items-center justify-between p-4 border-b border-border/50 last:border-0 hover:bg-bg-main transition-colors">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-white rounded-[16px] shadow-sm flex items-center justify-center text-2xl border border-border/40 shrink-0">
                                    {food.emoji}
                                </div>
                                <div className="min-w-0 pr-4">
                                    <h4 className="font-bold text-text-primary text-sm truncate">{food.name}</h4>
                                    <p className="text-[11px] font-medium text-text-muted mt-0.5">{food.count}x {t.log_minggu.toLowerCase()}</p>
                                </div>
                            </div>
                            <div className="text-right shrink-0">
                                <span className="font-black text-primary font-mono">{Math.round(food.totalCals / food.count)}</span>
                                <span className="text-[10px] text-text-muted font-bold tracking-widest uppercase ml-1">kcal</span>
                            </div>
                        </div>
                    )) : (
                        <div className="p-8 text-center text-text-muted text-sm font-medium">{t.belum_ada_makanan}</div>
                    )}
                </div>
            </section>

            {/* SECTION 5 — Insight AI (weekly) */}
            <section className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-lg text-text-primary tracking-tight">{t.insight_nara}</h3>
                    <button 
                        onClick={generateInsights}
                        disabled={generatingInsights}
                        className="w-8 h-8 rounded-full bg-white border border-border shadow-sm flex items-center justify-center text-text-muted hover:text-primary transition-colors disabled:opacity-50"
                    >
                        <RefreshCw size={14} className={generatingInsights ? "animate-spin text-primary" : ""} />
                    </button>
                </div>
                
                <div className="bg-gradient-to-br from-[#F5F3FF] to-[#EDE9FF] dark:from-primary/20 dark:to-primary/10 border border-primary/20 p-5 rounded-[24px] shadow-sm relative overflow-hidden">
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-2xl"></div>
                    <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-primary/5 rounded-full blur-2xl"></div>
                    
                    <div className="relative z-10 flex flex-col gap-4">
                        {generatingInsights ? (
                            <div className="py-4 px-2 space-y-3">
                                <div className="h-4 bg-primary/10 rounded animate-pulse w-3/4"></div>
                                <div className="h-4 bg-primary/10 rounded animate-pulse w-full"></div>
                                <div className="h-4 bg-primary/10 rounded animate-pulse w-5/6"></div>
                            </div>
                        ) : (
                            insights.map((insight, idx) => (
                                <div key={idx} className="flex items-start gap-4 bg-white/60 dark:bg-black/20 p-4 rounded-[20px] backdrop-blur-md">
                                    <span className="text-2xl leading-none">💡</span>
                                    <p className="text-sm font-medium text-text-primary leading-relaxed">{insight}</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </section>
        </div>
      )}
    </div>
  );
}
