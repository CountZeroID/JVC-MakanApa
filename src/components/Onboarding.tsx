import React, { useState } from 'react';
import { ChevronRight, Check, ArrowRight } from 'lucide-react';
import { saveUserProfile } from '../lib/firebase';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from '../hooks/useTranslation';

const TUJUAN_OPTIONS = (t: Record<string, string>) => [
  { id: 'diet', label: t.goal_diet, icon: '🔥' },
  { id: 'bulking', label: t.goal_bulking, icon: '💪' },
  { id: 'maintenance', label: t.goal_maintain, icon: '⚖️' },
  { id: 'medis', label: t.goal_medis, icon: '🏥' },
  { id: 'sehat', label: t.goal_sehat, icon: '🌱' }
];

const ALERGI_OPTIONS = [
  'Laktosa', 'Gluten', 'Seafood', 'Kacang-kacangan', 'Telur', 'Kedelai', 'Vegetarian', 'Vegan', 'Halal only'
];

interface OnboardingProps {
  onComplete: (name: string, targetCal: number) => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const t = useTranslation();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Form State
  const [nama, setNama] = useState('');
  const [usia, setUsia] = useState('');
  const [gender, setGender] = useState<'L' | 'P'>('L');
  const [berat, setBerat] = useState('');
  const [tinggi, setTinggi] = useState('');
  const [tujuan, setTujuan] = useState('');
  const [alergi, setAlergi] = useState<string[]>([]);
  const [tidakAdaAlergi, setTidakAdaAlergi] = useState(false);

  // Validation
  const isStep1Valid = nama.trim() !== '' && usia !== '' && berat !== '' && tinggi !== '';
  const isStep2Valid = tujuan !== '';

  const handleToggleAlergi = (item: string) => {
    if (tidakAdaAlergi) setTidakAdaAlergi(false);
    if (alergi.includes(item)) {
      setAlergi(alergi.filter(a => a !== item));
    } else {
      setAlergi([...alergi, item]);
    }
  };

  const handleTidakAdaAlergi = () => {
    setTidakAdaAlergi(true);
    setAlergi([]);
  };

  const handleSubmit = async () => {
    setLoading(true);
    
    // Calculate BMR using Mifflin-St Jeor formula
    const w = parseFloat(berat);
    const h = parseFloat(tinggi);
    const a = parseInt(usia);
    
    let bmr = 0;
    if (gender === 'L') {
      bmr = (10 * w) + (6.25 * h) - (5 * a) + 5;
    } else {
      bmr = (10 * w) + (6.25 * h) - (5 * a) - 161;
    }

    // Multiply by activity factor 1.375 (lightly active)
    let tdee = bmr * 1.375;
    
    // Adjust based on goal
    if (tujuan === 'diet') {
      tdee -= 300;
    } else if (tujuan === 'bulking') {
      tdee += 400;
    }

    const targetCal = Math.round(tdee);
    
    // Calculate macros
    const proteinG = Math.round(w * 0.8);
    const fatG = Math.round((targetCal * 0.25) / 9);
    const carbsG = Math.round((targetCal - ((proteinG * 4) + (fatG * 9))) / 4);

    try {
      await saveUserProfile({
        nama,
        usia: a,
        gender: gender === 'L' ? 'Laki-laki' : 'Perempuan',
        berat_kg: w,
        tinggi_cm: h,
        tujuan,
        alergi: tidakAdaAlergi ? ["Tidak ada"] : alergi,
        target_kalori: targetCal,
        target_protein_g: proteinG,
        target_karbo_g: carbsG,
        target_lemak_g: fatG
      });
      
      onComplete(nama, targetCal);
    } catch (error) {
      console.error(error);
      alert("Gagal menyimpan profil, coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-bg-main overflow-y-auto">
      <div className="h-full flex flex-col max-w-lg mx-auto bg-white min-h-screen relative shadow-2xl">
        {/* Progress header */}
        <div className="absolute top-0 inset-x-0 p-6 flex justify-between items-center z-10">
            <div className="flex gap-2">
                {[1, 2, 3].map(i => (
                    <div 
                        key={i} 
                        className={cn(
                            "h-2 w-12 rounded-full transition-all duration-300",
                            step >= i ? "bg-primary" : "bg-bg-main border border-border"
                        )}
                    />
                ))}
            </div>
            <span className="text-sm font-bold text-text-muted">{step}/3</span>
        </div>

        <div className="flex-1 px-8 pt-24 pb-32">
            <AnimatePresence mode="wait">
                {step === 1 && (
                    <motion.div
                        key="step1"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-8"
                    >
                        <div>
                            <h1 className="text-3xl font-black font-heading text-primary tracking-tight mb-2">{t.onboard_profil}</h1>
                            <p className="text-sm text-text-secondary font-medium">{t.onboard_profil_sub}</p>
                        </div>

                        <div className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-text-muted uppercase tracking-widest mb-2">{t.nama_panggilan}</label>
                                <input 
                                    type="text" 
                                    value={nama}
                                    onChange={e => setNama(e.target.value)}
                                    placeholder={t.nama_placeholder}
                                    className="w-full bg-bg-main border-transparent rounded-[16px] px-5 py-4 font-bold text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-text-muted/50"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-text-muted uppercase tracking-widest mb-2">{t.label_usia}</label>
                                    <div className="relative">
                                        <input 
                                            type="number" 
                                            value={usia}
                                            onChange={e => setUsia(e.target.value)}
                                            placeholder="25"
                                            className="w-full bg-bg-main border-transparent rounded-[16px] px-5 py-4 font-bold text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                        />
                                        <span className="absolute right-5 top-1/2 -translate-y-1/2 text-sm text-text-muted font-bold">Thn</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-text-muted uppercase tracking-widest mb-2">{t.label_gender}</label>
                                    <div className="flex bg-bg-main p-1.5 rounded-[16px]">
                                        <button 
                                            className={cn("flex-1 py-2.5 rounded-xl text-sm font-bold transition-all", gender === 'L' ? "bg-white shadow-sm text-primary" : "text-text-muted")}
                                            onClick={() => setGender('L')}
                                        >L</button>
                                        <button 
                                            className={cn("flex-1 py-2.5 rounded-xl text-sm font-bold transition-all", gender === 'P' ? "bg-white shadow-sm text-primary" : "text-text-muted")}
                                            onClick={() => setGender('P')}
                                        >P</button>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-text-muted uppercase tracking-widest mb-2">{t.label_berat}</label>
                                    <div className="relative">
                                        <input 
                                            type="number" 
                                            value={berat}
                                            onChange={e => setBerat(e.target.value)}
                                            placeholder="65"
                                            className="w-full bg-bg-main border-transparent rounded-[16px] px-5 py-4 font-bold text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                        />
                                        <span className="absolute right-5 top-1/2 -translate-y-1/2 text-sm text-text-muted font-bold">kg</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-text-muted uppercase tracking-widest mb-2">{t.label_tinggi}</label>
                                    <div className="relative">
                                        <input 
                                            type="number" 
                                            value={tinggi}
                                            onChange={e => setTinggi(e.target.value)}
                                            placeholder="170"
                                            className="w-full bg-bg-main border-transparent rounded-[16px] px-5 py-4 font-bold text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                        />
                                        <span className="absolute right-5 top-1/2 -translate-y-1/2 text-sm text-text-muted font-bold">cm</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="fixed bottom-0 inset-x-0 p-6 bg-gradient-to-t from-white via-white to-transparent max-w-lg mx-auto">
                            <button
                                disabled={!isStep1Valid}
                                onClick={() => setStep(2)}
                                className="w-full bg-primary text-white font-bold text-lg py-5 rounded-[20px] flex items-center justify-center gap-2 hover:bg-primary-light transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_8px_30px_rgba(45,106,79,0.25)] hover:-translate-y-0.5 active:translate-y-0"
                            >
                                {t.btn_lanjut} <ChevronRight size={20} />
                            </button>
                        </div>
                    </motion.div>
                )}

                {step === 2 && (
                    <motion.div
                        key="step2"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-8"
                    >
                        <div>
                            <h1 className="text-3xl font-black font-heading text-primary tracking-tight mb-2">{t.onboard_tujuan}</h1>
                            <p className="text-sm text-text-secondary font-medium">{t.onboard_tujuan_sub}</p>
                        </div>

                        <div className="space-y-3">
                            {TUJUAN_OPTIONS(t).map(opt => (
                                <button
                                    key={opt.id}
                                    onClick={() => setTujuan(opt.id)}
                                    className={cn(
                                        "w-full flex items-center p-5 rounded-[20px] border transition-all text-left group",
                                        tujuan === opt.id 
                                            ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary" 
                                            : "border-border bg-bg-main hover:border-primary-light"
                                    )}
                                >
                                    <span className="text-3xl mr-4">{opt.icon}</span>
                                    <span className={cn("font-bold text-base flex-1 transition-colors", tujuan === opt.id ? "text-primary" : "text-text-primary")}>{opt.label}</span>
                                    {tujuan === opt.id && <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center"><Check size={14} className="text-white" /></div>}
                                </button>
                            ))}
                        </div>

                        <div className="fixed bottom-0 inset-x-0 p-6 bg-gradient-to-t from-white via-white to-transparent max-w-lg mx-auto">
                            <button
                                disabled={!isStep2Valid}
                                onClick={() => setStep(3)}
                                className="w-full bg-primary text-white font-bold text-lg py-5 rounded-[20px] flex items-center justify-center gap-2 hover:bg-primary-light transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_8px_30px_rgba(45,106,79,0.25)] hover:-translate-y-0.5 active:translate-y-0"
                            >
                                {t.btn_lanjut} <ChevronRight size={20} />
                            </button>
                        </div>
                    </motion.div>
                )}

                {step === 3 && (
                    <motion.div
                        key="step3"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-8"
                    >
                        <div>
                            <h1 className="text-3xl font-black font-heading text-primary tracking-tight mb-2">{t.onboard_alergi}</h1>
                            <p className="text-sm text-text-secondary font-medium">{t.onboard_alergi_sub}</p>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <button
                                onClick={handleTidakAdaAlergi}
                                className={cn(
                                    "px-5 py-3 rounded-[16px] font-bold text-sm transition-all border",
                                    tidakAdaAlergi 
                                        ? "bg-primary text-white border-primary shadow-sm" 
                                        : "bg-bg-main text-text-secondary border-border hover:border-primary-light"
                                )}
                            >
                                ✅ {t.tidak_ada_alergi ? t.tidak_ada_alergi.replace('.', '') : "Tidak ada"}
                            </button>
                            
                            {ALERGI_OPTIONS.map(opt => (
                                <button
                                    key={opt}
                                    onClick={() => handleToggleAlergi(opt)}
                                    className={cn(
                                        "px-5 py-3 rounded-[16px] font-bold text-sm transition-all border",
                                        alergi.includes(opt) 
                                            ? "bg-primary-light text-white border-primary-light shadow-sm" 
                                            : "bg-bg-main text-text-secondary border-border hover:border-primary-light"
                                    )}
                                >
                                    {(t as any)[`alergi_${opt.toLowerCase().replace(/ /g, '_').replace('-', '_')}`] || opt}
                                </button>
                            ))}
                        </div>

                        <div className="fixed bottom-0 inset-x-0 p-6 bg-gradient-to-t from-white via-white to-transparent max-w-lg mx-auto">
                            <button
                                disabled={!tidakAdaAlergi && alergi.length === 0}
                                onClick={handleSubmit}
                                className="w-full bg-primary text-white font-bold text-lg py-5 rounded-[20px] flex items-center justify-center gap-2 hover:bg-primary-light transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_8px_30px_rgba(45,106,79,0.25)] hover:-translate-y-0.5 active:translate-y-0"
                            >
                                {loading ? "Menghitung..." : t.btn_selesai} <ArrowRight size={20} />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
