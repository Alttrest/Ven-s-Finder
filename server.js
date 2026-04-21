require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const Groq = require('groq-sdk');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3099;

// API key kontrolü
if (!process.env.GROQ_API_KEY) {
  console.error('❌ GROQ_API_KEY bulunamadı!');
  console.error('📝 .env dosyasına GROQ_API_KEY=gsk_... ekleyin');
  console.error('📋 .env.example dosyasını kopyalayın: cp .env.example .env');
  process.exit(1);
}

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting (basit)
const rateLimiter = new Map();
function checkRateLimit(ip) {
  const now = Date.now();
  const windowMs = 60000; // 1 dakika
  const maxRequests = 20;
  
  if (!rateLimiter.has(ip)) rateLimiter.set(ip, []);
  const timestamps = rateLimiter.get(ip).filter(t => now - t < windowMs);
  timestamps.push(now);
  rateLimiter.set(ip, timestamps);
  return timestamps.length <= maxRequests;
}

// Middleware
app.use((req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Çok fazla istek. Lütfen biraz bekleyin.' });
  }
  next();
});

// ============================================
// STEP 1: AI Düşünme
// ============================================
app.post('/api/think', async (req, res) => {
  try {
    const { query, focus, maxResults } = req.body;
    if (!query || query.length > 200) return res.status(400).json({ error: 'Geçersiz sorgu' });

    console.log(`\n🧠 AI Düşünüyor: "${query}" | Odak: ${focus} | Max: ${maxResults}`);

    const focusDescriptions = {
      'all': 'genel arama, her türlü bilgi',
      'social': 'sosyal medya profilleri (Twitter/X, Instagram, LinkedIn, Facebook, YouTube, TikTok)',
      'news': 'haberler, medya, basın',
      'academic': 'akademik çalışmalar, makaleler, üniversite',
      'business': 'iş dünyası, şirketler, girişimcilik'
    };

    const focusDesc = focusDescriptions[focus] || focusDescriptions['all'];

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `Sen bir araştırma asistanısın. Kullanıcı bir kişi veya konu arıyor. Senin görevin:

1. Aramanın ne hakkında olduğunu DÜŞÜN
2. Kişi hakkında bildiklerini yaz
3. En etkili DuckDuckGo arama sorgularını oluştur

ODAK ALANI: ${focusDesc}

YANIT FORMATINI KESİNLİKLE şu JSON formatında ver, başka hiçbir şey yazma:
{
  "thinking": "Bu kişi/konu hakkında düşüncelerim...",
  "person_info": "Bu kişi hakkında bildiklerim...",
  "search_queries": ["sorgu1", "sorgu2", "sorgu3", "sorgu4", "sorgu5"],
  "focus_keywords": ["anahtar1", "anahtar2"]
}

Kurallar:
- search_queries için 3-6 arası farklı arama sorgusu üret
- Her sorgu farklı bir açıdan arasın
- Odak alanına göre sorguları özelleştir
- Türkçe ve İngilizce karışık sorgular kullan
- Yanıtı SADECE JSON olarak ver`
        },
        {
          role: 'user',
          content: `Araştır: "${query}"\nOdak: ${focusDesc}\nMaksimum sonuç sayısı: ${maxResults}`
        }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.4,
      max_tokens: 1024
    });

    let aiThinking;
    const rawContent = completion.choices[0]?.message?.content || '';
    
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiThinking = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('JSON bulunamadı');
      }
    } catch {
      aiThinking = {
        thinking: `"${query}" hakkında araştırma yapılıyor`,
        person_info: 'Bilgi aranıyor...',
        search_queries: [query, `${query} kimdir`, `${query} hakkında`, `"${query}"`],
        focus_keywords: [query]
      };
    }

    console.log(`💡 ${aiThinking.search_queries.length} arama sorgusu oluşturuldu`);
    res.json(aiThinking);
  } catch (error) {
    console.error('AI düşünme hatası:', error.message);
    res.status(500).json({ error: 'AI düşünme hatası: ' + error.message });
  }
});

// ============================================
// STEP 2: DuckDuckGo arama
// ============================================
app.post('/api/search', async (req, res) => {
  try {
    const { queries, maxResults } = req.body;
    if (!queries || !queries.length) return res.status(400).json({ error: 'Sorgular gerekli' });

    console.log(`🔍 ${queries.length} sorgu aranıyor...`);

    let allResults = [];
    const seenUrls = new Set();

    for (const query of queries) {
      console.log(`  → "${query}"`);
      const results = await duckDuckGoSearch(query);
      for (const result of results) {
        const key = result.url || result.title;
        if (!seenUrls.has(key)) {
          seenUrls.add(key);
          allResults.push(result);
        }
      }
    }

    const limit = parseInt(maxResults) || 10;
    allResults = allResults.slice(0, limit);

    console.log(`📊 Toplam ${allResults.length} benzersiz sonuç`);
    res.json({ results: allResults });
  } catch (error) {
    console.error('Arama hatası:', error.message);
    res.status(500).json({ error: 'Arama hatası: ' + error.message });
  }
});

// ============================================
// STEP 3: AI Analiz
// ============================================
app.post('/api/analyze', async (req, res) => {
  try {
    const { query, results, thinking, focus } = req.body;
    console.log(`🤖 AI sonuçları analiz ediyor...`);

    const resultsSummary = results.map((r, i) =>
      `${i + 1}. [${r.title}] - ${r.snippet} (${r.url})`
    ).join('\n');

    const focusLabels = {
      'all': 'Genel', 'social': 'Sosyal Medya', 'news': 'Haberler',
      'academic': 'Akademik', 'business': 'İş Dünyası'
    };

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `Sen bir kişi araştırma uzmanısın. Sonuçları analiz edip Türkçe rapor hazırla.

ÖNCEKİ DÜŞÜNCELERİN: ${thinking || 'Yok'}
ODAK: ${focusLabels[focus] || 'Genel'}

Raporun:
## 🧠 Analiz
## 📋 Bulunan Bilgiler
## 🔗 Önemli Bağlantılar
## 💡 Ek Arama Önerileri

Markdown formatında yaz.`
        },
        {
          role: 'user',
          content: `"${query}" araştırması:\n\n${resultsSummary || 'Sonuç bulunamadı.'}\n\nToplam ${results.length} sonuç. Analiz et.`
        }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.6,
      max_tokens: 2048
    });

    const analysis = completion.choices[0]?.message?.content || 'AI analiz yapılamadı.';
    console.log(`✅ Analiz tamamlandı`);
    res.json({ analysis });
  } catch (error) {
    console.error('AI analiz hatası:', error.message);
    res.status(500).json({ error: 'AI analiz hatası: ' + error.message });
  }
});

// ============================================
// DuckDuckGo Arama
// ============================================
async function duckDuckGoSearch(query) {
  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://api.duckduckgo.com/?q=${encodedQuery}&format=json&no_html=1&skip_disambig=1`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: controller.signal
    });
    clearTimeout(timeout);

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { return await duckDuckGoHTMLSearch(query); }

    let results = [];
    if (data.Abstract) {
      results.push({
        title: data.Heading || query, snippet: data.Abstract,
        url: data.AbstractURL || '', source: data.AbstractSource || 'DuckDuckGo', type: 'abstract'
      });
    }
    if (data.RelatedTopics) {
      for (const topic of data.RelatedTopics.slice(0, 10)) {
        if (topic.Text) {
          results.push({
            title: topic.Text.split(' - ')[0] || topic.Text.substring(0, 60),
            snippet: topic.Text, url: topic.FirstURL || '', source: 'DuckDuckGo', type: 'related'
          });
        }
        if (topic.Topics) {
          for (const sub of topic.Topics.slice(0, 4)) {
            if (sub.Text) {
              results.push({
                title: sub.Text.split(' - ')[0], snippet: sub.Text,
                url: sub.FirstURL || '', source: 'DuckDuckGo', type: 'related'
              });
            }
          }
        }
      }
    }
    if (results.length === 0) results = await duckDuckGoHTMLSearch(query);
    return results;
  } catch (error) {
    return await duckDuckGoHTMLSearch(query);
  }
}

async function duckDuckGoHTMLSearch(query) {
  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://html.duckduckgo.com/html/?q=${encodedQuery}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html', 'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);
    const html = await response.text();

    const results = [];
    const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

    let match;
    const titles = [], urls = [];
    while ((match = resultRegex.exec(html)) !== null) {
      urls.push(match[1]);
      titles.push(match[2].replace(/<[^>]*>/g, '').trim());
    }
    const snippets = [];
    while ((match = snippetRegex.exec(html)) !== null) {
      snippets.push(match[1].replace(/<[^>]*>/g, '').trim());
    }

    for (let i = 0; i < Math.min(titles.length, 15); i++) {
      let finalUrl = urls[i] || '';
      if (finalUrl.includes('uddg=')) {
        try {
          const urlParam = new URL('https://duckduckgo.com' + finalUrl);
          finalUrl = decodeURIComponent(urlParam.searchParams.get('uddg') || finalUrl);
        } catch {}
      }
      results.push({
        title: titles[i] || 'Başlık yok', snippet: snippets[i] || '',
        url: finalUrl, source: 'DuckDuckGo', type: 'web'
      });
    }
    return results;
  } catch {
    return [];
  }
}

app.listen(PORT, () => {
  console.log(`\n🚀 Venus Finder çalışıyor: http://localhost:${PORT}`);
  console.log(`🧠 Groq AI Düşünme + DuckDuckGo Arama aktif\n`);
});
