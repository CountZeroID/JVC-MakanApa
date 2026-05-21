import { useState, useRef, useEffect } from 'react';
import { Camera, RefreshCw, AlertTriangle, ChevronDown, Image as ImageIcon, ChevronRight } from 'lucide-react';
import { analyzeFoodImage, FoodAnalysisResult } from '../lib/gemini';
import BottomSheet from './BottomSheet';
import { saveFoodLog, getUserProfile, uploadFoodImage, updateFoodLogImage } from '../lib/firebase';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { useTranslation } from '../hooks/useTranslation';
import { useSettings } from '../contexts/SettingsContext';
import { MacroBar, VitaminBar } from './shared/NutritionBars';

export default function HomeScanner({ onSaveSuccess }: { onSaveSuccess: () => void }) {
  const { settings } = useSettings();
  const t = useTranslation();
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<{data: string, mime: string} | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<FoodAnalysisResult | null>(null);
  const [multiplier, setMultiplier] = useState(1);
  const [isIngredientsExpanded, setIsIngredientsExpanded] = useState(false);
  const [isVitaminsExpanded, setIsVitaminsExpanded] = useState(false);
  const [showSaveSheet, setShowSaveSheet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userAllergies, setUserAllergies] = useState<string[]>([]);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    import('../lib/firebase').then(({ auth }) => {
        if (!auth.currentUser) return;
        getUserProfile(auth.currentUser.uid).then(profile => {
          if (profile && profile.alergi) {
            setUserAllergies(profile.alergi.map(a => (a || '').toLowerCase()));
          }
        }).catch(e => console.error(e));
    });
  }, []);

  const handleImageCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        setError('Pilih file gambar yang valid.');
        return;
    }

    setError(null);
    setResult(null);
    setMultiplier(1);
    setIsIngredientsExpanded(false);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        const MAX_DIMENSION = 600;

        if (width > height && width > MAX_DIMENSION) {
            height = Math.round((height * MAX_DIMENSION) / width);
            width = MAX_DIMENSION;
        } else if (height > MAX_DIMENSION) {
            width = Math.round((width * MAX_DIMENSION) / height);
            height = MAX_DIMENSION;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
            
            setImagePreview(dataUrl);
            
            const base64Data = dataUrl.split(',')[1];
            setImageBase64({ data: base64Data, mime: 'image/jpeg' });
            
            performAnalysis(base64Data, 'image/jpeg');
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const performAnalysis = async (base64: string, mimeType: string) => {
    setIsAnalyzing(true);
    try {
      const data = await analyzeFoodImage(base64, mimeType, settings.language);
      if (data.error) {
        setError(data.error);
        setResult(null);
      } else {
        setResult(data);
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat menganalisis foto.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const resetScanner = () => {
    setImagePreview(null);
    setImageBase64(null);
    setResult(null);
    setError(null);
    setShowSaveSheet(false);
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  };

  const handleSave = async (mealType: "sarapan" | "makan_siang" | "makan_malam" | "camilan") => {
    if (!result || !result.total) return;
    setIsSaving(true);
    try {
      const docId = await saveFoodLog({
        nama_makanan: result.nama_makanan || "Makan",
        emoji: result.emoji || "🍽️",
        kategori: result.kategori || "Makanan",
        meal_type: mealType,
        kalori: Math.round(result.total.kalori * multiplier),
        karbohidrat_g: Math.round(result.total.karbohidrat_g * multiplier),
        protein_g: Math.round(result.total.protein_g * multiplier),
        lemak_g: Math.round(result.total.lemak_g * multiplier),
        serat_g: Math.round(result.total.serat_g * multiplier),
        gula_g: result.total.gula_g ? Math.round(result.total.gula_g * multiplier) : undefined,
        natrium_mg: result.total.natrium_mg ? Math.round(result.total.natrium_mg * multiplier) : undefined,
        kalsium_mg: result.total.kalsium_mg ? Math.round(result.total.kalsium_mg * multiplier) : undefined,
        zat_besi_mg: result.total.zat_besi_mg ? Math.round(result.total.zat_besi_mg * multiplier) : undefined,
        vitamin_c_mg: result.total.vitamin_c_mg ? Math.round(result.total.vitamin_c_mg * multiplier) : undefined,
        vitamin_a_mcg: result.total.vitamin_a_mcg ? Math.round(result.total.vitamin_a_mcg * multiplier) : undefined,
        vitamin_b12_mcg: result.total.vitamin_b12_mcg ? Math.round(result.total.vitamin_b12_mcg * multiplier) : undefined,
        kalium_mg: result.total.kalium_mg ? Math.round(result.total.kalium_mg * multiplier) : undefined,
        is_minuman: result.is_minuman,
        volume_ml: result.volume_ml,
        kafein_mg: result.kafein_mg ? Math.round(result.kafein_mg * multiplier) : undefined,
        catatan_gizi: result.catatan_gizi,
        bahan_makanan: result.bahan_makanan?.map(b => ({
          nama: b.nama,
          estimasi_porsi: b.estimasi_porsi,
          kalori: Math.round(b.kalori * multiplier)
        })),
        date_key: format(new Date(), 'yyyy-MM-dd')
      });

      if (imagePreview && docId) {
          uploadFoodImage(imagePreview).then(url => {
              if (url) updateFoodLogImage(docId, url);
          }).catch(console.error);
      }

      setShowSaveSheet(false);
      onSaveSuccess();
    } catch(e) {
      console.error(e);
      alert("Gagal menyimpan data.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-5 space-y-5">
      <input 
          type="file" 
          accept="image/*" 
          capture="environment" 
          className="hidden" 
          ref={cameraInputRef}
          onChange={(e) => {
              setShowSourceModal(false);
              handleImageCapture(e);
          }}
      />
      <input 
          type="file" 
          accept="image/*" 
          className="hidden" 
          ref={galleryInputRef}
          onChange={(e) => {
              setShowSourceModal(false);
              handleImageCapture(e);
          }}
      />
      {!imagePreview && (
        <div className="flex flex-col items-center justify-center min-h-[50vh] mt-4">
            <button 
                onClick={() => setShowSourceModal(true)}
                className="w-full aspect-[4/3] max-w-[360px] border-[3px] border-dashed border-primary-light/40 rounded-[32px] flex flex-col items-center justify-center gap-4 bg-primary-light/5 hover:bg-primary-light/10 hover:border-primary-light transition-all cursor-pointer group shadow-sm"
            >
                <div className="w-20 h-20 rounded-full bg-bg-card shadow-md flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                    <Camera size={40} />
                </div>
                <div className="text-center">
                    <p className="font-extrabold text-text-primary text-xl font-heading tracking-tight mb-1">{t.upload_title}</p>
                    <p className="text-[10px] uppercase font-bold tracking-wider text-text-muted">{t.upload_subtitle}</p>
                </div>
            </button>
        </div>
      )}

      {imagePreview && (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="w-full aspect-[4/3] rounded-[24px] overflow-hidden shadow-sm relative group bg-border flex items-center justify-center">
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                
                <div className="absolute top-3 left-3 bg-primary text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 shadow-lg">
                    {isAnalyzing ? (
                        <>
                            <div className="w-1.5 h-1.5 bg-primary-light rounded-full animate-pulse"></div>
                            {t.analyzing_1}
                        </>
                    ) : error ? (
                        <>
                            <div className="w-1.5 h-1.5 bg-error rounded-full"></div>
                            {t.error_title}
                        </>
                    ) : (
                        <>
                            <div className="w-1.5 h-1.5 bg-primary-light rounded-full animate-pulse"></div>
                            {t.analisis_berhasil}
                        </>
                    )}
                </div>

                {!isAnalyzing && (
                    <button 
                        onClick={resetScanner}
                        className="absolute top-3 right-3 w-8 h-8 bg-black/40 backdrop-blur rounded-full flex items-center justify-center text-white hover:bg-black/60 shadow-lg transition-colors"
                    >
                        <RefreshCw size={14} />
                    </button>
                )}
            </div>

            {isAnalyzing && (
                <div className="bg-bg-card rounded-[24px] p-8 shadow-[0_2px_16px_rgba(0,0,0,0.06)] border border-border flex flex-col items-center gap-4 animate-pulse">
                    <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                    <p className="text-text-secondary font-semibold text-sm">{t.analyzing_2}</p>
                </div>
            )}

            {error && !isAnalyzing && (
                <div className="bg-bg-card rounded-[24px] p-6 shadow-[0_2px_16px_rgba(0,0,0,0.06)] border border-error/50 flex flex-col items-center text-center gap-4">
                    <AlertTriangle className="text-error" size={32} />
                    <p className="text-error font-medium">{error}</p>
                    <button onClick={resetScanner} className="px-6 py-2.5 bg-error text-white rounded-[14px] text-sm font-bold shadow-md hover:bg-error/90 transition-colors">
                        {t.error_coba_lagi}
                    </button>
                </div>
            )}

            {result && !isAnalyzing && (
                <div className="bg-bg-card rounded-[24px] p-6 shadow-[0_2px_16px_rgba(0,0,0,0.06)] border border-border space-y-6 relative">
                  {/* Allergen Warning */}
                  {(() => {
                      const conflictingAllergens = result.perlu_diperhatikan?.filter(alergen => 
                          userAllergies.some(userAlergi => userAlergi !== 'tidak ada' && ((alergen || '').toLowerCase().includes(userAlergi) || userAlergi.includes((alergen || '').toLowerCase())))
                      );
                      
                      if (conflictingAllergens && conflictingAllergens.length > 0) {
                          return (
                              <div className="bg-[#FEE2E2] border border-[#E63946] p-4 rounded-[16px]">
                                  <div className="flex items-start gap-3">
                                      <AlertTriangle className="text-[#E63946] shrink-0 mt-0.5" size={20} />
                                      <div>
                                          <h4 className="text-[#E63946] font-bold text-sm tracking-tight leading-tight mb-1">
                                              {t.perlu_diperhatikan}: {conflictingAllergens.join(', ')}
                                          </h4>
                                          <p className="text-[#E63946]/90 text-xs font-medium leading-relaxed">
                                              Sesuai profil alergimu, pertimbangkan sebelum mengonsumsi
                                          </p>
                                      </div>
                                  </div>
                              </div>
                          );
                      }
                      return null;
                  })()}

                  {result.confidence === 'rendah' && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-warning text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-sm flex items-center gap-1 whitespace-nowrap">
                          <AlertTriangle size={12} /> {t.confidence_rendah}
                      </div>
                  )}

                  <div className="flex justify-between items-start">
                      <div className="pr-2 flex-1">
                          <div className="inline-block px-3 py-1 bg-bg-main text-primary text-[10px] font-bold uppercase tracking-widest rounded-md mb-2">
                              {result.kategori}
                          </div>
                          <h2 className="text-2xl font-bold text-text-primary leading-tight font-heading mb-1 break-words">
                              {result.nama_makanan} {result.emoji}
                          </h2>
                          <p className="text-xs text-text-secondary leading-relaxed">{result.deskripsi_singkat}</p>
                      </div>
                      <div className="text-right shrink-0 mt-1">
                          <p className="text-text-muted text-[10px] font-bold uppercase tracking-widest mb-1">{t.totalKalori}</p>
                          <div className="flex items-baseline justify-end">
                              <p className="text-4xl font-black text-primary font-mono leading-none tracking-tight">
                                {Math.round((result.total?.kalori || 0) * multiplier)}
                              </p>
                          </div>
                          <p className="text-primary text-xs font-bold leading-none mt-1">{t.label_kcal}</p>
                      </div>
                  </div>

                  {/* Portion Multiplier */}
                  <div className="bg-bg-main p-4 rounded-[20px] border border-border/50">
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-3 text-center">{t.atur_porsi}</p>
                    <div className="grid grid-cols-4 gap-2">
                        {[0.5, 1, 1.5, 2].map((val) => (
                            <button
                                key={val}
                                onClick={() => setMultiplier(val)}
                                className={cn(
                                    "py-2 px-1 rounded-xl text-xs font-bold transition-all border",
                                    multiplier === val 
                                        ? "bg-primary text-white border-primary shadow-md scale-105" 
                                        : "bg-white text-text-primary border-border hover:border-primary-light"
                                )}
                            >
                                {val}x
                            </button>
                        ))}
                    </div>
                  </div>

                  {/* Additional info for drinks */}
                  {result.is_minuman && (
                      <div className="bg-[#E0F2FE] border border-[#BAE6FD] p-4 rounded-[20px] flex justify-around">
                          {result.volume_ml !== undefined && (
                              <div className="text-center">
                                  <p className="text-[10px] text-[#0284C7] font-bold uppercase tracking-widest mb-1">Volume</p>
                                  <p className="font-bold text-[#0369A1]">{Math.round(result.volume_ml * multiplier)} ml</p>
                              </div>
                          )}
                          {result.kafein_mg !== undefined && (
                              <div className="text-center">
                                  <p className="text-[10px] text-[#0284C7] font-bold uppercase tracking-widest mb-1">Kafein</p>
                                  <p className="font-bold text-[#0369A1]">{Math.round(result.kafein_mg * multiplier)} mg</p>
                              </div>
                          )}
                      </div>
                  )}

                  {/* SECTION 1 — Makronutrien */}
                  <div>
                      <h3 className="font-bold text-text-primary mb-3 font-heading text-lg">Makronutrien</h3>
                      <div className="bg-bg-main p-4 rounded-[20px] border border-border/50">
                          <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                              <MacroBar label={t.label_karbo} value={(result.total?.karbohidrat_g || 0) * multiplier} color="bg-warning" max={300} unit={t.label_gram} />
                              <MacroBar label={t.label_protein} value={(result.total?.protein_g || 0) * multiplier} color="bg-success" max={60} unit={t.label_gram} />
                              <MacroBar label={t.label_lemak} value={(result.total?.lemak_g || 0) * multiplier} color="bg-accent" max={70} unit={t.label_gram} />
                              <MacroBar label={t.label_serat} value={(result.total?.serat_g || 0) * multiplier} color="bg-primary-light" max={30} unit={t.label_gram} />
                              <MacroBar label={t.label_gula} value={(result.total?.gula_g || 0) * multiplier} color="bg-[#F87171]" max={50} unit={t.label_gram} />
                          </div>
                      </div>
                  </div>

                  {/* SECTION 2 — Vitamin & Mineral */}
                  <div className="border border-border/60 rounded-[20px] overflow-hidden">
                      <button 
                          onClick={() => setIsVitaminsExpanded(!isVitaminsExpanded)}
                          className="w-full flex items-center justify-between p-4 bg-bg-main text-sm font-bold text-text-primary hover:bg-border/30 transition-colors"
                      >
                          <span className="flex items-center gap-2">
                              ✨ Vitamin & Mineral
                          </span>
                          <ChevronDown size={18} className={cn("text-text-muted transition-transform duration-300", isVitaminsExpanded ? "rotate-180" : "")} />
                      </button>
                      <div className={cn(
                          "grid transition-all duration-300 ease-in-out bg-white",
                          isVitaminsExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                      )}>
                          <div className="overflow-hidden">
                              <div className="p-4 pt-2 grid grid-cols-2 gap-x-6 gap-y-4">
                                  <VitaminBar label="🦴 Kalsium" value={(result.total?.kalsium_mg || 0) * multiplier} akg={1000} unit="mg" />
                                  <VitaminBar label="🩸 Zat Besi" value={(result.total?.zat_besi_mg || 0) * multiplier} akg={26} unit="mg" />
                                  <VitaminBar label="🍊 Vitamin C" value={(result.total?.vitamin_c_mg || 0) * multiplier} akg={90} unit="mg" />
                                  <VitaminBar label="👁️ Vitamin A" value={(result.total?.vitamin_a_mcg || 0) * multiplier} akg={650} unit="mcg" />
                                  <VitaminBar label="⚡ Kalium" value={(result.total?.kalium_mg || 0) * multiplier} akg={4700} unit="mg" />
                                  <VitaminBar label="🧂 Natrium" value={(result.total?.natrium_mg || 0) * multiplier} akg={2300} unit="mg" />
                              </div>
                          </div>
                      </div>
                  </div>

                  {/* Expandable Ingredients list */}
                  {result.bahan_makanan && result.bahan_makanan.length > 0 && (
                    <div className="border border-border/60 rounded-[20px] overflow-hidden">
                        <button 
                            onClick={() => setIsIngredientsExpanded(!isIngredientsExpanded)}
                            className="w-full flex items-center justify-between p-4 bg-bg-main text-sm font-bold text-text-primary"
                        >
                            <span className="flex items-center gap-2">
                                🍱 {t.rincian_bahan}
                                <span className="text-[10px] bg-border px-2 py-0.5 rounded-full text-text-secondary">
                                    {result.bahan_makanan.length}
                                </span>
                            </span>
                            <ChevronDown size={18} className={cn("transition-transform duration-300", isIngredientsExpanded ? "rotate-180" : "")} />
                        </button>
                        
                        <div className={cn(
                            "grid transition-all duration-300 ease-in-out bg-white",
                            isIngredientsExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                        )}>
                            <div className="overflow-hidden divide-y divide-border/30">
                                {result.bahan_makanan.map((bahan, idx) => (
                                    <div key={idx} className="p-4 space-y-2">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <p className="font-bold text-sm text-text-primary">{bahan.nama}</p>
                                                <p className="text-[11px] text-text-muted font-medium italic">{bahan.estimasi_porsi} ({Math.round(bahan.kalori * multiplier)} kcal)</p>
                                            </div>
                                            <div className="text-right">
                                                <span className="font-bold text-primary text-sm">
                                                    {((bahan.kalori / Math.max(result.total?.kalori || 1, 1)) * 100).toFixed(0)}%
                                                </span>
                                            </div>
                                        </div>
                                        {/* Contribution bar */}
                                        <div className="w-full h-1.5 bg-bg-main rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-primary-light"
                                                style={{ width: `${(bahan.kalori / Math.max(result.total?.kalori || 1, 1)) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                  )}
                  
                  {result.catatan_gizi && (
                      <div className="bg-primary/5 border border-primary/10 p-4 rounded-[16px] flex items-start gap-3">
                          <span className="text-lg leading-none">💡</span>
                          <p className="text-xs text-text-secondary italic leading-relaxed font-medium">"{result.catatan_gizi}"</p>
                      </div>
                  )}

                  <div className="flex gap-3 pt-2">
                      <button 
                          onClick={() => setShowSaveSheet(true)}
                          className="flex-1 bg-primary text-white font-bold py-3.5 rounded-[14px] text-sm shadow-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                      >
                          💾 {t.simpanKeLog}
                      </button>
                      <button 
                          onClick={() => {
                              resetScanner();
                              setShowSourceModal(true);
                          }}
                          className="px-5 bg-white border-2 border-primary-light text-primary-light py-3.5 rounded-[14px] hover:bg-primary-light/5 transition-colors flex items-center justify-center font-bold text-sm"
                      >
                          📷
                      </button>
                  </div>
                </div>
            )}
        </div>
      )}

      {/* Save Bottom Sheet Modal */}
      <BottomSheet isOpen={showSaveSheet && !!result} onClose={() => {
        if (!isSaving) setShowSaveSheet(false);
      }}>
          <h3 className="text-xl font-bold font-heading mb-6 tracking-tight text-text-primary text-center mt-2">{t.simpan_sebagai}</h3>
          
          {(() => {
              const hour = new Date().getHours();
              let suggestedType = "camilan";
              if (hour >= 5 && hour < 10) suggestedType = "sarapan";
              else if (hour >= 11 && hour < 15) suggestedType = "makan_siang";
              else if (hour >= 17 && hour < 21) suggestedType = "makan_malam";
              
              return (
                  <div className="flex flex-col gap-3 mb-4 relative">
                      {isSaving && (
                          <div className="absolute inset-0 z-20 flex items-center justify-center bg-bg-card/80 backdrop-blur-sm rounded-xl">
                              <div className="flex flex-col items-center">
                                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-2"></div>
                                  <p className="text-sm font-bold text-primary">{t.btn_simpan}</p>
                              </div>
                          </div>
                      )}
                      <MealTypeBtn icon="🌅" label={t.sarapan} isSuggested={suggestedType === "sarapan"} onClick={() => { if (!isSaving) handleSave("sarapan") }} t={t} />
                      <MealTypeBtn icon="☀️" label={t.makan_siang} isSuggested={suggestedType === "makan_siang"} onClick={() => { if (!isSaving) handleSave("makan_siang") }} t={t} />
                      <MealTypeBtn icon="🌙" label={t.makan_malam} isSuggested={suggestedType === "makan_malam"} onClick={() => { if (!isSaving) handleSave("makan_malam") }} t={t} />
                      <MealTypeBtn icon="🍪" label={t.camilan} isSuggested={suggestedType === "camilan"} onClick={() => { if (!isSaving) handleSave("camilan") }} t={t} />
                  </div>
              );
          })()}
      </BottomSheet>

      {/* Source Source Selection Modal */}
      <BottomSheet isOpen={showSourceModal} onClose={() => setShowSourceModal(false)}>
          <h3 className="text-sm font-bold font-heading mb-6 tracking-tight text-text-muted text-center uppercase mt-2">{t.tambah_foto}</h3>
          
          <div className="space-y-3 mb-4">
              <button 
                  onClick={() => cameraInputRef.current?.click()}
                  className="w-full bg-bg-main border border-border/60 p-4 rounded-[20px] flex items-center justify-between text-left hover:border-primary/40 focus:border-primary/40 active:bg-primary/5 transition-all group"
              >
                  <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-bg-card rounded-full shadow-sm flex items-center justify-center text-primary group-hover:bg-primary/10 group-focus:bg-primary/10 transition-colors">
                          <Camera size={24} />
                      </div>
                      <div>
                          <h4 className="font-bold text-[15px] text-text-primary mb-0.5">{t.btn_camera}</h4>
                      </div>
                  </div>
                  <ChevronRight size={20} className="text-border group-hover:text-primary transition-colors" />
              </button>

              <button 
                  onClick={() => galleryInputRef.current?.click()}
                  className="w-full bg-bg-main border border-border/60 p-4 rounded-[20px] flex items-center justify-between text-left hover:border-primary/40 focus:border-primary/40 active:bg-primary/5 transition-all group"
              >
                  <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-bg-card rounded-full shadow-sm flex items-center justify-center text-primary group-hover:bg-primary/10 group-focus:bg-primary/10 transition-colors">
                          <ImageIcon size={24} />
                      </div>
                      <div>
                          <h4 className="font-bold text-[15px] text-text-primary mb-0.5">{t.btn_gallery}</h4>
                      </div>
                  </div>
                  <ChevronRight size={20} className="text-border group-hover:text-primary transition-colors" />
              </button>
          </div>
      </BottomSheet>
    </div>
  );
}



function MealTypeBtn({ icon, label, isSuggested, onClick, t }: { icon: string, label: string, isSuggested?: boolean, onClick: () => void, t: any }) {
    return (
        <button 
            onClick={onClick}
            className={cn(
                "flex items-center justify-between px-4 h-[64px] rounded-[20px] transition-all w-full relative group border-2",
                isSuggested 
                    ? "border-primary bg-primary/5 shadow-sm" 
                    : "bg-bg-main border-border hover:border-primary-light hover:bg-primary-light/5"
            )}
        >
            <div className="flex items-center gap-4">
                <span className="text-3xl leading-none">{icon}</span>
                <span className="font-bold text-[15px] text-text-primary tracking-tight">{label}</span>
            </div>
            {isSuggested && (
                <span className="absolute right-12 z-10 bg-primary text-white text-[10px] uppercase tracking-widest font-bold px-3 py-1 rounded-full shadow-md whitespace-nowrap">
                    {t.disarankan}
                </span>
            )}
            <ChevronRight size={20} className={isSuggested ? "text-primary" : "text-border group-hover:text-primary-light"} />
        </button>
    );
}
