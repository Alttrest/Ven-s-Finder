// ============================================
// ARDA FINDER v2 — Frontend Logic
// ============================================

let selectedFocus = 'all';
let selectedCount = 10;

document.addEventListener('DOMContentLoaded', () => {
  createParticles();
  setupKeyboardShortcuts();
  document.getElementById('searchInput').focus();
});

// ============================================
// Particles
// ============================================
function createParticles() {
  const container = document.getElementById('particles');
  const colors = ['#a78bfa', '#06b6d4', '#818cf8', '#f472b6', '#34d399'];
  for (let i = 0; i < 30; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = Math.random() * 100 + '%';
    p.style.animationDelay = Math.random() * 8 + 's';
    p.style.animationDuration = (6 + Math.random() * 6) + 's';
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    p.style.width = (2 + Math.random() * 3) + 'px';
    p.style.height = p.style.width;
    container.appendChild(p);
  }
}

// ============================================
// Controls
// ============================================
function setFocus(focus, el) {
  selectedFocus = focus;
  document.querySelectorAll('.focus-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
}

function setCount(count, el) {
  selectedCount = count;
  document.querySelectorAll('.count-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
}

function setupKeyboardShortcuts() {
  document.getElementById('searchInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      performSearch();
    }
  });
}

function fillSearch(text) {
  document.getElementById('searchInput').value = text;
  performSearch();
}

// ============================================
// Main Search Pipeline
// ============================================
async function performSearch() {
  const input = document.getElementById('searchInput');
  const query = input.value.trim();
  
  if (!query) {
    input.focus();
    shakeElement(input.closest('.search-box'));
    return;
  }
  
  const searchBtn = document.getElementById('searchBtn');
  const loadingSection = document.getElementById('loadingSection');
  const resultsSection = document.getElementById('resultsSection');
  const errorSection = document.getElementById('errorSection');
  const thinkingCard = document.getElementById('thinkingCard');
  
  // Reset
  searchBtn.disabled = true;
  resultsSection.style.display = 'none';
  errorSection.style.display = 'none';
  loadingSection.style.display = 'block';
  thinkingCard.style.display = 'none';
  resetSteps();
  
  try {
    // ========== STEP 1: AI Düşünme ==========
    activateStep('step1');
    
    const thinkRes = await fetch('/api/think', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, focus: selectedFocus, maxResults: selectedCount })
    });
    
    if (!thinkRes.ok) {
      const err = await thinkRes.json();
      throw new Error(err.error || 'AI düşünme hatası');
    }
    
    const aiThinking = await thinkRes.json();
    completeStep('step1');
    
    // Düşünce sürecini göster
    showThinking(aiThinking);
    
    // ========== STEP 2: DuckDuckGo Arama ==========
    activateStep('step2');
    document.getElementById('step2Text').textContent = 
      `${aiThinking.search_queries.length} farklı sorgu ile aranıyor...`;
    
    const searchRes = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queries: aiThinking.search_queries, maxResults: selectedCount })
    });
    
    if (!searchRes.ok) {
      const err = await searchRes.json();
      throw new Error(err.error || 'Arama hatası');
    }
    
    const searchData = await searchRes.json();
    completeStep('step2');
    
    // ========== STEP 3: AI Analiz ==========
    activateStep('step3');
    
    const analyzeRes = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        results: searchData.results,
        thinking: aiThinking.thinking,
        focus: selectedFocus
      })
    });
    
    if (!analyzeRes.ok) {
      const err = await analyzeRes.json();
      throw new Error(err.error || 'Analiz hatası');
    }
    
    const analyzeData = await analyzeRes.json();
    completeStep('step3');
    
    // ========== STEP 4: Rapor ==========
    activateStep('step4');
    await sleep(400);
    completeStep('step4');
    
    await sleep(300);
    
    // Sonuçları göster
    loadingSection.style.display = 'none';
    resultsSection.style.display = 'block';
    
    renderAIAnalysis(analyzeData.analysis);
    renderWebResults(searchData.results);
    
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    
  } catch (error) {
    loadingSection.style.display = 'none';
    errorSection.style.display = 'block';
    document.getElementById('errorMessage').textContent = error.message;
  } finally {
    searchBtn.disabled = false;
  }
}

// ============================================
// Loading Steps
// ============================================
function resetSteps() {
  ['step1', 'step2', 'step3', 'step4'].forEach(id => {
    document.getElementById(id).className = 'step';
  });
}

function activateStep(id) {
  document.getElementById(id).classList.add('active');
}

function completeStep(id) {
  const el = document.getElementById(id);
  el.classList.remove('active');
  el.classList.add('done');
}

// ============================================
// AI Thinking Display
// ============================================
function showThinking(data) {
  const card = document.getElementById('thinkingCard');
  const content = document.getElementById('thinkingContent');
  const queries = document.getElementById('thinkingQueries');
  
  card.style.display = 'block';
  card.style.animation = 'fadeInUp 0.5s var(--ease-out)';
  
  // Düşünce
  content.innerHTML = '';
  if (data.thinking) {
    const p = document.createElement('p');
    p.className = 'thinking-text';
    p.textContent = data.thinking;
    content.appendChild(p);
  }
  
  if (data.person_info && data.person_info !== 'Bilgi aranıyor...') {
    const info = document.createElement('p');
    info.className = 'thinking-info';
    info.innerHTML = `<strong>Bilgi:</strong> ${escapeHTML(data.person_info)}`;
    content.appendChild(info);
  }
  
  // Sorgular
  queries.innerHTML = '<div class="queries-title">Oluşturulan Arama Sorguları:</div>';
  if (data.search_queries) {
    data.search_queries.forEach((q, i) => {
      const chip = document.createElement('div');
      chip.className = 'query-chip';
      chip.style.animationDelay = `${i * 0.1}s`;
      chip.innerHTML = `<span class="query-num">${i + 1}</span><span class="query-text">${escapeHTML(q)}</span>`;
      queries.appendChild(chip);
    });
  }
}

// ============================================
// Render AI Analysis
// ============================================
function renderAIAnalysis(markdown) {
  const container = document.getElementById('aiContent');
  const html = parseMarkdown(markdown);
  
  container.innerHTML = html;
  
  // Animate children
  const children = Array.from(container.children);
  children.forEach((child, i) => {
    child.style.opacity = '0';
    child.style.transform = 'translateY(8px)';
    child.style.transition = 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
    setTimeout(() => {
      child.style.opacity = '1';
      child.style.transform = 'translateY(0)';
    }, 60 * (i + 1));
  });
}

// Simple markdown parser
function parseMarkdown(text) {
  if (!text) return '<p>Analiz yapılamadı.</p>';
  
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/^---$/gm, '<hr>')
    .replace(/^[\-\*] (.+)$/gm, '<li>$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
  
  if (!html.startsWith('<h') && !html.startsWith('<ul') && !html.startsWith('<hr')) {
    html = '<p>' + html + '</p>';
  }
  
  return html;
}

// ============================================
// Render Web Results
// ============================================
function renderWebResults(results) {
  const container = document.getElementById('webResults');
  const countEl = document.getElementById('resultCount');
  
  container.innerHTML = '';
  
  if (!results || results.length === 0) {
    container.innerHTML = `
      <div class="no-results">
        <div class="no-results-icon">🔍</div>
        <p>Web sonucu bulunamadı. Farklı anahtar kelimeler deneyin.</p>
      </div>
    `;
    countEl.textContent = '0 sonuç';
    return;
  }
  
  countEl.textContent = `${results.length} sonuç`;
  
  results.forEach((result, index) => {
    const card = document.createElement('div');
    card.className = 'result-card';
    card.style.animationDelay = `${index * 0.06}s`;
    
    const typeLabel = {
      'abstract': 'Özet',
      'related': 'İlgili',
      'web': 'Web'
    }[result.type] || 'Web';
    
    card.innerHTML = `
      <div class="result-card-header">
        <span class="result-title">${escapeHTML(result.title)}</span>
        <span class="result-type-badge ${result.type}">${typeLabel}</span>
      </div>
      <p class="result-snippet">${escapeHTML(result.snippet)}</p>
      ${result.url ? `<div class="result-url">${escapeHTML(truncateURL(result.url))}</div>` : ''}
    `;
    
    if (result.url) {
      card.addEventListener('click', () => {
        window.open(result.url, '_blank', 'noopener');
      });
    }
    
    container.appendChild(card);
  });
}

// ============================================
// Utilities
// ============================================
function escapeHTML(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function truncateURL(url) {
  try {
    const parsed = new URL(url);
    let display = parsed.hostname + parsed.pathname;
    return display.length > 60 ? display.substring(0, 57) + '...' : display;
  } catch {
    return url.length > 60 ? url.substring(0, 57) + '...' : url;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function shakeElement(el) {
  el.style.animation = 'none';
  el.offsetHeight;
  el.style.animation = 'shake 0.5s ease';
  setTimeout(() => { el.style.animation = ''; }, 500);
}

// Shake keyframes
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-8px); }
    40% { transform: translateX(8px); }
    60% { transform: translateX(-4px); }
    80% { transform: translateX(4px); }
  }
`;
document.head.appendChild(shakeStyle);
