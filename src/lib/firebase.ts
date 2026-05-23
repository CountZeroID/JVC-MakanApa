import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, RecaptchaVerifier, signInWithPhoneNumber, signOut, deleteUser } from 'firebase/auth';
import { getFirestore, collection, serverTimestamp, getDocs, addDoc, query, where, orderBy, doc, deleteDoc, Timestamp, setDoc, getDoc, writeBatch, updateDoc } from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Authentication Helpers
export const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
        const { signInWithRedirect } = await import('firebase/auth');
        return await signInWithRedirect(auth, provider);
    } else {
        return await signInWithPopup(auth, provider);
    }
};

export const logoutUser = async () => {
    await signOut(auth);
};

export const deleteAccount = async () => {
  const user = auth.currentUser;
  if (user) {
    await clearAllData();
    await deleteUser(user);
  }
};

export interface BahanMakanan {
  nama: string;
  estimasi_porsi: string;
  kalori: number;
}

export interface FoodLog {
  id?: string;
  userId: string;
  nama_makanan: string;
  emoji: string;
  kategori: string;
  meal_type: "sarapan" | "makan_siang" | "makan_malam" | "camilan";
  kalori: number;
  karbohidrat_g: number;
  protein_g: number;
  lemak_g: number;
  serat_g: number;
  gula_g?: number;
  natrium_mg?: number;
  kalsium_mg?: number;
  zat_besi_mg?: number;
  vitamin_c_mg?: number;
  vitamin_a_mcg?: number;
  vitamin_b12_mcg?: number;
  kalium_mg?: number;
  is_minuman?: boolean;
  volume_ml?: number;
  kafein_mg?: number;
  bahan_makanan?: BahanMakanan[];
  catatan_gizi?: string;
  imageUrl?: string;
  timestamp?: any;
  date_key: string;
}

export interface UserProfile {
  userId: string;
  nama: string;
  usia: number;
  gender: string;
  berat_kg: number;
  tinggi_cm: number;
  tujuan: string;
  alergi: string[];
  target_kalori: number;
  target_protein_g: number;
  target_karbo_g: number;
  target_lemak_g: number;
  foto_profil?: string;
}

export const saveUserProfile = async (profile: Omit<UserProfile, 'userId'>) => {
  if (!auth.currentUser) throw new Error("Unauthenticated");
  const path = 'user_profiles';
  try {
    const userRef = doc(db, path, auth.currentUser.uid);
    await setDoc(userRef, {
      ...profile,
      userId: auth.currentUser.uid
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const getUserProfile = async (uid?: string) => {
  const userId = uid || auth.currentUser?.uid;
  if (!userId) throw new Error("Unauthenticated");
  const path = 'user_profiles';
  try {
    const userRef = doc(db, path, userId);
    const docSnap = await getDoc(userRef);
    if (docSnap.exists()) {
      return docSnap.data() as UserProfile;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export interface NaraChat {
  id?: string;
  userId: string;
  role: 'user' | 'model' | 'assistant';
  text: string;
  timestamp: any;
  session_id: string;
  date_key?: string; // legacy support
}

export interface NaraSession {
  id?: string;
  userId: string;
  title: string;
  created_at: any;
  updated_at: any;
}

export const NaraChatsCollection = 'nara_chats';
export const NaraSessionsCollection = 'nara_sessions';

export const createNaraSession = async (title: string = 'New Chat'): Promise<string> => {
  if (!auth.currentUser) throw new Error("Unauthenticated");
  try {
    const sessionRef = collection(db, NaraSessionsCollection);
    const docRef = await addDoc(sessionRef, {
      userId: auth.currentUser.uid,
      title,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, NaraSessionsCollection);
    throw error;
  }
};

export const updateSessionTitle = async (sessionId: string, title: string) => {
  if (!auth.currentUser) return;
  try {
    const sessionRef = doc(db, NaraSessionsCollection, sessionId);
    await updateDoc(sessionRef, { title, updated_at: serverTimestamp() });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, NaraSessionsCollection);
  }
};

export const saveNaraChat = async (chat: Omit<NaraChat, 'id' | 'timestamp' | 'userId'>) => {
  if (!auth.currentUser) throw new Error("Unauthenticated");
  const path = NaraChatsCollection;
  try {
    const chatRef = collection(db, path);
    await addDoc(chatRef, {
      ...chat,
      userId: auth.currentUser.uid,
      timestamp: serverTimestamp()
    });
    // Also update session's updated_at
    if (chat.session_id) {
      const sessionRef = doc(db, NaraSessionsCollection, chat.session_id);
      await updateDoc(sessionRef, { updated_at: serverTimestamp() }).catch(() => {});
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const uploadFoodImage = async (base64Image: string): Promise<string | undefined> => {
  if (!auth.currentUser) return undefined;
  try {
    const filename = `food_images/${auth.currentUser.uid}/${Date.now()}.jpg`;
    const imageRef = ref(storage, filename);
    const splitData = base64Image.split(',');
    const base64Data = splitData.length > 1 ? splitData[1] : splitData[0];
    await uploadString(imageRef, base64Data, 'base64', { contentType: 'image/jpeg' });
    const downloadUrl = await getDownloadURL(imageRef);
    return downloadUrl;
  } catch (error) {
    console.error("Error uploading image:", error);
    return undefined;
  }
};

export const uploadProfileImage = async (base64Image: string): Promise<string | undefined> => {
  if (!auth.currentUser) return undefined;
  try {
    const filename = `profile_images/${auth.currentUser.uid}/${Date.now()}.jpg`;
    const imageRef = ref(storage, filename);
    const splitData = base64Image.split(',');
    const base64Data = splitData.length > 1 ? splitData[1] : splitData[0];
    await uploadString(imageRef, base64Data, 'base64', { contentType: 'image/jpeg' });
    const downloadUrl = await getDownloadURL(imageRef);
    return downloadUrl;
  } catch (error) {
    console.error("Error uploading profile image:", error);
    return undefined;
  }
};

export const saveFoodLog = async (log: Omit<FoodLog, 'id' | 'timestamp' | 'userId'>) => {
  if (!auth.currentUser) throw new Error("Unauthenticated");
  const path = 'food_logs';
  try {
    const docRef = await addDoc(collection(db, path), {
      ...log,
      userId: auth.currentUser.uid,
      timestamp: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const updateFoodLogImage = async (logId: string, imageUrl: string) => {
  if (!auth.currentUser) return;
  const path = 'food_logs';
  try {
    const docRef = doc(db, path, logId);
    await updateDoc(docRef, { imageUrl });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${path}/${logId}`);
  }
};

export const clearAllData = async () => {
  if (!auth.currentUser) return;
  const isAnonymous = auth.currentUser.isAnonymous;
  try {
    const batch = writeBatch(db);

    const logsQuery = query(collection(db, 'food_logs'), where('userId', '==', auth.currentUser.uid));
    const logsSnap = await getDocs(logsQuery);
    logsSnap.forEach((docSnap) => batch.delete(docSnap.ref));

    const chatsQuery = query(collection(db, NaraChatsCollection), where('userId', '==', auth.currentUser.uid));
    const chatsSnap = await getDocs(chatsQuery);
    chatsSnap.forEach((docSnap) => batch.delete(docSnap.ref));

    const sessionsQuery = query(collection(db, NaraSessionsCollection), where('userId', '==', auth.currentUser.uid));
    const sessionsSnap = await getDocs(sessionsQuery);
    sessionsSnap.forEach((docSnap) => batch.delete(docSnap.ref));

    const profileRef = doc(db, 'user_profiles', auth.currentUser.uid);
    batch.delete(profileRef);
    
    await batch.commit();
  } catch (error) {
    if (isAnonymous) {
      console.warn("Swallowed firestore deletion error for anonymous user:", error);
    } else {
      handleFirestoreError(error, OperationType.DELETE, 'clearAllData');
    }
  }
};

export const deleteFoodLog = async (logId: string) => {
  const path = `food_logs/${logId}`;
  try {
    await deleteDoc(doc(db, 'food_logs', logId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const getAllLogs = async () => {
  if (!auth.currentUser) return [];
  const path = 'food_logs';
  try {
    const q = query(
      collection(db, path),
      where('userId', '==', auth.currentUser.uid)
    );
    const querySnapshot = await getDocs(q);
    const results: FoodLog[] = [];
    querySnapshot.forEach((doc) => {
      results.push({ id: doc.id, ...doc.data() } as FoodLog);
    });
    return results.sort((a, b) => {
      const timeA = a.timestamp?.seconds || 0;
      const timeB = b.timestamp?.seconds || 0;
      return timeB - timeA;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return [];
  }
};

export const getLogsForDateRange = async (startDateKey: string, endDateKey: string) => {
  if (!auth.currentUser) return [];
  const path = 'food_logs';
  try {
    const q = query(
      collection(db, path),
      where('userId', '==', auth.currentUser.uid),
      where('date_key', '>=', startDateKey),
      where('date_key', '<=', endDateKey)
    );
    const querySnapshot = await getDocs(q);
    const results: FoodLog[] = [];
    querySnapshot.forEach((doc) => {
      results.push({ id: doc.id, ...doc.data() } as FoodLog);
    });
    return results.sort((a, b) => {
      const timeA = a.timestamp?.seconds || 0;
      const timeB = b.timestamp?.seconds || 0;
      return timeB - timeA; // Descending
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return [];
  }
};

export const getTodayLogs = async (dateKey: string) => {
  if (!auth.currentUser) return [];
  const path = 'food_logs';
  try {
    const q = query(
      collection(db, path),
      where('userId', '==', auth.currentUser.uid),
      where('date_key', '==', dateKey),
    );
    // Since timestamp requires complex index with multiple where keys, we will fetch and sort in memory if needed,
    // though the prompt requested 'orderBy timestamp'. Usually mixing == and orderBy on different fields needs a composite index.
    // I will sort client-side just to avoid index creation errors via code for now.
    const querySnapshot = await getDocs(q);
    const results: FoodLog[] = [];
    querySnapshot.forEach((doc) => {
      results.push({ id: doc.id, ...doc.data() } as FoodLog);
    });
    return results.sort((a, b) => {
      const timeA = a.timestamp?.seconds || 0;
      const timeB = b.timestamp?.seconds || 0;
      return timeB - timeA; // Descending
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};
