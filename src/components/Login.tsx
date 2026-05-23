import React, { useState, useEffect } from 'react';
import { auth, signInWithGoogle } from '../lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import BottomSheet from './BottomSheet';
import { useTranslation } from '../hooks/useTranslation';

interface LoginProps {
    onLoginSuccess: () => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
    const [mode, setMode] = useState<'options' | 'email' | 'phone'>('options');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState('');
    const [confirmationResult, setConfirmationResult] = useState<any>(null);
    const [error, setError] = useState('');
    const [loadingMethod, setLoadingMethod] = useState<'google' | 'email' | 'phone' | 'otp' | 'guest' | null>(null);
    const [isSignUp, setIsSignUp] = useState(false);
    const [showAgreement, setShowAgreement] = useState(false);
    const t = useTranslation();

    useEffect(() => {
        const hasAgreed = localStorage.getItem('user_agreement_accepted');
        if (!hasAgreed) {
            // Slight delay to allow animations
            setTimeout(() => setShowAgreement(true), 500);
        }
    }, []);

    useEffect(() => {
        if (mode === 'phone') {
            if (window.recaptchaVerifier) {
                try { window.recaptchaVerifier.clear(); } catch (e) {}
                window.recaptchaVerifier = null;
            }
            try {
                window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
                    'size': 'invisible'
                });
            } catch (e) {
                console.error("Recaptcha error:", e);
            }
        }
    }, [mode]);

    const handleGoogle = async () => {
        if (!localStorage.getItem('user_agreement_accepted')) return setShowAgreement(true);
        try {
            setLoadingMethod('google');
            setError('');
            await signInWithGoogle();
            onLoginSuccess();
        } catch (err: any) {
            if (err.code === 'auth/popup-closed-by-user' || err.message.includes('popup-closed-by-user')) {
                setError('');
            } else if (err.code === 'auth/network-request-failed' || err.code === 'auth/popup-blocked') {
                setError('Gagal login. Jika kamu menggunakan Preview, browser mungkin memblokir popup. Silakan Buka Aplikasi di Tab Baru (klik ikon ↗️ di pojok kanan atas) untuk login dengan Google, atau gunakan "Lanjutkan sebagai Tamu".');
            } else {
                setError(err.message);
            }
            setLoadingMethod(null);
        }
    };

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!localStorage.getItem('user_agreement_accepted')) return setShowAgreement(true);
        setLoadingMethod('email');
        setError('');
        try {
            if (isSignUp) {
                await createUserWithEmailAndPassword(auth, email, password);
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
            onLoginSuccess();
        } catch (err: any) {
            let msg = err.message;
            if (err.code === 'auth/email-already-in-use') msg = 'Email sudah terdaftar. Silakan pindah ke mode Masuk.';
            else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') msg = 'Email atau password salah.';
            else if (err.code === 'auth/weak-password') msg = 'Password terlalu lemah (minimal 6 karakter).';
            else if (err.code === 'auth/invalid-email') msg = 'Format email tidak valid.';
            setError(msg);
            setLoadingMethod(null);
        }
    };

    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!localStorage.getItem('user_agreement_accepted')) return setShowAgreement(true);
        setLoadingMethod('phone');
        setError('');
        try {
            const appVerifier = window.recaptchaVerifier;
            const confirmation = await signInWithPhoneNumber(auth, phone, appVerifier);
            setConfirmationResult(confirmation);
        } catch (err: any) {
            let msg = err.message;
            if (err.code === 'auth/invalid-phone-number') msg = 'Nomor HP tidak valid. Gunakan format internasional (+62...).';
            else if (err.code === 'auth/too-many-requests') msg = 'Terlalu banyak percobaan kode OTP. Silakan coba lagi nanti.';
            setError(msg);
            // Reset reCAPTCHA on error
            if (window.recaptchaVerifier) {
                try {
                    window.recaptchaVerifier.render().then((widgetId: any) => {
                        if (typeof grecaptcha !== 'undefined') grecaptcha.reset(widgetId);
                    }).catch(() => {});
                } catch(e) {}
            }
        } finally {
            setLoadingMethod(null);
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoadingMethod('otp');
        setError('');
        try {
            await confirmationResult.confirm(otp);
            onLoginSuccess();
        } catch (err: any) {
            setError('Kode OTP salah atau kedaluwarsa.');
            setLoadingMethod(null);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-bg-main flex flex-col items-center px-6 antialiased overflow-y-auto py-12">
            <div id="recaptcha-container"></div>
            
            <div className="flex flex-col items-center justify-center text-center mb-12">
                <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6 shadow-[0_8px_30px_rgba(123,97,255,0.4)] overflow-hidden">
                    <img src="/icon.png" alt="MakanApa" className="w-full h-full object-cover" />
                </div>
                <h1 className="font-heading font-black text-text-primary text-4xl tracking-tight mb-2">MakanApa</h1>
                <p className="text-xl font-bold tracking-widest text-primary uppercase mb-2">Foto. Kenali. Sehat.</p>
                <p className="text-text-secondary font-medium text-sm px-4">Pantau nutrisi harianmu dengan mudah.</p>
            </div>

            {error && (
                <div className="bg-error/10 border border-error text-error text-sm font-bold p-4 rounded-xl mb-6 text-center">
                    {error}
                </div>
            )}

            {mode === 'options' && (
                <div className="w-full max-w-sm mx-auto space-y-4">
                    <button 
                        onClick={handleGoogle}
                        disabled={loadingMethod !== null}
                        className="w-full bg-bg-card border border-border text-text-primary font-bold py-4 rounded-xl flex items-center justify-center gap-3 shadow-sm hover:bg-border/30 transition-colors active:scale-[0.98] disabled:opacity-75 cursor-pointer disabled:cursor-not-allowed"
                    >
                        {loadingMethod === 'google' ? (
                            <div className="flex items-center gap-2">
                                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                Membuka Google...
                            </div>
                        ) : (
                            <>
                                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
                                Masuk dengan Google
                            </>
                        )}
                    </button>

                    <button 
                        onClick={() => setMode('email')}
                        disabled={loadingMethod !== null}
                        className="w-full bg-primary text-white font-bold py-4 rounded-xl shadow-[0_4px_20px_rgba(123,97,255,0.3)] hover:bg-primary-light transition-colors active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed"
                    >
                        Masuk dengan Email
                    </button>

                    <button 
                        onClick={() => setMode('phone')}
                        disabled={loadingMethod !== null}
                        className="w-full bg-transparent border-2 border-primary text-primary font-bold py-4 rounded-xl hover:bg-primary/5 transition-colors active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed"
                    >
                        Masuk dengan No. HP
                    </button>

                    <div className="flex items-center gap-4 py-4">
                        <div className="flex-1 h-px bg-border"></div>
                        <span className="text-xs font-bold text-text-muted uppercase tracking-wider">atau</span>
                        <div className="flex-1 h-px bg-border"></div>
                    </div>

                    <button 
                        onClick={() => {
                            setIsSignUp(true);
                            setMode('email');
                        }}
                        className="w-full text-text-secondary font-bold text-sm hover:text-primary transition-colors cursor-pointer"
                    >
                        Daftar akun baru
                    </button>
                    
                    <div className="flex items-center gap-4 py-4">
                        <div className="flex-1 h-px bg-border"></div>
                        <span className="text-xs font-bold text-text-muted uppercase tracking-wider">── atau ──</span>
                        <div className="flex-1 h-px bg-border"></div>
                    </div>

                    <button 
                        onClick={async () => {
                            if (!localStorage.getItem('user_agreement_accepted')) return setShowAgreement(true);
                            setLoadingMethod('guest');
                            try {
                                const { signInAnonymously } = await import('firebase/auth');
                                await signInAnonymously(auth);
                                onLoginSuccess();
                            } catch (e: any) {
                                setError(e.message);
                                setLoadingMethod(null);
                            }
                        }}
                        disabled={loadingMethod !== null}
                        className="w-full bg-transparent border border-border text-text-secondary font-bold py-3.5 rounded-xl flex items-center justify-center gap-3 shadow-sm hover:bg-bg-main transition-colors active:scale-[0.98] disabled:opacity-75 cursor-pointer disabled:cursor-not-allowed"
                    >
                        {loadingMethod === 'guest' ? (
                            <div className="flex items-center gap-2">
                                <div className="w-5 h-5 border-2 border-text-secondary border-t-transparent rounded-full animate-spin"></div>
                                Memproses...
                            </div>
                        ) : (
                            '👤 Lanjutkan sebagai Tamu'
                        )}
                    </button>

                    <p className="text-[10px] text-text-muted text-center pt-8 px-4 font-medium leading-relaxed">
                        Dengan masuk, kamu menyetujui Syarat & Ketentuan kami.
                    </p>
                </div>
            )}

            <BottomSheet isOpen={showAgreement} onClose={() => {}} title={t.agreement_title}>
                <div className="px-2 pb-6 pt-2">
                    <p className="text-sm text-text-secondary leading-relaxed mb-8">
                        {t.agreement_desc}
                    </p>
                    <button 
                        onClick={() => {
                            localStorage.setItem('user_agreement_accepted', 'true');
                            setShowAgreement(false);
                        }}
                        className="w-full bg-primary text-white font-bold py-4 rounded-xl shadow-[0_4px_20px_rgba(45,106,79,0.3)] hover:bg-primary-light transition-transform active:scale-[0.98] cursor-pointer"
                    >
                        {t.btn_setuju}
                    </button>
                </div>
            </BottomSheet>

            {mode === 'email' && (
                <div className="w-full max-w-sm mx-auto">
                    <form onSubmit={handleEmailAuth} className="space-y-4">
                        <div>
                            <input 
                                type="email" 
                                placeholder="Alamat Email"
                                className="w-full bg-bg-card border border-border rounded-xl px-4 py-4 text-base font-bold text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <input 
                                type="password" 
                                placeholder="Password"
                                className="w-full bg-bg-card border border-border rounded-xl px-4 py-4 text-base font-bold text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                        <button 
                            type="submit"
                            disabled={loadingMethod !== null}
                            className="w-full bg-primary text-white font-bold py-4 rounded-xl mt-2 active:scale-[0.98] transition-transform cursor-pointer disabled:cursor-not-allowed"
                        >
                            {loadingMethod === 'email' ? 'Memproses...' : (isSignUp ? 'Daftar' : 'Masuk')}
                        </button>
                    </form>
                    <div className="mt-6 text-center">
                        <button onClick={() => setIsSignUp(!isSignUp)} className="text-xs font-bold text-primary mb-4 block w-full cursor-pointer">
                            {isSignUp ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Daftar'}
                        </button>
                        <button onClick={() => { setMode('options'); setError(''); }} className="text-xs font-bold text-text-muted w-full cursor-pointer">
                            Kembali
                        </button>
                    </div>
                </div>
            )}

            {mode === 'phone' && (
                <div className="w-full max-w-sm mx-auto">
                    {!confirmationResult ? (
                        <form onSubmit={handleSendOtp} className="space-y-4">
                            <div>
                                <input 
                                    type="tel" 
                                    placeholder="No. HP (contoh: +62812...)"
                                    className="w-full bg-bg-card border border-border rounded-xl px-4 py-4 text-base font-bold text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    required
                                />
                                <p className="text-xs text-text-muted mt-2">Gunakan kode negara (misal +62 untuk Indonesia).</p>
                            </div>
                            <button 
                                type="submit"
                                disabled={loadingMethod !== null}
                                className="w-full bg-primary text-white font-bold py-4 rounded-xl mt-2 active:scale-[0.98] transition-transform"
                            >
                                {loadingMethod === 'phone' ? 'Mengirim...' : 'Kirim Kode OTP'}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleVerifyOtp} className="space-y-4">
                            <div>
                                <input 
                                    type="text" 
                                    placeholder="Kode OTP"
                                    className="w-full bg-bg-card border border-border rounded-xl px-4 py-4 text-base tracking-widest text-center font-bold text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    required
                                />
                            </div>
                            <button 
                                type="submit"
                                disabled={loadingMethod !== null}
                                className="w-full bg-primary text-white font-bold py-4 rounded-xl mt-2 active:scale-[0.98] transition-transform"
                            >
                                {loadingMethod === 'otp' ? 'Memverifikasi...' : 'Verifikasi OTP'}
                            </button>
                        </form>
                    )}
                    <div className="mt-6 text-center">
                        <button onClick={() => { setMode('options'); setError(''); setConfirmationResult(null); }} className="text-xs font-bold text-text-muted">
                            Kembali
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

declare global {
  interface Window {
    recaptchaVerifier: any;
  }
  const grecaptcha: any;
}
