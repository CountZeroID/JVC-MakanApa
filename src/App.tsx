import { useState, useEffect } from 'react';
import { Flame } from 'lucide-react';
import HomeScanner from './components/HomeScanner';
import DailyLog from './components/DailyLog';
import Statistics from './components/Statistics';
import Profile from './components/Profile';
import NaraChat from './components/NaraChat';
import Onboarding from './components/Onboarding';
import Login from './components/Login';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, getDocs, doc, getDoc, setDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { format, subDays } from 'date-fns';
import { preWarmGemini } from './lib/gemini';
import { cn } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from './hooks/useTranslation';

type AppState = 'loading' | 'login' | 'onboarding' | 'main';

export default function App() {
  const [appState, setAppState] = useState<AppState>('loading');
  const [activeTab, setActiveTab] = useState<'scan' | 'log' | 'nara' | 'stats' | 'profile'>('scan');
  const t = useTranslation();
  
  const [targetKalori, setTargetKalori] = useState(2000);
  const [userName, setUserName] = useState('');
  const [showWelcome, setShowWelcome] = useState(false);
  const [totalCalsToday, setTotalCalsToday] = useState(0);
  const [streak, setStreak] = useState(0);
  const [showNaraPulse, setShowNaraPulse] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  const migrateLocalProfile = async (uid: string) => {
    try {
      const localProfile = localStorage.getItem('userProfile');
      if (!localProfile) return;
      
      const docRef = doc(db, 'user_profiles', uid);
      const docSnap = await getDoc(docRef);
      
      // Only migrate if no cloud profile exists yet
      if (!docSnap.exists()) {
        await setDoc(docRef, {
          ...JSON.parse(localProfile),
          userId: uid
        });
      }
      
      // Clear localStorage after migration
      localStorage.removeItem('userProfile');
    } catch (e) {
      console.error('Failed to migrate local profile:', e);
    }
  };

  const migrateLocalFoodLogs = async (uid: string) => {
    try {
      const localLogs = localStorage.getItem('foodLogs');
      if (!localLogs) return;
      
      const logs = JSON.parse(localLogs);
      for (const log of logs) {
        await addDoc(collection(db, 'food_logs'), {
          ...log,
          timestamp: serverTimestamp(),
          userId: uid
        });
      }
      localStorage.removeItem('foodLogs');
    } catch(e) {
      console.error('Failed to migrate food logs:', e);
    }
  };

  useEffect(() => {
    preWarmGemini();
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        
        // Run migrations in the background
        migrateLocalProfile(firebaseUser.uid).catch(console.error);
        migrateLocalFoodLogs(firebaseUser.uid).catch(console.error);

        try {
          const docRef = doc(db, 'user_profiles', firebaseUser.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const profile = docSnap.data();
            setUserName(profile.nama || '');
            setTargetKalori(profile.target_kalori || 2000);
            setAppState('main');
          } else {
            setAppState('onboarding');
          }
          
          // Calculate today's calories — only fetch today's logs (not all logs)
          const dateKey = format(new Date(), 'yyyy-MM-dd');
          const logsQ = query(
            collection(db, 'food_logs'),
            where("userId", "==", firebaseUser.uid),
            where("date_key", "==", dateKey)
          );
          const logsSnap = await getDocs(logsQ);
          
          let todayCals = 0;
          logsSnap.forEach(d => {
            todayCals += d.data().kalori;
          });
          setTotalCalsToday(todayCals);

          // Calculate streak with a separate bounded query (last 60 days max)
          const sixtyDaysAgo = format(subDays(new Date(), 60), 'yyyy-MM-dd');
          const streakQ = query(
            collection(db, 'food_logs'),
            where("userId", "==", firebaseUser.uid),
            where("date_key", ">=", sixtyDaysAgo)
          );
          const streakSnap = await getDocs(streakQ);
          const datesSet = new Set<string>();
          streakSnap.forEach(d => {
            const dk = d.data().date_key;
            if (dk) datesSet.add(dk);
          });

          // Calculate streak
          let currentStreak = 0;
          let checkDate = new Date();
          if (datesSet.has(format(checkDate, 'yyyy-MM-dd'))) {
              currentStreak = 1;
              checkDate = subDays(checkDate, 1);
          } else if (datesSet.has(format(subDays(checkDate, 1), 'yyyy-MM-dd'))) {
              currentStreak = 1;
              checkDate = subDays(checkDate, 2);
          }
          
          while (datesSet.has(format(checkDate, 'yyyy-MM-dd'))) {
              currentStreak++;
              checkDate = subDays(checkDate, 1);
          }
          setStreak(currentStreak);

          // Check Nara Pulse
          const lastNaraStr = localStorage.getItem('lastNaraOpen');
          if (!lastNaraStr) {
              setShowNaraPulse(true);
          } else {
              const lastNara = parseInt(lastNaraStr, 10);
              if (Date.now() - lastNara > 4 * 60 * 60 * 1000) {
                  setShowNaraPulse(true);
              }
          }
        } catch(e) {
          console.error('Error fetching user data:', e);
          // Better logic: handle error but don't show blank screen
          setAppState('main');
        }
      } else {
        setUser(null);
        setAppState('login');
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
     if (activeTab === 'nara') {
         localStorage.setItem('lastNaraOpen', Date.now().toString());
         setShowNaraPulse(false);
     }
  }, [activeTab]);

  const handleOnboardingComplete = (nama: string, targetCal: number) => {
    setUserName(nama);
    setTargetKalori(targetCal);
    setAppState('main');
    setShowWelcome(true);
    setTimeout(() => {
      setShowWelcome(false);
    }, 5000);
  };

  const handleOpenNara = () => setActiveTab('nara');

  if (appState === 'loading') {
    return (
      <div className="min-h-screen sm:bg-border justify-center sm:py-6 flex font-body bg-bg-main items-center text-center">
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4"></div>
          <p className="text-primary font-bold">{t.loading_app}</p>
        </div>
      </div>
    );
  }

  if (appState === 'login') {
    return <Login onLoginSuccess={() => {}} />;
  }

  if (appState === 'onboarding') {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  return (
    <div className="min-h-screen bg-bg-main">
      <div className="w-full bg-bg-main h-[100dvh] overflow-hidden relative flex flex-col mx-auto">
        {/* Toast Welcome */}
        <AnimatePresence>
          {showWelcome && (
            <motion.div 
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
              className="absolute top-4 inset-x-4 z-50 bg-primary text-white p-4 rounded-[20px] shadow-[0_8px_30px_rgba(45,106,79,0.3)] flex items-center gap-3 border border-primary-light/30"
            >
              <span className="text-2xl">🎉</span>
              <div>
                <p className="font-bold text-sm tracking-tight text-white">{t.greeting} {userName}!</p>
                <p className="text-xs font-semibold text-white/90">Target harianmu: {targetKalori} kcal 🎯</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 bg-bg-card border-b border-border shrink-0 z-10">
          <div>
            <h1 className="text-primary text-2xl font-extrabold tracking-tight leading-none font-heading mb-1.5">{t.greeting}, {userName}! 👋</h1>
            <div className="inline-flex items-center gap-1.5 bg-primary/10 px-2.5 py-1 rounded-full border border-primary/20">
               <span className="text-xs">🔥</span>
               <span className="text-primary font-bold text-[11px] tracking-wide">{totalCalsToday}/{targetKalori} kcal</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-[#FFF4E5] px-3 py-1.5 rounded-full border border-[#FFE0A3]">
            <Flame size={14} className="text-accent" />
            <span className="text-accent font-bold text-xs tracking-tight">{streak} {t.hari_streak}</span>
          </div>
        </header>

        {/* Main Content Area */}
        <main className={cn(
          "flex-1 relative hidden-scrollbar",
          activeTab === 'nara' ? "overflow-hidden" : "overflow-y-auto pb-20"
        )}>
          {activeTab === 'scan' && <HomeScanner onSaveSuccess={() => { setActiveTab('log'); }} />}
          {activeTab === 'log' && <DailyLog targetKalori={targetKalori} onOpenNara={handleOpenNara} />}
          {activeTab === 'nara' && <NaraChat />}
          {activeTab === 'stats' && <Statistics targetKalori={targetKalori} />}
          {activeTab === 'profile' && <Profile onTargetUpdated={setTargetKalori} onOpenNara={() => setActiveTab('nara')} />}
        </main>

        {/* Bottom Navigation */}
        <nav 
          className="min-h-[64px] bg-bg-card border-t border-border flex items-center justify-around px-2 pb-0 shadow-[0_-2px_20px_rgba(0,0,0,0.08)] shrink-0 z-50 pt-1"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <NavItem 
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            } 
            label={t.nav_scan} 
            isActive={activeTab === 'scan'} 
            onClick={() => setActiveTab('scan')} 
          />
          <NavItem 
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
            } 
            label={t.nav_harian} 
            isActive={activeTab === 'log'} 
            onClick={() => setActiveTab('log')} 
          />
          <NavItem 
            icon={
              <div className="relative">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path><path d="M5 3v4"></path><path d="M19 17v4"></path><path d="M3 5h4"></path><path d="M17 19h4"></path></svg>
                {showNaraPulse && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#7B61FF] rounded-full border border-white animate-pulse"></span>}
              </div>
            } 
            label={t.nav_nara} 
            isActive={activeTab === 'nara'} 
            onClick={() => setActiveTab('nara')} 
          />
          <NavItem 
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
            } 
            label={t.nav_statistik} 
            isActive={activeTab === 'stats'} 
            onClick={() => setActiveTab('stats')} 
          />
          <NavItem 
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            } 
            label={t.nav_profil} 
            isActive={activeTab === 'profile'} 
            onClick={() => setActiveTab('profile')} 
          />
        </nav>
      </div>
    </div>
  );
}

function NavItem({ icon, label, isActive, onClick }: { icon: React.ReactNode, label: string, isActive: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick} 
      className="flex flex-col items-center gap-1.5 w-16 group"
    >
      <div className={cn(
        "w-12 h-8 flex items-center justify-center rounded-full transition-all duration-300",
        isActive ? "bg-primary-light text-white" : "text-text-muted group-hover:bg-black/5"
      )}>
        {icon}
      </div>
      <span className={cn(
        "text-[10px] font-bold transition-colors duration-300",
        isActive ? "text-primary" : "text-text-muted group-hover:text-text-secondary"
      )}>{label}</span>
    </button>
  );
}

