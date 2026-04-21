# 🔍 Venus Finder

**AI destekli kişi arama motoru** — Groq AI + DuckDuckGo ile derin internet araştırması.

![Venus Finder](https://img.shields.io/badge/Venus-Finder-blueviolet?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)
![Node.js](https://img.shields.io/badge/Node.js-18+-brightgreen?style=for-the-badge)

## ✨ Özellikler

- 🧠 **AI Düşünme** — Groq AI arama terimlerini analiz edip akıllı alt sorgular oluşturur
- 🔍 **Çoklu Arama** — DuckDuckGo üzerinden birden fazla sorgu ile derin arama
- 🤖 **AI Analiz** — Bulunan sonuçları AI ile analiz edip kapsamlı rapor
- 📱 **Odak Seçimi** — Sosyal Medya, Haberler, Akademik, İş Dünyası
- 📊 **Sonuç Kontrolü** — 5, 10, 20 veya 50 sonuç seçimi
- 🎨 **Premium UI** — Karanlık tema, glassmorphism, animasyonlar
- ⚡ **Hızlı** — Groq'un ultra-hızlı inference motoru

## 🚀 Kurulum

### 1. Repoyu klonla

```bash
git clone https://github.com/YOUR_USERNAME/venus-finder.git
cd venus-finder
```

### 2. Bağımlılıkları kur

```bash
npm install
```

### 3. API Key ayarla

```bash
cp .env.example .env
```

`.env` dosyasını düzenle ve Groq API key'ini ekle:

```env
GROQ_API_KEY=gsk_your_api_key_here
```

> 🔑 Ücretsiz API key almak için: [console.groq.com/keys](https://console.groq.com/keys)

### 4. Çalıştır

```bash
npm start
```

Tarayıcıda aç: **http://localhost:3099**

## 📸 Ekran Görüntüsü

Uygulama açıldığında premium karanlık temalı bir arama arayüzü göreceksiniz. İsim yazıp "Ara" butonuna basın, AI düşünce sürecini ve sonuçları takip edin.

## 🏗️ Mimari

```
Venus Finder
├── server.js          # Express sunucu + API endpoint'leri
├── .env               # API anahtarları (gitignore'da)
├── .env.example       # Örnek env dosyası
├── package.json       # Bağımlılıklar
└── public/
    ├── index.html     # Ana sayfa
    ├── style.css      # Premium dark theme
    └── app.js         # Frontend mantığı
```

### API Pipeline

1. **`/api/think`** — AI sorguyu analiz eder, alt arama sorguları oluşturur
2. **`/api/search`** — DuckDuckGo'da çoklu arama yapar
3. **`/api/analyze`** — AI sonuçları analiz edip rapor hazırlar

## 🔒 Güvenlik

- ✅ API key `.env` dosyasında (repo'ya dahil değil)
- ✅ Rate limiting (dakikada 20 istek)
- ✅ Input validation (max 200 karakter)
- ✅ AbortController ile timeout koruması
- ✅ `.gitignore` ile hassas dosyalar korunuyor

## 🛠️ Teknolojiler

- **Backend:** Node.js, Express
- **AI:** Groq Cloud (Llama 3.3 70B)
- **Arama:** DuckDuckGo (API + HTML fallback)
- **Frontend:** Vanilla HTML/CSS/JS
- **Font:** Inter, JetBrains Mono

## 📄 Lisans

MIT License — Dilediğiniz gibi kullanın.
