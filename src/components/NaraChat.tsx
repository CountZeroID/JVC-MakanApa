import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, Plus, History as HistoryIcon, ChevronRight, Trash2 } from 'lucide-react';
import { chatWithNara } from '../lib/gemini';
import { auth, NaraChatsCollection, saveNaraChat, getUserProfile, NaraChat as NaraChatType, db } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, getDocs, writeBatch } from 'firebase/firestore';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { useTranslation } from '../hooks/useTranslation';
import { useSettings } from '../contexts/SettingsContext';
import BottomSheet from './BottomSheet';

export default function NaraChat() {
    const { settings } = useSettings();
    const t = useTranslation();
    const [messages, setMessages] = useState<NaraChatType[]>([]);
    const [inputText, setInputText] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const greetingTriggered = useRef(false);
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    
    const [currentDateKey, setCurrentDateKey] = useState<string>(todayStr);
    const [pendingGreeting, setPendingGreeting] = useState<string | null>(null);
    const [showHistory, setShowHistory] = useState(false);
    const [historyDates, setHistoryDates] = useState<string[]>([]);

    useEffect(() => {
        if (!auth.currentUser) return;
        
        const q = query(
            collection(db, NaraChatsCollection),
            where("userId", "==", auth.currentUser.uid),
            where("date_key", "==", currentDateKey),
            orderBy("timestamp", "asc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NaraChatType));
            setMessages(msgs);
            
            // Generate greeting if this is the first message today (only once)
            if (currentDateKey === todayStr && msgs.length === 0 && !greetingTriggered.current) {
                greetingTriggered.current = true;
                generateGreeting();
            }
        });

        return () => unsubscribe();
    }, [currentDateKey]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, pendingGreeting, isLoading]);

    const buildContext = async () => {
        const profile = await getUserProfile();
        if (!profile) throw new Error("Profile not found");

        // get today's logs
        const logsQ = query(
            collection(db, 'food_logs'),
            where("userId", "==", auth.currentUser?.uid),
            where("date_key", "==", todayStr)
        );
        const logsSnap = await getDocs(logsQ);
        
        let totalCals = 0;
        const mealGroups: Record<string, any[]> = { sarapan: [], makan_siang: [], makan_malam: [], camilan: [] };
        
        logsSnap.forEach(doc => {
            const data = doc.data();
            totalCals += data.kalori;
            if (mealGroups[data.meal_type]) mealGroups[data.meal_type].push(data);
        });

        const logSummary = Object.entries(mealGroups).map(([type, meals]) => {
            if (meals.length === 0) return `${type}: belum ada`;
            return `${type}: ` + meals.map(m => `${m.nama_makanan} (${m.kalori}kcal)`).join(', ');
        }).join('\\n');

        return {
            nama: profile.nama,
            tujuan: profile.tujuan,
            alergi: profile.alergi.join(', '),
            target_kalori: profile.target_kalori,
            target_protein: profile.target_protein_g,
            target_karbo: profile.target_karbo_g,
            target_lemak: profile.target_lemak_g,
            today_log_summary: logSummary,
            total_kalori_hari_ini: totalCals,
            sisa_kalori: profile.target_kalori - totalCals,
            currentTime: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            language: settings.language
        };
    };

    const generateGreeting = async () => {
        setIsLoading(true);
        try {
            const context = await buildContext();
            const message = "Sapa aku dengan singkat dan personal, beri tahu progress kaloriku hari ini dan tawarkan bantuan.";
            
            const response = await chatWithNara(message, [], context);
            
            setPendingGreeting(response);
        } catch (error) {
            console.error(error);
            setPendingGreeting(t.nara_error);
        } finally {
            setIsLoading(false);
        }
    };

    const loadHistoryDates = async () => {
        if (!auth.currentUser) return;
        const q = query(
            collection(db, NaraChatsCollection),
            where("userId", "==", auth.currentUser.uid)
        );
        const snap = await getDocs(q);
        const dates = new Set<string>();
        snap.forEach(doc => dates.add(doc.data().date_key));
        const sorted = Array.from(dates).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
        setHistoryDates(sorted);
    };

    const handleOpenHistory = async () => {
        setShowHistory(true);
        await loadHistoryDates();
    };

    const handleDeleteHistoryDate = async (date: string) => {
        if (!auth.currentUser) return;
        
        try {
            const q = query(
                collection(db, NaraChatsCollection),
                where("userId", "==", auth.currentUser.uid),
                where("date_key", "==", date)
            );
            const snap = await getDocs(q);
            
            const batch = writeBatch(db);
            snap.forEach(docSnap => {
                batch.delete(docSnap.ref);
            });
            await batch.commit();

            if (currentDateKey === date) {
                setMessages([]);
                if (date === todayStr) {
                    greetingTriggered.current = false;
                    setPendingGreeting(null);
                    generateGreeting();
                }
            }

            await loadHistoryDates();
        } catch (error) {
            console.error("Error deleting history for date:", date, error);
        }
    };

    const handleSend = async (text: string) => {
        if (!text.trim() || isLoading) return;
        
        const userMsg = text.trim();
        setInputText("");
        setIsLoading(true);

        try {
            // Save greeting first if exists
            if (currentDateKey === todayStr && messages.length === 0 && pendingGreeting) {
                await saveNaraChat({
                     role: 'model',
                     text: pendingGreeting,
                     date_key: todayStr
                });
                setPendingGreeting(null);
            }

            // Save user message
            await saveNaraChat({
                role: 'user',
                text: userMsg,
                date_key: currentDateKey
            });

            const context = await buildContext();
            
            // Format history
            const history = messages.map(m => ({
                role: m.role === 'assistant' ? 'model' : m.role,
                parts: [{ text: m.text }]
            }));

            // Call API
            const response = await chatWithNara(userMsg, history, context);
            
            // Save Nara message
            await saveNaraChat({
                role: 'model',
                text: response,
                date_key: currentDateKey
            });
        } catch (error) {
            console.error(error);
            await saveNaraChat({
                role: 'model',
                text: t.nara_error,
                date_key: currentDateKey
            });
        } finally {
            setIsLoading(false);
        }
    };

    const displayMessages = [...messages];
    if (currentDateKey === todayStr && messages.length === 0 && pendingGreeting) {
        displayMessages.push({
            id: 'pending-greeting',
            role: 'model',
            text: pendingGreeting,
            date_key: todayStr,
            timestamp: new Date()
        } as NaraChatType);
    }

    return (
        <div className="flex flex-col h-full bg-bg-main relative">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-bg-card sticky top-0 z-10 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-gradient-to-br from-[#7B61FF] to-[#A28DF6] shadow-[0_4px_12px_rgba(123,97,255,0.3)]">
                        <span className="text-xl pt-0.5">✨</span>
                    </div>
                    <div>
                        <h2 className="text-base font-black font-heading text-text-primary flex items-center gap-1.5">
                            Nara <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        </h2>
                        <p className="text-[10px] font-bold text-text-muted mt-0.5 tracking-wide">{t.nara_subtitle}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleOpenHistory} className="p-2 text-text-secondary bg-bg-main border border-border rounded-xl hover:bg-border/50 transition-colors">
                        <HistoryIcon size={18} />
                    </button>
                    <button onClick={() => setCurrentDateKey(todayStr)} className="p-2 text-white bg-primary rounded-xl hover:bg-primary-light transition-colors shadow-sm">
                        <Plus size={18} />
                    </button>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 pb-4">
                {displayMessages.map((msg, i) => {
                    const isUser = msg.role === 'user';
                    return (
                        <motion.div 
                            key={msg.id || i}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={cn("flex", isUser ? "justify-end" : "justify-start gap-2")}
                        >
                            {!isUser && (
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7B61FF] to-[#A28DF6] shrink-0 flex items-center justify-center self-end shadow-sm">
                                    <span className="text-sm">✨</span>
                                </div>
                            )}
                            <div className={cn(
                                "max-w-[80%] p-4 rounded-[20px] text-[13px] font-medium leading-relaxed",
                                isUser 
                                    ? "bg-primary text-white rounded-br-[4px] shadow-[0_4px_12px_rgba(45,106,79,0.15)]" 
                                    : "bg-primary/10 text-text-primary rounded-bl-[4px]"
                            )}>
                                {isUser ? msg.text : (
                                    <ReactMarkdown
                                        components={{
                                            p: ({children}) => (
                                                <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
                                            ),
                                            strong: ({children}) => (
                                                <strong className="font-semibold">{children}</strong>
                                            ),
                                            ol: ({children}) => (
                                                <ol className="list-decimal list-outside ml-4 space-y-2 my-2">
                                                {children}
                                                </ol>
                                            ),
                                            ul: ({children}) => (
                                                <ul className="list-disc list-outside ml-4 space-y-2 my-2">
                                                {children}
                                                </ul>
                                            ),
                                            li: ({children}) => (
                                                <li className="leading-relaxed pl-1">{children}</li>
                                            ),
                                        }}
                                    >
                                        {msg.text}
                                    </ReactMarkdown>
                                )}
                            </div>
                        </motion.div>
                    );
                })}

                {isLoading && (
                    <div className="flex justify-start gap-2 animate-in fade-in">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7B61FF] to-[#A28DF6] shrink-0 flex items-center justify-center self-end shadow-sm">
                            <span className="text-sm">✨</span>
                        </div>
                        <div className="bg-primary/10 px-4 py-3 rounded-[20px] rounded-bl-[4px] flex items-center gap-1">
                            <motion.div className="w-1.5 h-1.5 rounded-full bg-primary" animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} />
                            <motion.div className="w-1.5 h-1.5 rounded-full bg-primary" animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} />
                            <motion.div className="w-1.5 h-1.5 rounded-full bg-primary" animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            {currentDateKey !== todayStr ? (
                <div className="bg-bg-card border-t border-border p-4 shrink-0 text-center text-sm font-medium text-text-muted">
                    {t.nav_history}: {format(new Date(currentDateKey), 'dd MMM yyyy')}
                </div>
            ) : (
                <div className="bg-bg-card border-t border-border p-4 shrink-0">
                    <div className="flex overflow-x-auto hidden-scrollbar gap-2 mb-3 pb-1">
                        {[t.nara_chip1, t.nara_chip2, t.nara_chip3, t.nara_chip4].map((action, idx) => (
                            <button
                                key={idx}
                                onClick={() => handleSend(action)}
                                className="shrink-0 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold rounded-xl transition-colors border border-primary/20"
                            >
                                {action}
                            </button>
                        ))}
                    </div>

                    <div className="relative flex items-center">
                        <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend(inputText)}
                            placeholder={t.nara_placeholder}
                            disabled={isLoading}
                            className="w-full bg-bg-main border border-border/50 rounded-full pl-5 pr-12 py-3.5 text-sm font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-[#7B61FF]/30 placeholder:text-text-muted"
                        />
                        <button
                            onClick={() => handleSend(inputText)}
                            disabled={!inputText.trim() || isLoading}
                            className="absolute right-2 p-2 bg-primary hover:bg-primary-light text-white rounded-full transition-transform disabled:opacity-50 disabled:hover:scale-100 hover:scale-105 active:scale-95"
                        >
                            <Send size={16} className="-ml-0.5" />
                        </button>
                    </div>
                </div>
            )}

            <BottomSheet isOpen={showHistory} onClose={() => setShowHistory(false)} title={t.nav_history}>
                <div className="px-4 pb-6 space-y-2">
                    {historyDates.length === 0 ? (
                        <p className="text-sm font-medium text-text-muted text-center py-4">{t.belum_ada_riwayat}</p>
                    ) : (
                        historyDates.map(date => (
                            <div
                                key={date}
                                className="w-full flex items-center justify-between p-4 rounded-xl border border-border bg-bg-main hover:border-primary/30 transition-all text-left"
                            >
                                <button
                                    onClick={() => {
                                        setCurrentDateKey(date);
                                        setShowHistory(false);
                                    }}
                                    className="flex-1 text-sm font-bold text-text-primary text-left focus:outline-none"
                                >
                                    {format(new Date(date), 'dd MMMM yyyy')}
                                </button>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            await handleDeleteHistoryDate(date);
                                        }}
                                        className="p-1.5 text-text-muted hover:text-error hover:bg-error/10 rounded-lg transition-colors cursor-pointer"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                    <ChevronRight size={16} className="text-text-muted" />
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </BottomSheet>
        </div>
    );
}
