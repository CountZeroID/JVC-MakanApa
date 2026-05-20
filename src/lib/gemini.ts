import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const GEMINI_SYSTEM_PROMPT = `
Kamu adalah ahli gizi dan computer vision expert.
Analisis foto makanan ini dengan sangat detail.

TUGAS:
1. Identifikasi SETIAP bahan/makanan yang terlihat secara terpisah
2. Estimasi berat/jumlah masing-masing dengan mempertimbangkan:
   - Ukuran piring/wadah sebagai referensi skala
   - Volume dan kepadatan visual makanan
   - Jumlah item yang bisa dihitung (misal: 2 butir telur, 3 potong ayam)
3. Hitung nilai gizi per bahan, lalu total keseluruhan
4. Berlaku untuk SEMUA jenis makanan (Indonesia, Western, Asian, dll)

Return ONLY this JSON, no other text:
{
  "nama_makanan": "string",
  "emoji": "string",
  "kategori": "Makanan Berat|Camilan|Minuman|Buah|Dessert",
  "deskripsi_singkat": "string",
  "bahan_makanan": [
    {
      "nama": "string",
      "estimasi_porsi": "string",
      "kalori": number,
      "karbohidrat_g": number,
      "protein_g": number,
      "lemak_g": number,
      "serat_g": number
    }
  ],
  "total": {
    "kalori": number,
    "karbohidrat_g": number,
    "protein_g": number,
    "lemak_g": number,
    "serat_g": number,
    "gula_g": number,
    "natrium_mg": number,
    "kalsium_mg": number,
    "zat_besi_mg": number,
    "vitamin_c_mg": number,
    "vitamin_a_mcg": number,
    "vitamin_b12_mcg": number,
    "kalium_mg": number
  },
  "is_minuman": boolean,
  "volume_ml": number,
  "kafein_mg": number,
  "confidence": "tinggi|sedang|rendah",
  "catatan_gizi": "string",
  "cocok_untuk": ["string"],
  "perlu_diperhatikan": ["string"]
}

Jika is_minuman: true, juga masukkan:
- volume_ml (estimasi volume dalam ml)
- kafein_mg (estimasi kandungan kafein dalam mg jika relevan, misal kopi/teh)
- kandungan gula (gula_g) secara detail

If not food: {"error": "Bukan makanan", "pesan": "Coba foto makanan atau minumanmu!"}
`;

export interface Ingredient {
  nama: string;
  estimasi_porsi: string;
  kalori: number;
  karbohidrat_g: number;
  protein_g: number;
  lemak_g: number;
  serat_g: number;
}

export interface FoodAnalysisResult {
  nama_makanan?: string;
  emoji?: string;
  kategori?: string;
  deskripsi_singkat?: string;
  bahan_makanan?: Ingredient[];
  total?: {
    kalori: number;
    karbohidrat_g: number;
    protein_g: number;
    lemak_g: number;
    serat_g: number;
    gula_g: number;
    natrium_mg: number;
    kalsium_mg: number;
    zat_besi_mg: number;
    vitamin_c_mg: number;
    vitamin_a_mcg: number;
    vitamin_b12_mcg: number;
    kalium_mg: number;
  };
  is_minuman?: boolean;
  volume_ml?: number;
  kafein_mg?: number;
  confidence?: "tinggi" | "sedang" | "rendah";
  catatan_gizi?: string;
  cocok_untuk?: string[];
  perlu_diperhatikan?: string[];
  error?: string;
  pesan?: string;
}

export const generateWeeklyInsights = async (metricsStr: string): Promise<string[]> => {
  try {
    const prompt = `
Sebagai ahli gizi pro bernama Nara, berikan 2-3 insight singkat, personal, dan asyik berdasarkan data nutrisi mingguan berikut.
Fokus pada pola, pencapaian, atau area yang perlu diperbaiki (seperti kurang protein, gula berlebih, dsb).
Setiap insight adalah 1 kalimat.
Gunakan gaya bahasa obrolan teman, tanpa salam pembuka/penutup.
Format respons: JSON array of string.
Contoh: ["Protein kamu rata-rata 45g/hari, di bawah target 60g. Coba tambah telur atau tahu di sarapan!", "Hebat, vitamin C kamu terpenuhi dengan baik minggu ini!"]

Data: ${metricsStr}
`;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const text = response.text;
    if (text) {
      return JSON.parse(text);
    }
  } catch (error) {
    console.error("Gemini weekly insights error:", error);
  }
  return [];
};

export const analyzeFoodImage = async (base64Image: string, mimeType: string): Promise<FoodAnalysisResult> => {
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Analisis memakan waktu terlalu lama. Coba foto dengan pencahayaan lebih baik ya!")), 15000);
    });

    const aiPromise = ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Image,
              mimeType: mimeType,
            },
          },
          { text: "Analisis foto ini." }
        ]
      },
      config: {
        systemInstruction: GEMINI_SYSTEM_PROMPT,
        responseMimeType: "application/json",
      }
    });

    const response = await Promise.race([aiPromise, timeoutPromise]);

    const jsonStr = response.text?.trim() || "{}";
    const result = JSON.parse(jsonStr);
    return result;
  } catch (error: any) {
    console.error("Error calling Gemini API:", error);
    if (error.message.includes("Analisis memakan waktu terlalu lama")) {
        throw error;
    }
    throw new Error("Gagal menganalisis gambar.");
  }
};

export const chatWithNara = async (
  message: string, 
  history: { role: 'user' | 'model', parts: { text: string }[]}[],
  userContext: {
    nama: string;
    tujuan: string;
    alergi: string;
    target_kalori: number;
    target_protein: number;
    target_karbo: number;
    target_lemak: number;
    today_log_summary: string;
    total_kalori_hari_ini: number;
    sisa_kalori: number;
    currentTime: string;
    language?: 'id' | 'en' | string;
  }
) => {
  const isEn = userContext.language === 'en';
  
  const NARA_SYSTEM_PROMPT = `
Kamu adalah Nara, AI asisten gizi dari MakanApa.

IDENTITASMU:
Nama "Nara" berasal dari kata Sansekerta yang berarti "makhluk yang penuh kehidupan". Terinspirasi dari keyakinan bahwa makanan yang baik adalah sumber kehidupan sejati.

Ketika ditanya siapa kamu, perkenalkan diri persis seperti ini:
"Hei! Aku Nara 👋 Namaku dari kata Sansekerta artinya 'makhluk yang penuh kehidupan' — karena aku percaya makanan baik adalah sumber kehidupan sejati ✨ Aku hadir bukan sebagai ahli gizi yang kaku, tapi sebagai teman yang ngerti gizi dan selalu ada buat kamu 😊
Ada yang bisa aku bantu?"

PROFIL USER:
Nama: ${userContext.nama} | Tujuan: ${userContext.tujuan} | Alergi: ${userContext.alergi}
Target harian: ${userContext.target_kalori} kcal | Protein: ${userContext.target_protein}g | Karbo: ${userContext.target_karbo}g | Lemak: ${userContext.target_lemak}g

WAKTU SAAT INI: ${userContext.currentTime}

LOG HARI INI:
${userContext.today_log_summary || 'Belum ada makanan yang dicatat hari ini.'}
Sudah dikonsumsi: ${userContext.total_kalori_hari_ini} kcal | Sisa: ${userContext.sisa_kalori} kcal

KEPRIBADIAN:
- Santai dan hangat seperti teman yang peduli
- Bahasa Indonesia kasual, gunakan "kamu" bukan "Anda"
- Saran spesifik dan actionable, tidak generik
- PERHATIAN: User memiliki ALERGI: ${userContext.alergi}. JANGAN PERNAH menyarankan makanan yang mengandung bahan tersebut!
- Selalu pertimbangkan alergi dan tujuan user
- Jangan pernah menyalahkan pola makan user
- Jika lewat target -> tetap supportif dan bantu recovery
- Pertanyaan medis serius -> sarankan konsultasi dokter
- Gunakan emoji secukupnya (tidak berlebihan)

${isEn ? "You must respond in English only." : "Kamu harus menjawab dalam Bahasa Indonesia."}
`;

  try {
    const chatSession = ai.chats.create({
      model: "gemini-3.5-flash",
      config: {
        systemInstruction: NARA_SYSTEM_PROMPT,
        temperature: 0.7,
      },
      history: history
    });

    const result = await chatSession.sendMessage({ message });
    return result.text;
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    return "Maaf, Nara lagi sedikit gangguan teknis nih. Coba lagi bentar ya! 🥺";
  }
};

export const preWarmGemini = async () => {
    try {
        await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: { parts: [{ text: "Ping" }] }
        });
    } catch (e) {
        // silently ignore
    }
};

export const translateUIStrings = async (baseStrings: Record<string, string>, targetLangName: string): Promise<Record<string, string>> => {
  const prompt = `Translate this JSON object from Indonesian to ${targetLangName}.
Return ONLY the translated JSON with the same keys, no other text.
Keep these words untranslated: "Nara", "MakanApa", "kcal", "BMI".
For Arabic, ensure right-to-left text is correct.

${JSON.stringify(baseStrings)}`;

  try {
    const response = await ai.models.generateContent({
        model: "gemini-3.5-flash", // Using a fast model for UI translation
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.1,
        }
    });
    const text = response.text;
    if (text) {
      return JSON.parse(text);
    }
  } catch (error) {
    console.error("Gemini translation error:", error);
  }
  
  return baseStrings;
};
