# MakanApa (#JuaraVibeCoding) 🍽️

**MakanApa** adalah aplikasi web modern berbasis *Progressive Web App* (PWA) untuk melacak asupan nutrisi dan kalori harian secara pintar. Aplikasi ini menggunakan teknologi *Artificial Intelligence* (AI) dari Google Gemini untuk memindai foto makanan dan secara otomatis memperkirakan jumlah kalori, protein, karbohidrat, dan lemak di dalamnya. 

Aplikasi ini dirancang khusus untuk membantu pengguna mencapai *body goals* mereka (Diet, Maintenance, atau Bulking) dengan cara yang sangat praktis dan menyenangkan.

---

## ✨ Fitur Utama

1. **Pemindai Makanan AI (AI Food Scanner)** 📸
   Unggah atau ambil foto makananmu, dan AI akan menganalisis nama makanan, takaran porsi, dan kandungan gizinya secara otomatis tanpa perlu *input* manual.
   
2. **Nara - Asisten Gizi AI** ✨
   Chatbot cerdas bernama Nara yang siap membantumu merencanakan menu makan, memberikan rekomendasi nutrisi sesuai tujuanmu, dan menjawab pertanyaan seputar diet. Nara memiliki memori dan memahami riwayat makanmu hari ini.

3. **Kalkulator BMR & Target Makro Dinamis** ⚖️
   Sistem otomatis menghitung kebutuhan kalori harian (BMR) dan rasio makronutrien (Protein, Karbo, Lemak) berdasarkan profil tubuh (usia, berat, tinggi, gender) dan tujuan (*diet/maintenance/bulking*).

4. **Statistik & Visualisasi Data** 📊
   Lacak progres harian, mingguan, dan bulanan melalui grafik interaktif yang indah, dilengkapi pelacakan status "Api Hari" (*Streak*) untuk menjaga motivasimu.

5. **Autentikasi Multi-Metode** 🔐
   Mendukung pendaftaran dan *login* aman menggunakan:
   * Google Sign-In (Dioptimalkan untuk *Desktop* dan *Mobile*).
   * Email & Password.
   * Nomor Handphone (OTP via Firebase).

6. **Lokalisasi (Bilingual)** 🌐
   Mendukung Bahasa Indonesia dan Bahasa Inggris untuk menjangkau pengguna yang lebih luas.

---

## 🛠️ Teknologi yang Digunakan (*Tech Stack*)

* **Frontend:** React 19, TypeScript, Vite
* **Styling & Animasi:** Tailwind CSS v4, Framer Motion, Lucide React
* **Backend & Database:** Firebase (Authentication, Cloud Firestore, Cloud Storage)
* **Artificial Intelligence:** Google Gemini API (`@google/genai` v1.29)
* **Visualisasi Data:** Recharts

---

## 📂 Struktur Direktori (*Codebase*)

```text
makanapa/
├── src/
│   ├── components/       # Komponen UI React (HomeScanner, DailyLog, NaraChat, dll)
│   ├── contexts/         # React Context untuk state global (SettingsContext)
│   ├── hooks/            # Custom hooks (useTranslation, useUnits)
│   ├── lib/              # Konfigurasi external API (firebase.ts, gemini.ts, utils.ts)
│   ├── App.tsx           # Entry point utama aplikasi & manajemen navigasi tab
│   └── index.css         # Styling global & Tailwind CSS variables
├── package.json          # Konfigurasi dependensi NPM
└── vite.config.ts        # Konfigurasi *bundler* Vite
```

---

## 🚀 Cara Menjalankan Secara Lokal (*Development*)

1. **Clone & Install Dependensi**
   Buka terminal di direktori proyek dan jalankan:
   ```bash
   npm install
   ```

2. **Konfigurasi Environment**
   Salin file `.env.example` menjadi `.env`:
   ```bash
   cp .env.example .env
   ```
   Lalu buka file `.env` dan masukkan API key kamu:
   - `GEMINI_API_KEY`: Dapatkan dari [Google AI Studio](https://aistudio.google.com/apikey)
   - `APP_URL`: URL lokal atau domain hosting kamu (contoh: `http://localhost:3000`)

3. **Jalankan Development Server**
   ```bash
   npm run dev
   ```
   Aplikasi akan berjalan di `http://localhost:3000`.

---
