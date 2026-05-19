<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# 🥗 MakanApa - AI Nutrition Tracker

**MakanApa** adalah aplikasi pelacak nutrisi harian cerdas yang ditenagai oleh **Google Gemini AI**. Cukup foto makananmu, dan biarkan AI mengenali kandungan gizi dan kalorinya secara instan!

Proyek ini dibangun secara khusus untuk diikutsertakan dalam kompetisi **Juara Vibe Coding** yang diselenggarakan oleh **Google for Developers**.

---

## ✨ Fitur Utama

- **🤖 AI Food Scanner**: Mengenali makanan dari foto dan memperkirakan jumlah kalori, protein, lemak, dan karbohidrat secara _real-time_ menggunakan **Google Gemini**.
- **🔐 Firebase Auth**: Sistem login aman dan cepat menggunakan Google, Email, Nomor HP (OTP), atau mode Tamu (Guest).
- **☁️ Cloud Firestore**: Data nutrisi harian tersimpan dengan aman di _cloud_ dan tersinkronisasi di semua perangkatmu.
- **🌍 Bilingual Support**: Mendukung Bahasa Indonesia dan Bahasa Inggris.
- **🚀 Cloud-Native**: Dikemas menggunakan Docker dan di-deploy ke **Google Cloud Run** untuk skalabilitas maksimal.

---

## 🛠️ Teknologi yang Digunakan

- **Frontend**: React 18, Vite, Tailwind CSS v4, TypeScript
- **AI & ML**: Google Gemini API
- **Backend/BaaS**: Google Firebase (Authentication & Cloud Firestore)
- **Deployment**: Google Cloud Run, Cloud Build, Docker, NGINX

---

## 💻 Cara Menjalankan di Laptop Sendiri (Local Development)

### Prasyarat

- Node.js (versi 18 atau terbaru)
- Akun Google Cloud / Google AI Studio untuk mendapatkan API Key
- Akun Firebase untuk mengonfigurasi `firebase.ts`

### Instalasi

1. **Clone repository ini**

   ```bash
   git clone https://github.com/CountZeroID/JVC-MakanApa
   cd makanapa
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Atur Environment Variables**
   Buat file `.env` di dalam folder utama proyek dan masukkan API Key Gemini kamu:

   ```env
   GEMINI_API_KEY="ISI_DENGAN_API_KEY_GEMINI_KAMU"
   APP_URL="http://localhost:3000"
   ```

4. **Jalankan Aplikasi**
   ```bash
   npm run dev
   ```
   Aplikasi akan berjalan di `http://localhost:3000`.

---

#JuaraVibeCoding
