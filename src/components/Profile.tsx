import { useState, useEffect, useRef } from 'react';
import { UserProfile, getUserProfile, saveUserProfile, getLogsForDateRange, logoutUser, deleteAccount, uploadProfileImage, auth } from '../lib/firebase';
import { Edit2, LogOut, ChevronRight, Calculator, Bell, Globe, Moon, Scale, Info, Check, ImagePlus, Camera, UserPlus, Trash2, Shield } from 'lucide-react';
import BottomSheet from './BottomSheet';
import Toast, { ToastType } from './shared/Toast';
import { format, subDays } from 'date-fns';

import { useSettings } from '../contexts/SettingsContext';
import { useTranslation } from '../hooks/useTranslation';
import { useUnits } from '../hooks/useUnits';

export default function Profile({ onTargetUpdated, onOpenNara }: { onTargetUpdated?: (val: number) => void, onOpenNara?: () => void }) {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [streaks, setStreaks] = useState({ current: 0 });
    const [totalMeals, setTotalMeals] = useState(0);
    const [toast, setToast] = useState<{ message: string, type: ToastType } | null>(null);

    const { settings, updateSetting } = useSettings();
    const t = useTranslation();
    const { formatWeight } = useUnits();

    const [showEditLang, setShowEditLang] = useState(false);
    const [tempLang, setTempLang] = useState<string>(settings.language);
    const [showEditUnit, setShowEditUnit] = useState(false);
    const [tempUnit, setTempUnit] = useState(settings.unitSystem === 'imperial');

    const profileImageUploadRef = useRef<HTMLInputElement>(null);
    const profileImageCameraRef = useRef<HTMLInputElement>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    const handleImageCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        if (!file.type.startsWith('image/')) {
            alert('Pilih file gambar yang valid.');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            setImagePreview(base64String);
            setEditProfileData({ ...editProfileData, foto_profil: base64String });
        };
        reader.readAsDataURL(file);
        
        // Reset input
        e.target.value = '';
    };

    const [showAboutNara, setShowAboutNara] = useState(false);
    const [showEditTarget, setShowEditTarget] = useState(false);
    const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
    const [showTerms, setShowTerms] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [editTargets, setEditTargets] = useState({ kalori: 0, protein: 0, karbo: 0, lemak: 0 });
    
    const [showEditAlergi, setShowEditAlergi] = useState(false);
    const [editAlergiConfig, setEditAlergiConfig] = useState<string[]>([]);

    const [showEditProfile, setShowEditProfile] = useState(false);
    const [editProfileData, setEditProfileData] = useState({ 
        nama: '', 
        tujuan: 'maintenance',
        usia: 25,
        berat_kg: 60,
        tinggi_cm: 165,
        foto_profil: ''
    });

    useEffect(() => {
        const fetchProfileData = async () => {
            const p = await getUserProfile();
            setProfile(p || null);
            
            // Only fetch last 60 days for streak calculation (not entire history)
            const startDate = format(subDays(new Date(), 60), 'yyyy-MM-dd');
            const endDate = format(new Date(), 'yyyy-MM-dd');
            const logs = await getLogsForDateRange(startDate, endDate);
            setTotalMeals(logs.length);
            
            // basic streak calc
            const loggedDates = [...new Set(logs.map(l => l.date_key))].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
            let current = 0;
            const today = new Date();
            if (loggedDates.length > 0) {
                const diffToday = Math.floor((today.getTime() - new Date(loggedDates[0]).getTime()) / (1000 * 3600 * 24));
                if (diffToday <= 1) {
                    current = 1;
                    let checkDate = new Date(loggedDates[0]);
                    for (let i = 1; i < loggedDates.length; i++) {
                        const nextD = new Date(loggedDates[i]);
                        const diff = Math.floor((checkDate.getTime() - nextD.getTime()) / (1000 * 3600 * 24));
                        if (diff === 1) {
                            current++;
                            checkDate = nextD;
                        } else {
                            break;
                        }
                    }
                }
            }
            setStreaks({ current });
            setLoading(false);
        };
        fetchProfileData();
    }, []);

    const handleRecalculate = async () => {
        if (!profile) return;
        setLoading(true);
        let bmr = (10 * profile.berat_kg) + (6.25 * profile.tinggi_cm) - (5 * profile.usia);
        bmr = profile.gender === 'laki-laki' ? bmr + 5 : bmr - 161;
        const maintenance = bmr * 1.2;
        let newTarget = maintenance;
        if (profile.tujuan === 'diet') newTarget -= 500;
        else if (profile.tujuan === 'bulking') newTarget += 500;
        
        newTarget = Math.max(1200, Math.round(newTarget));
        
        const protein = Math.round((newTarget * 0.20) / 4);
        const lemak = Math.round((newTarget * 0.25) / 9);
        const karbo = Math.round((newTarget * 0.55) / 4);

        const updatedProfile = {
            ...profile,
            target_kalori: newTarget,
            target_protein_g: protein,
            target_lemak_g: lemak,
            target_karbo_g: karbo
        };
        await saveUserProfile(updatedProfile);
        setProfile(updatedProfile);
        if (onTargetUpdated) onTargetUpdated(newTarget);
        setLoading(false);
    };

    if (loading) {
        return <div className="flex justify-center p-8"><div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin"></div></div>;
    }

    if (!profile) return null;

    const bmi = profile.berat_kg / Math.pow(profile.tinggi_cm / 100, 2);
    let bmiCategory = "Normal";
    let bmiColor = "text-success";
    if (bmi < 18.5) { bmiCategory = "Kurus"; bmiColor = "text-warning"; }
    else if (bmi >= 25 && bmi < 30) { bmiCategory = "Gemuk"; bmiColor = "text-warning"; }
    else if (bmi >= 30) { bmiCategory = "Obesitas"; bmiColor = "text-error"; }

    const initial = profile.nama ? profile.nama.charAt(0).toUpperCase() : '?';

    const handleDeleteAccount = async () => {
        try {
            setLoading(true);
            await deleteAccount();
            localStorage.clear();
            sessionStorage.clear();
            window.location.reload();
        } catch (err: any) {
            if (err.code === 'auth/requires-recent-login') {
                alert("Aksi ini memerlukan login ulang untuk alasan keamanan. Silakan logout dan login kembali lalu coba lagi.");
            } else {
                alert("Terjadi kesalahan: " + err.message);
            }
            setLoading(false);
        }
    };

    const commonAllergies = ["Kacang", "Seafood", "Susu Sapi", "Telur", "Gluten", "Kedelai", "Gandum"];

    const handleOpenEditTarget = () => {
        if (!profile) return;
        setEditTargets({
            kalori: profile.target_kalori,
            protein: profile.target_protein_g,
            karbo: profile.target_karbo_g,
            lemak: profile.target_lemak_g
        });
        setShowEditTarget(true);
    };

    const handleSaveEditTarget = async () => {
        if (!profile) return;
        setLoading(true);
        const updated = {
            ...profile,
            target_kalori: Number(editTargets.kalori),
            target_protein_g: Number(editTargets.protein),
            target_karbo_g: Number(editTargets.karbo),
            target_lemak_g: Number(editTargets.lemak)
        };
        await saveUserProfile(updated);
        setProfile(updated);
        if (onTargetUpdated) onTargetUpdated(Number(editTargets.kalori));
        setShowEditTarget(false);
        setLoading(false);
    };

    const handleOpenEditAlergi = () => {
        if (!profile) return;
        setEditAlergiConfig(profile.alergi || []);
        setShowEditAlergi(true);
    };

    const handleSaveAlergi = async () => {
        if (!profile) return;
        setLoading(true);
        const updated = { ...profile, alergi: editAlergiConfig };
        await saveUserProfile(updated);
        setProfile(updated);
        setShowEditAlergi(false);
        setLoading(false);
    };

    const handleOpenEditProfile = () => {
        if (!profile) return;
        setEditProfileData({
            nama: profile.nama,
            tujuan: profile.tujuan || 'maintenance',
            usia: profile.usia || 25,
            berat_kg: profile.berat_kg || 60,
            tinggi_cm: profile.tinggi_cm || 165,
            foto_profil: profile.foto_profil || ''
        });
        setShowEditProfile(true);
    };

    const handleSaveEditProfile = async () => {
        if (!profile) return;
        setLoading(true);
        try {
            const newUsia = Number(editProfileData.usia);
            const newBerat = Number(editProfileData.berat_kg);
            const newTinggi = Number(editProfileData.tinggi_cm);
            const newTujuan = editProfileData.tujuan as any;

            let bmr = (10 * newBerat) + (6.25 * newTinggi) - (5 * newUsia);
            bmr = profile.gender === 'laki-laki' || profile.gender === 'pria' ? bmr + 5 : bmr - 161;
            const maintenance = bmr * 1.2;
            let newTarget = maintenance;
            if (newTujuan === 'diet') newTarget -= 500;
            else if (newTujuan === 'bulking') newTarget += 500;
            newTarget = Math.max(1200, Math.round(newTarget));

            let newFotoUrl = editProfileData.foto_profil;
            if (newFotoUrl && newFotoUrl.startsWith('data:image/')) {
                const uploadedUrl = await uploadProfileImage(newFotoUrl);
                if (uploadedUrl) {
                    newFotoUrl = uploadedUrl;
                } else {
                    // Fallback to old url or empty string to prevent saving massive base64 to Firestore
                    newFotoUrl = (profile.foto_profil && !profile.foto_profil.startsWith('data:image/')) ? profile.foto_profil : '';
                }
            }

            const updated = {
                ...profile,
                nama: editProfileData.nama,
                tujuan: newTujuan,
                usia: newUsia,
                berat_kg: newBerat,
                tinggi_cm: newTinggi,
                target_kalori: newTarget,
                target_protein_g: Math.round((newTarget * 0.25) / 4),
                target_karbo_g: Math.round((newTarget * 0.5) / 4),
                target_lemak_g: Math.round((newTarget * 0.25) / 9),
                foto_profil: newFotoUrl
            };

            if (onTargetUpdated) {
                onTargetUpdated(newTarget);
            }

            await saveUserProfile(updated);
            setProfile(updated);
            setShowEditProfile(false);
            setToast({ message: t.profile_updated_success as string, type: 'success' });
        } catch (error) {
            console.error("Error saving profile:", error);
            const errMsg = error instanceof Error ? error.message : String(error);
            setToast({ message: `${t.profile_updated_error}: ${errMsg}`, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-5 relative min-h-full pb-20 space-y-8 animate-in fade-in duration-500">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            {/* Identity */}
            <div className="flex items-center gap-4 bg-bg-card p-5 rounded-[24px] shadow-[0_2px_16px_rgba(0,0,0,0.06)] border border-border">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary-light text-white flex items-center justify-center text-3xl font-black shrink-0 shadow-inner overflow-hidden">
                    {profile.foto_profil ? (
                        <img src={profile.foto_profil} alt={profile.nama} className="w-full h-full object-cover" />
                    ) : (
                        initial
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <h2 className="text-2xl font-bold text-text-primary font-heading truncate">{profile.nama}</h2>
                    <div className="inline-flex items-center mt-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold font-heading">
                        {profile.tujuan === 'diet' ? `🔥 ${t.goal_diet}` : profile.tujuan === 'bulking' ? `💪 ${t.goal_bulking}` : `⚖️ ${t.goal_maintain}`}
                    </div>
                </div>
                <button onClick={handleOpenEditProfile} className="w-10 h-10 rounded-full bg-bg-main flex items-center justify-center text-text-muted hover:text-primary transition-colors border border-border shrink-0">
                    <Edit2 size={18} />
                </button>
            </div>

            {/* Guest Banner */}
            {auth.currentUser?.isAnonymous && (
                <div className="bg-warning/10 border border-warning/30 rounded-2xl p-4 flex flex-col gap-3">
                     <div className="flex items-center gap-3">
                         <div className="text-xl shrink-0">👤</div>
                         <div>
                             <p className="font-bold text-sm text-text-primary mb-0.5">{t.guest_banner}</p>
                             <p className="text-xs font-medium text-text-secondary">{t.guest_sub}</p>
                         </div>
                     </div>
                     <button 
                        onClick={async () => {
                            await logoutUser();
                        }}
                        className="w-full bg-primary text-white font-bold py-2.5 flex justify-center items-center gap-2 rounded-xl text-sm"
                     >
                         <UserPlus size={16} /> {t.btn_buat_akun}
                     </button>
                </div>
            )}

            {/* Stats Summary */}
            <div className="flex overflow-x-auto gap-3 pb-2 -mx-5 px-5 no-scrollbar snap-x">
                <div className="snap-center shrink-0 w-[140px] p-4 rounded-[20px] bg-bg-card border border-border shadow-sm flex flex-col gap-1">
                    <span className="text-2xl mb-1">🔥</span>
                    <p className="text-[10px] text-text-secondary font-bold uppercase tracking-widest">{t.label_streak}</p>
                    <p className="text-2xl font-black font-mono text-primary leading-none">{streaks.current}</p>
                </div>
                <div className="snap-center shrink-0 w-[140px] p-4 rounded-[20px] bg-bg-card border border-border shadow-sm flex flex-col gap-1">
                    <span className="text-2xl mb-1">📊</span>
                    <p className="text-[10px] text-text-secondary font-bold uppercase tracking-widest">{t.label_total_dicatat}</p>
                    <p className="text-2xl font-black font-mono text-primary leading-none">{totalMeals}</p>
                </div>
                <div className="snap-center shrink-0 w-[140px] p-4 rounded-[20px] bg-bg-card border border-border shadow-sm flex flex-col gap-1">
                    <span className="text-2xl mb-1">🎯</span>
                    <p className="text-[10px] text-text-secondary font-bold uppercase tracking-widest">{t.label_target_kalori}</p>
                    <p className="text-2xl font-black font-mono text-primary leading-none">{profile.target_kalori}</p>
                </div>
                <div className="snap-center shrink-0 w-[140px] p-4 rounded-[20px] bg-bg-card border border-border shadow-sm flex flex-col gap-1">
                    <span className="text-2xl mb-1">⚖️</span>
                    <p className="text-[10px] text-text-secondary font-bold uppercase tracking-widest">{t.label_bmi}</p>
                    <div className="flex items-baseline gap-1.5">
                        <p className="text-2xl font-black font-mono text-primary leading-none">{bmi.toFixed(1)}</p>
                        <p className={`text-[10px] font-bold ${bmiColor}`}>{bmiCategory}</p>
                    </div>
                </div>
            </div>

            {/* Target Harian */}
            <section className="space-y-3">
                <div className="flex justify-between items-end">
                    <h3 className="font-bold text-lg text-text-primary tracking-tight">{t.target_harian}</h3>
                    <div className="flex gap-2">
                        <button onClick={handleRecalculate} className="text-[10px] font-bold text-text-secondary bg-border/40 px-2.5 py-1.5 rounded-md hover:bg-border/60 transition flex items-center gap-1">
                            <Calculator size={12} /> {t.btn_hitung}
                        </button>
                        <button onClick={handleOpenEditTarget} className="text-[10px] font-bold text-primary bg-primary/10 px-2.5 py-1.5 rounded-md hover:bg-primary/20 transition flex items-center gap-1">
                            <Edit2 size={12} /> {t.btn_ubah}
                        </button>
                    </div>
                </div>
                <div className="bg-bg-card rounded-[24px] p-5 border border-border shadow-sm grid grid-cols-2 gap-y-4 gap-x-6">
                    <div>
                        <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest mb-0.5">{t.label_kalori}</p>
                        <p className="text-xl font-bold font-mono text-text-primary">{profile.target_kalori} <span className="text-[10px] text-text-muted uppercase">{t.label_kcal}</span></p>
                    </div>
                    <div>
                        <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest mb-0.5">{t.label_protein}</p>
                        <p className="text-xl font-bold font-mono text-success">{profile.target_protein_g} <span className="text-[10px] text-text-muted uppercase">{t.label_gram}</span></p>
                    </div>
                    <div>
                        <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest mb-0.5">{t.label_karbo}</p>
                        <p className="text-xl font-bold font-mono text-warning">{profile.target_karbo_g} <span className="text-[10px] text-text-muted uppercase">{t.label_gram}</span></p>
                    </div>
                    <div>
                        <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest mb-0.5">{t.label_lemak}</p>
                        <p className="text-xl font-bold font-mono text-error">{profile.target_lemak_g} <span className="text-[10px] text-text-muted uppercase">{t.label_gram}</span></p>
                    </div>
                </div>
            </section>

            {/* Alergi & Pantangan */}
            <section className="space-y-3">
                <div className="flex justify-between items-end">
                    <h3 className="font-bold text-lg text-text-primary tracking-tight">{t.alergi_title}</h3>
                    <button onClick={handleOpenEditAlergi} className="text-[10px] font-bold text-primary bg-primary/10 px-2.5 py-1.5 rounded-md hover:bg-primary/20 transition flex items-center gap-1">
                        <Edit2 size={12} /> {t.btn_edit}
                    </button>
                </div>
                <div className="bg-bg-card rounded-[24px] p-5 border border-border shadow-sm flex gap-2 flex-wrap">
                    {profile.alergi && profile.alergi.length > 0 ? (
                        profile.alergi.map(a => (
                            <span key={a} className="bg-error/10 text-error font-bold text-xs px-3 py-1.5 rounded-lg border border-error/20 inline-flex items-center gap-1">
                                <span className="text-[10px]">🚫</span> {(t as any)[`alergi_${a.toLowerCase().replace(/ /g, '_')}`] || a}
                            </span>
                        ))
                    ) : (
                        <span className="text-sm font-medium text-text-muted italic">{t.tidak_ada_alergi}</span>
                    )}
                </div>
            </section>

            {/* Pengaturan */}
            <section className="space-y-3">
                <h3 className="font-bold text-lg text-text-primary tracking-tight">{t.pengaturan}</h3>
                <div className="bg-bg-card rounded-[24px] border border-border shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b border-border/50">
                        <div className="flex items-center gap-3 text-text-primary font-bold text-sm">
                            <Globe size={18} className="text-text-muted" /> {t.bahasa}
                        </div>
                        <button onClick={() => { setTempLang(settings.language); setShowEditLang(true); }} className="flex items-center gap-2 text-xs font-bold text-text-secondary bg-bg-main px-3 py-1.5 rounded-lg border border-border">
                            {settings.language === 'id' ? 'Indonesia' : settings.language === 'en' ? 'English' : settings.language === 'es' ? 'Español' : settings.language === 'zh' ? '中文' : settings.language === 'ar' ? 'العربية' : 'Indonesia'} <ChevronRight size={14} />
                        </button>
                    </div>
                    <div className="flex items-center justify-between p-4 border-b border-border/50">
                        <div className="flex items-center gap-3 text-text-primary font-bold text-sm">
                            <Bell size={18} className="text-text-muted" /> {t.notif_nara}
                        </div>
                        <button onClick={() => updateSetting('naraNotifications', !settings.naraNotifications)} className={`w-11 h-6 rounded-full transition-colors relative ${settings.naraNotifications ? 'bg-primary' : 'bg-border'}`}>
                            <div className={`w-5 h-5 bg-white rounded-full absolute pl-0.5 top-0.5 transition-transform ${settings.naraNotifications ? 'translate-x-5' : 'translate-x-0.5'}`}></div>
                        </button>
                    </div>
                    <div className="flex items-center justify-between p-4 border-b border-border/50">
                        <div className="flex items-center gap-3 text-text-primary font-bold text-sm">
                            <Scale size={18} className="text-text-muted" /> {t.satuan_berat}
                        </div>
                        <button onClick={() => { setTempUnit(settings.unitSystem === 'imperial'); setShowEditUnit(true); }} className="flex items-center gap-2 text-xs font-bold text-text-secondary bg-bg-main px-3 py-1.5 rounded-lg border border-border">
                            {settings.unitSystem === 'imperial' ? t.satuan_imperial : t.satuan_metric} <ChevronRight size={14} />
                        </button>
                    </div>
                    <div className="flex items-center justify-between p-4 border-b border-border/50">
                        <div className="flex items-center gap-3 text-text-primary font-bold text-sm">
                            <Moon size={18} className="text-text-muted" /> {t.tema_gelap}
                        </div>
                        <button onClick={() => updateSetting('darkMode', !settings.darkMode)} className={`w-11 h-6 rounded-full transition-colors relative ${settings.darkMode ? 'bg-primary' : 'bg-border'}`}>
                            <div className={`w-5 h-5 bg-white rounded-full absolute pl-0.5 top-0.5 transition-transform ${settings.darkMode ? 'translate-x-5' : 'translate-x-0.5'}`}></div>
                        </button>
                    </div>
                    
                    <button onClick={() => setShowDeleteConfirm(true)} className="w-full flex items-center justify-between p-4 border-b border-border/50 hover:bg-bg-main transition-colors text-error text-left">
                        <div className="flex items-center gap-3 font-bold text-sm">
                            <Trash2 size={18} /> {t.hapus_akun}
                        </div>
                        <ChevronRight size={16} className="text-error/50" />
                    </button>

                    <button onClick={() => setShowLogoutConfirm(true)} className="w-full flex items-center justify-between p-4 hover:bg-bg-main transition-colors text-text-primary text-left">
                        <div className="flex items-center gap-3 font-bold text-sm">
                            <LogOut size={18} className="text-text-muted" /> {t.keluar}
                        </div>
                        <ChevronRight size={16} className="text-text-muted/50" />
                    </button>
                </div>
            </section>

            {/* Dukungan & Kebijakan */}
            <section className="space-y-3">
                <h3 className="font-bold text-lg text-text-primary tracking-tight">{t.bantuan}</h3>
                <div className="bg-bg-card rounded-[24px] border border-border shadow-sm overflow-hidden">
                    <button onClick={() => setShowHelp(true)} className="w-full flex items-center justify-between p-4 border-b border-border/50 hover:bg-bg-main transition-colors text-text-primary text-left">
                        <div className="flex items-center gap-3 font-bold text-sm">
                            <Info size={18} className="text-text-muted" /> {t.bantuan}
                        </div>
                        <ChevronRight size={16} className="text-text-muted/50" />
                    </button>
                    <button onClick={() => setShowTerms(true)} className="w-full flex items-center justify-between p-4 border-b border-border/50 hover:bg-bg-main transition-colors text-text-primary text-left">
                        <div className="flex items-center gap-3 font-bold text-sm">
                            <Scale size={18} className="text-text-muted" /> {t.syarat_ketentuan}
                        </div>
                        <ChevronRight size={16} className="text-text-muted/50" />
                    </button>
                    <button onClick={() => setShowPrivacyPolicy(true)} className="w-full flex items-center justify-between p-4 hover:bg-bg-main transition-colors text-text-primary text-left">
                        <div className="flex items-center gap-3 font-bold text-sm">
                            <Shield size={18} className="text-text-muted" /> {t.kebijakan_privasi}
                        </div>
                        <ChevronRight size={16} className="text-text-muted/50" />
                    </button>
                </div>
            </section>

            {/* Tentang Aplikasi */}
            <section className="pt-4 pb-8 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3 shadow-[0_4px_20px_rgba(123,97,255,0.4)] overflow-hidden">
                    <img src="/icon.png" alt="MakanApa" className="w-full h-full object-cover" />
                </div>
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-2xl font-bold text-text-primary">MakanApa</span>
                  <span className="text-sm font-medium text-primary-light">v1.20</span>
                </div>
                <p className="text-sm text-text-muted font-medium mb-4 mt-1">Foto. Kenali. Sehat.</p>
                
                <button onClick={() => setShowAboutNara(true)} className="text-xs font-bold text-text-secondary border border-border px-4 py-2 rounded-full hover:bg-bg-main transition-colors flex items-center gap-2">
                    <Info size={14} /> {t.tentang_nara_btn}
                </button>
            </section>

            <BottomSheet isOpen={showEditTarget} onClose={() => setShowEditTarget(false)} title={t.ubah_target_harian}>
                <div className="space-y-4 px-1 pb-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5 block">{t.label_kcal_unit}</label>
                            <input 
                                type="number" 
                                className="w-full bg-bg-main border border-border rounded-xl px-4 py-3 text-lg font-bold text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                value={editTargets.kalori}
                                onChange={(e) => setEditTargets({...editTargets, kalori: Number(e.target.value)})}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5 block">{t.label_protein_g}</label>
                            <input 
                                type="number" 
                                className="w-full bg-bg-main border border-border rounded-xl px-4 py-3 text-lg font-bold text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                value={editTargets.protein}
                                onChange={(e) => setEditTargets({...editTargets, protein: Number(e.target.value)})}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5 block">{t.label_karbo_g}</label>
                            <input 
                                type="number" 
                                className="w-full bg-bg-main border border-border rounded-xl px-4 py-3 text-lg font-bold text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                value={editTargets.karbo}
                                onChange={(e) => setEditTargets({...editTargets, karbo: Number(e.target.value)})}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5 block">{t.label_lemak_g}</label>
                            <input 
                                type="number" 
                                className="w-full bg-bg-main border border-border rounded-xl px-4 py-3 text-lg font-bold text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                value={editTargets.lemak}
                                onChange={(e) => setEditTargets({...editTargets, lemak: Number(e.target.value)})}
                            />
                        </div>
                    </div>
                    <button 
                        onClick={handleSaveEditTarget}
                        className="w-full bg-primary text-white font-bold py-4 rounded-xl mt-4 active:scale-[0.98] transition-transform"
                    >
                        {t.btn_simpan}
                    </button>
                </div>
            </BottomSheet>

            <BottomSheet isOpen={showEditAlergi} onClose={() => setShowEditAlergi(false)} title={t.pilih_alergi}>
                <div className="space-y-4 px-1 pb-4">
                    <p className="text-sm font-medium text-text-secondary text-center mb-4">{t.pilih_alergi_desc}</p>
                    <div className="flex flex-wrap gap-2 justify-center mb-6">
                        {commonAllergies.map(alergi => {
                            const isSelected = editAlergiConfig.includes(alergi);
                            return (
                                <button
                                    key={alergi}
                                    onClick={() => {
                                        if (isSelected) setEditAlergiConfig(editAlergiConfig.filter(a => a !== alergi));
                                        else setEditAlergiConfig([...editAlergiConfig, alergi]);
                                    }}
                                    className={`px-4 py-2 rounded-full border text-sm font-bold transition-all flex items-center gap-2 ${isSelected ? 'bg-error/10 border-error text-error' : 'bg-bg-main border-border text-text-muted hover:border-text-muted'}`}
                                >
                                    {isSelected && <span className="w-2 h-2 rounded-full bg-error"></span>}
                                    {(t as any)[`alergi_${alergi.toLowerCase().replace(/ /g, '_')}`] || alergi}
                                </button>
                            );
                        })}
                    </div>
                    <button 
                        onClick={handleSaveAlergi}
                        className="w-full bg-primary text-white font-bold py-4 rounded-xl mt-4 active:scale-[0.98] transition-transform"
                    >
                        {t.btn_simpan}
                    </button>
                </div>
            </BottomSheet>

            <BottomSheet isOpen={showEditProfile} onClose={() => setShowEditProfile(false)} title={t.edit_profil}>
                <div className="space-y-4 px-1 pb-4">
                    <div>
                        <label className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5 block">{t.foto_profil}</label>
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary-light text-white flex items-center justify-center text-2xl font-black shrink-0 shadow-inner overflow-hidden border-2 border-border">
                                {editProfileData.foto_profil ? (
                                    <img src={editProfileData.foto_profil} alt="Preview" className="w-full h-full object-cover" />
                                ) : (
                                    initial
                                )}
                            </div>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => profileImageCameraRef.current?.click()}
                                    className="px-3 py-2 bg-bg-main border border-border rounded-xl text-xs font-bold text-text-primary flex items-center gap-2 hover:bg-border transition-colors"
                                >
                                    <Camera size={16} /> {t.kamera}
                                </button>
                                <button 
                                    onClick={() => profileImageUploadRef.current?.click()}
                                    className="px-3 py-2 bg-bg-main border border-border rounded-xl text-xs font-bold text-text-primary flex items-center gap-2 hover:bg-border transition-colors"
                                >
                                    <ImagePlus size={16} /> {t.galeri}
                                </button>
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    capture="environment" 
                                    className="hidden" 
                                    ref={profileImageCameraRef}
                                    onChange={handleImageCapture}
                                />
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    className="hidden" 
                                    ref={profileImageUploadRef}
                                    onChange={handleImageCapture}
                                />
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5 block">{t.label_nama}</label>
                        <input 
                            type="text" 
                            className="w-full bg-bg-main border border-border rounded-xl px-4 py-3 text-lg font-bold text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                            value={editProfileData.nama}
                            onChange={(e) => setEditProfileData({...editProfileData, nama: e.target.value})}
                        />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5 block">{t.label_usia}</label>
                            <div className="relative">
                                <input 
                                    type="number" 
                                    className="w-full bg-bg-main border border-border rounded-xl px-4 py-3 text-lg font-bold text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all pr-8"
                                    value={editProfileData.usia || ''}
                                    onChange={(e) => setEditProfileData({...editProfileData, usia: Number(e.target.value)})}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-text-muted">th</span>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5 block">{t.label_berat}</label>
                            <div className="relative">
                                <input 
                                    type="number" 
                                    className="w-full bg-bg-main border border-border rounded-xl px-4 py-3 text-lg font-bold text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all pr-8"
                                    value={editProfileData.berat_kg || ''}
                                    onChange={(e) => setEditProfileData({...editProfileData, berat_kg: Number(e.target.value)})}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-text-muted">kg</span>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5 block">{t.label_tinggi}</label>
                            <div className="relative">
                                <input 
                                    type="number" 
                                    className="w-full bg-bg-main border border-border rounded-xl px-4 py-3 text-lg font-bold text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all pr-8"
                                    value={editProfileData.tinggi_cm || ''}
                                    onChange={(e) => setEditProfileData({...editProfileData, tinggi_cm: Number(e.target.value)})}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-text-muted">cm</span>
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5 block">{t.label_tujuan}</label>
                        <div className="grid grid-cols-1 gap-2">
                             {[
                                { id: 'diet', label: `🔥 ${t.goal_diet}` },
                                { id: 'maintenance', label: `⚖️ ${t.goal_maintain}` },
                                { id: 'bulking', label: `💪 ${t.goal_bulking}` }
                             ].map(opt => (
                                <button
                                    key={opt.id}
                                    onClick={() => setEditProfileData({...editProfileData, tujuan: opt.id})}
                                    className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left font-bold ${
                                        editProfileData.tujuan === opt.id 
                                            ? 'border-primary bg-primary/5 text-primary' 
                                            : 'border-border bg-bg-card text-text-primary hover:border-primary/30'
                                    }`}
                                >
                                    <span>{opt.label}</span>
                                    {editProfileData.tujuan === opt.id && <Check size={18} className="text-primary" />}
                                </button>
                             ))}
                        </div>
                    </div>
                    
                    {(Number(editProfileData.usia) <= 0 || Number(editProfileData.berat_kg) <= 0 || Number(editProfileData.tinggi_cm) <= 0) && (
                        <p className="text-error text-xs font-bold mt-2 text-center">
                            {t.error_negative_input || "Silakan masukkan data/nilai yang benar"}
                        </p>
                    )}
                    
                    <button 
                        onClick={handleSaveEditProfile}
                        disabled={loading || !editProfileData.nama.trim() || Number(editProfileData.usia) <= 0 || Number(editProfileData.berat_kg) <= 0 || Number(editProfileData.tinggi_cm) <= 0}
                        className="w-full bg-primary text-white font-bold py-4 rounded-xl mt-4 active:scale-[0.98] transition-transform shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : t.btn_simpan}
                    </button>
                </div>
            </BottomSheet>

            <BottomSheet isOpen={showAboutNara} onClose={() => setShowAboutNara(false)} title={t.tentang_app}>
                <div className="space-y-6 px-4 pb-6">
                    <div className="flex flex-col items-center justify-center pt-2">
                        <div className="w-20 h-20 rounded-[24px] flex items-center justify-center shadow-[0_8px_30px_rgba(123,97,255,0.4)] mb-4 overflow-hidden">
                            <img src="/icon.png" alt="MakanApa" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex items-baseline justify-center gap-2">
                          <span className="text-2xl font-bold text-text-primary">MakanApa</span>
                          <span className="text-sm font-medium text-primary-light">v1.20</span>
                        </div>
                        <p className="text-sm font-bold text-primary tracking-widest uppercase mb-4 mt-1">Foto. Kenali. Sehat.</p>
                    </div>
                    
                    <div className="h-px bg-border w-full"></div>

                    <p className="text-sm font-medium leading-relaxed text-text-secondary text-center">
                        {t.about_desc}
                    </p>

                    <div className="h-px bg-border w-full"></div>

                    <div className="grid gap-4">
                         <div className="flex items-center gap-4">
                             <div className="text-2xl bg-bg-main w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border border-border shadow-sm">📷</div>
                             <div>
                                 <p className="font-bold text-sm text-text-primary mb-0.5">{t.about_f1_title}</p>
                                 <p className="text-xs font-medium text-text-secondary">{t.about_f1_desc}</p>
                             </div>
                         </div>
                         <div className="flex items-center gap-4">
                             <div className="text-2xl bg-bg-main w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border border-border shadow-sm">✨</div>
                             <div>
                                 <p className="font-bold text-sm text-text-primary mb-0.5">{t.about_f2_title}</p>
                                 <p className="text-xs font-medium text-text-secondary">{t.about_f2_desc}</p>
                             </div>
                         </div>
                         <div className="flex items-center gap-4">
                             <div className="text-2xl bg-bg-main w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border border-border shadow-sm">📊</div>
                             <div>
                                 <p className="font-bold text-sm text-text-primary mb-0.5">{t.about_f3_title}</p>
                                 <p className="text-xs font-medium text-text-secondary">{t.about_f3_desc}</p>
                             </div>
                         </div>
                         <div className="flex items-center gap-4">
                             <div className="text-2xl bg-bg-main w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border border-border shadow-sm">🎯</div>
                             <div>
                                 <p className="font-bold text-sm text-text-primary mb-0.5">{t.about_f4_title}</p>
                                 <p className="text-xs font-medium text-text-secondary">{t.about_f4_desc}</p>
                             </div>
                         </div>
                    </div>

                    <div className="h-px bg-border w-full"></div>

                    <div className="text-center space-y-1">
                        <p className="text-[10px] font-bold text-text-muted">
                            © 2026 MakanApa
                        </p>
                    </div>

                    <button 
                        onClick={() => setShowAboutNara(false)}
                        className="w-full bg-bg-main border border-border text-text-secondary font-bold py-4 rounded-xl active:scale-[0.98] transition-transform shadow-sm"
                    >
                        {t.btn_tutup}
                    </button>
                </div>
            </BottomSheet>

            <BottomSheet isOpen={showEditLang} onClose={() => setShowEditLang(false)} title={t.bahasa}>
                <div className="space-y-4 px-1 pb-4">
                    <div className="grid grid-cols-1 gap-2">
                        {[
                            { id: 'id', label: '🇮🇩 Indonesia' },
                            { id: 'en', label: '🇬🇧 English' }
                        ].map(opt => (
                            <button
                                key={opt.id}
                                onClick={() => setTempLang(opt.id)}
                                className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left font-bold ${
                                    tempLang === opt.id 
                                        ? 'border-primary bg-primary/5 text-primary' 
                                        : 'border-border bg-bg-card text-text-primary hover:border-primary/30'
                                }`}
                            >
                                <span>{opt.label}</span>
                                {tempLang === opt.id && <Check size={18} className="text-primary" />}
                            </button>
                        ))}
                    </div>
                    
                    <div className="flex gap-2 mt-4">
                        <button 
                            onClick={() => setShowEditLang(false)}
                            className="w-1/3 bg-bg-main text-text-secondary font-bold py-4 rounded-xl active:scale-[0.98] transition-transform border border-border"
                        >
                            {t.btn_cancel}
                        </button>
                        <button 
                            onClick={() => {
                                updateSetting('language', tempLang as any);
                                setShowEditLang(false);
                            }}
                            className="w-2/3 bg-primary text-white font-bold py-4 rounded-xl active:scale-[0.98] transition-transform shadow-lg shadow-primary/20"
                        >
                            {t.btn_konfirmasi}
                        </button>
                    </div>
                </div>
            </BottomSheet>

            <BottomSheet isOpen={showEditUnit} onClose={() => setShowEditUnit(false)} title={t.satuan_berat}>
                <div className="space-y-4 px-1 pb-4">
                    <div className="grid grid-cols-1 gap-2">
                        {[
                            { id: 'metric', label: `⚖️ ${t.satuan_metric}`, value: false },
                            { id: 'imperial', label: `⚖️ ${t.satuan_imperial}`, value: true }
                        ].map(opt => (
                            <button
                                key={opt.id}
                                onClick={() => setTempUnit(opt.value)}
                                className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left font-bold ${
                                    tempUnit === opt.value 
                                        ? 'border-primary bg-primary/5 text-primary' 
                                        : 'border-border bg-bg-card text-text-primary hover:border-primary/30'
                                }`}
                            >
                                <span>{opt.label}</span>
                                {tempUnit === opt.value && <Check size={18} className="text-primary" />}
                            </button>
                        ))}
                    </div>
                    
                    <div className="flex gap-2 mt-4">
                        <button 
                            onClick={() => setShowEditUnit(false)}
                            className="w-1/3 bg-bg-main text-text-secondary font-bold py-4 rounded-xl active:scale-[0.98] transition-transform border border-border"
                        >
                            {t.btn_cancel}
                        </button>
                        <button 
                            onClick={() => {
                                updateSetting('unitSystem', tempUnit ? 'imperial' : 'metric');
                                setShowEditUnit(false);
                            }}
                            className="w-2/3 bg-primary text-white font-bold py-4 rounded-xl active:scale-[0.98] transition-transform shadow-lg shadow-primary/20"
                        >
                            {t.btn_konfirmasi}
                        </button>
                    </div>
                </div>
            </BottomSheet>

            {/* Privacy Policy BottomSheet */}
            <BottomSheet isOpen={showPrivacyPolicy} onClose={() => setShowPrivacyPolicy(false)} title={t.kebijakan_privasi}>
                <div className="px-2 pb-6 space-y-4 text-sm text-text-secondary leading-relaxed">
                    <p className="font-bold text-text-primary">{t.privacy_p1_title}</p>
                    <p>{t.privacy_p1_desc}</p>
                    <p className="font-bold text-text-primary mt-4">{t.privacy_p2_title}</p>
                    <p>{t.privacy_p2_desc}</p>
                    <p className="font-bold text-text-primary mt-4">{t.privacy_p3_title}</p>
                    <p>{t.privacy_p3_desc}</p>
                    <button onClick={() => setShowPrivacyPolicy(false)} className="w-full bg-primary/10 text-primary font-bold py-3 rounded-xl mt-4 active:scale-95 transition-transform">{t.privacy_btn}</button>
                </div>
            </BottomSheet>

            {/* Terms & Conditions BottomSheet */}
            <BottomSheet isOpen={showTerms} onClose={() => setShowTerms(false)} title={t.syarat_ketentuan}>
                <div className="px-2 pb-6 space-y-4 text-sm text-text-secondary leading-relaxed max-h-[60vh] overflow-y-auto">
                    <p className="font-bold text-text-primary">{t.terms_p1_title}</p>
                    <p>{t.terms_p1_desc}</p>
                    <p className="font-bold text-text-primary mt-4">{t.terms_p2_title}</p>
                    <p>{t.terms_p2_desc}</p>
                    <button onClick={() => setShowTerms(false)} className="w-full bg-primary/10 text-primary font-bold py-3 rounded-xl mt-4 active:scale-95 transition-transform">{t.terms_btn}</button>
                </div>
            </BottomSheet>

            {/* Help & FAQ BottomSheet */}
            <BottomSheet isOpen={showHelp} onClose={() => setShowHelp(false)} title={t.bantuan}>
                <div className="px-2 pb-6 space-y-5 text-sm text-text-secondary leading-relaxed">
                    <div>
                        <p className="font-bold text-text-primary mb-1">{t.help_q1}</p>
                        <p>{t.help_a1}</p>
                    </div>
                    <div>
                        <p className="font-bold text-text-primary mb-1">{t.help_q2}</p>
                        <p>{t.help_a2}</p>
                    </div>
                    <div>
                        <p className="font-bold text-text-primary mb-1">{t.help_q3}</p>
                        <p>{t.help_a3}</p>
                    </div>
                    <button onClick={() => setShowHelp(false)} className="w-full bg-primary/10 text-primary font-bold py-3 rounded-xl mt-2 active:scale-95 transition-transform">{t.help_btn}</button>
                </div>
            </BottomSheet>

            {/* Logout Confirm BottomSheet */}
            <BottomSheet isOpen={showLogoutConfirm} onClose={() => setShowLogoutConfirm(false)} title={t.konfirmasi_keluar_title}>
                <div className="px-2 pb-6 space-y-4">
                    <p className="text-sm text-text-secondary leading-relaxed font-medium">
                        {t.konfirmasi_keluar_desc}
                    </p>
                    <div className="flex gap-3 pt-2">
                        <button 
                            onClick={() => setShowLogoutConfirm(false)}
                            className="w-1/2 bg-bg-main text-text-secondary font-bold py-3.5 rounded-xl border border-border hover:bg-bg-card transition-colors active:scale-95"
                        >
                            {t.btn_batal}
                        </button>
                        <button 
                            onClick={async () => { await logoutUser(); window.location.reload(); }}
                            className="w-1/2 bg-error text-white font-bold py-3.5 rounded-xl hover:bg-error/90 transition-colors shadow-[0_4px_15px_rgba(230,57,70,0.3)] active:scale-95"
                        >
                            {t.keluar}
                        </button>
                    </div>
                </div>
            </BottomSheet>

            {/* Delete Account Confirm BottomSheet */}
            <BottomSheet isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title={t.konfirmasi_hapus_akun_title}>
                <div className="px-2 pb-6 space-y-4">
                    <p className="text-sm text-text-secondary leading-relaxed font-medium">
                        {t.konfirmasi_hapus_akun_desc}
                    </p>
                    <div className="flex gap-3 pt-2">
                        <button 
                            onClick={() => setShowDeleteConfirm(false)}
                            className="w-1/2 bg-bg-main text-text-secondary font-bold py-3.5 rounded-xl border border-border hover:bg-bg-card transition-colors active:scale-95"
                        >
                            {t.btn_batal}
                        </button>
                        <button 
                            onClick={handleDeleteAccount}
                            className="w-1/2 bg-error text-white font-bold py-3.5 rounded-xl hover:bg-error/90 transition-colors shadow-[0_4px_15px_rgba(230,57,70,0.3)] active:scale-95"
                        >
                            {t.hapus_akun}
                        </button>
                    </div>
                </div>
            </BottomSheet>
        </div>
    );
}

