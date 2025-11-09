const LAMBDA_STATS_URL = 'https://2flb553cqg4egpc33lyuasxbte0xvcdf.lambda-url.ap-southeast-2.on.aws/';
document.addEventListener('DOMContentLoaded', function() {
  const playerForm = document.querySelector('.player-form');
  if (!playerForm) return;

  playerForm.addEventListener('submit', async function(e) {
    e.preventDefault();

    const riotId = playerForm.riot_id.value.trim();
    const tag = playerForm.tag.value.trim();
    const btn = playerForm.querySelector('.player-submit-btn');
    const msg = document.getElementById('lookup-message');
    const resultDiv = document.getElementById('result');
    const progressContainer = document.querySelector('.progress-bar-container');
    const progressBar = progressContainer.querySelector('.progress-bar');

    msg.style.display = 'none';
    resultDiv.innerHTML = '';
    btn.textContent = 'searching...';
    btn.disabled = true;

    // === Fake progress bar animation ===
    progressContainer.style.display = 'block';
    progressBar.style.transition = 'none';
    const START_BASE = 5;
    progressBar.style.width = START_BASE + '%';
    void progressBar.offsetWidth;
    progressBar.style.transition = 'width 0.4s ease';

    const TARGET = 95;
    const DURATION_MS = 60000;
    const t0 = performance.now();
    let progressTimer = null;

    setTimeout(() => {
      progressTimer = setInterval(() => {
        const elapsed = performance.now() - t0;
        const x = Math.min(1, elapsed / DURATION_MS);
        const eased = 1 - Math.pow(1 - x, 3);
        const fake = START_BASE + (TARGET - START_BASE) * eased;
        progressBar.style.width = fake.toFixed(1) + '%';
        if (x >= 1) clearInterval(progressTimer);
      }, 100);
    }, 50);

    // === Main fetch ===
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 65000);

      const response = await fetch(LAMBDA_STATS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          riot_id: riotId,
          tag: tag,
          platform: document.getElementById('platform').value
        }),
        signal: controller.signal
      }).finally(() => clearTimeout(timeout));

      const data = await response.json();

      if (!response.ok || data.error) {
        showLookupMessage(`❌ ${data.error || 'fail'}`, 'error');
      } else {
        if (data.note) {
          showLookupMessage(`ℹ ${data.note}`, 'info');
          clearInterval(progressTimer);
          progressBar.style.width = '100%';
          setTimeout(() => {
            progressContainer.style.display = 'none';
            progressBar.style.width = '0%';
          }, 600);
          btn.textContent = 'search';
          btn.disabled = false;
          return;
        }
        showLookupMessage('✅ success', 'success');
        const simPercent = (data.matches?.Similarity ?? 0) * 100;
        const playerName = data.matches?.Player || 'Unknown';

        // === Inject main result layout ===
        const statsHTML = `
          <div class="player-stats">
            <h2>Player Insights</h2>

            <!-- first row: Champion Stats + Best Match -->
            <section class="grid gap-8 py-6 items-stretch max-w-[1400px] mx-auto md:grid-cols-2">
              <div class="flex flex-col justify-between rounded-lg border border-border bg-card p-6 h-full">
                <h3 class="text-text-primary text-lg font-bold mb-6 text-center">Champion Stats</h3>
                <div>
                  <h4 class="text-text-secondary text-sm font-medium mb-3 text-center">Top 3 Most Played</h4>
                  <div id="championList" class="grid grid-cols-3 gap-6 justify-items-center"></div>
                </div>
                <div class="mt-10">
                  <h4 class="text-text-secondary text-sm font-medium mb-3 text-center">Top 3 Recommended by AI</h4>
                  <div id="recommendationList" class="grid grid-cols-3 gap-6 justify-items-center"></div>
                </div>
              </div>
              <div class="rounded-lg border border-border bg-card p-6 h-full">
                <h3 class="text-text-primary text-lg font-bold mb-4 text-center">Your Best Match</h3>
                <div id="miniMatchCard"></div>
              </div>
            </section>

            <!-- second row: Data (left) + Style (right) -->
            <section class="grid gap-8 py-2 items-stretch max-w-[1400px] mx-auto md:grid-cols-2">
              <div class="rounded-lg border border-border bg-card p-6 h-full" id="dataCard">
                <h3 class="text-text-primary text-lg font-bold mb-4">📊 Player Stats (per game & ratios)</h3>
                <div id="dataGrid" class="grid grid-cols-2 gap-3"></div>
              </div>
              <div class="rounded-lg border border-border bg-card p-6 h-full" id="styleCard">
                <h3 class="text-text-primary text-lg font-bold mb-4">🎯 Playstyle Analysis</h3>
                <!-- 四個主風格百分比條 -->
                <div id="styleBars" class="space-y-3 mb-4"></div>
                <!-- Tags -->
                <div>
                  <h4 class="text-text-secondary text-xs font-medium mb-2">Secondary Traits</h4>
                  <div id="styleTags" class="flex flex-wrap gap-2"></div>
                </div>
                <!-- 理由（保留可展開） -->
                <div class="mt-4">
                  <details id="styleReasonsWrap" class="rounded-md border border-border">
                    <summary class="px-3 py-2 cursor-pointer select-none">Why these tags?</summary>
                    <ul id="styleReasons" class="px-4 py-3 list-disc marker:text-text-secondary/80 space-y-1"></ul>
                  </details>
                </div>
              </div>
            </section>

            <!-- third row: Heatmap + Timeline -->
            <section class="grid gap-8 py-2 items-stretch max-w-[1400px] mx-auto">
              <div class="rounded-lg border border-border bg-card p-6">
                <h3 class="text-text-primary text-lg font-bold mb-4">🔥 Kill Heatmap</h3>
                <div id="heatmapLegend" class="heatmap-legend"></div>
                <canvas id="heatmapCanvas"></canvas>
              </div>
              <div class="rounded-lg border border-border bg-card p-6">
                <h3 class="text-text-primary text-lg font-bold mb-4">📈 Timeline Performance</h3>
                <div class="aspect-[16/9] w-full">
                  <canvas id="timelineChart" class="w-full h-full"></canvas>
                </div>
              </div>
            </section>
          </div>
        `;
        resultDiv.insertAdjacentHTML('beforeend', statsHTML);

        // === Render actual data ===
        renderMiniMatchCard({
          name: playerName,
          percent: simPercent,
          analysis: '', // 移除上方文字說明
          img: `images/players/${playerName}.jpg`
        });

        if (data.heatmap_points) renderHeatmap(data.heatmap_points);
        if (data.timeline) renderTimeline(data.timeline);
        if (data.common_champions) renderChampions(data.common_champions);
        if (data.champion_recommendation) renderRecommendations(data.champion_recommendation);

        renderDataCard(data);          // 第二列左側：數據
        renderStyleAnalysisCard(data); // 第二列右側：風格

      }
    } catch (err) {
      showLookupMessage(`⚠️ Network or CORS error: ${err}`, 'error');
    } finally {
      clearInterval(progressTimer);
      progressBar.style.width = '100%';
      setTimeout(() => {
        progressContainer.style.display = 'none';
        progressBar.style.width = '0%';
      }, 600);
      btn.textContent = 'search';
      btn.disabled = false;
    }
  });
});

// === UI Message ===
function showLookupMessage(text, type) {
  const msg = document.getElementById('lookup-message');
  msg.textContent = text;
  msg.className = `form-message ${type}`;
  msg.style.display = 'block';
}

// === Escape HTML ===
function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// ======================================================
// 派生四大主風格（Aggressive / Safe / Team-oriented / Scaling）
// ======================================================
function deriveStyles(data) {
  const pf = data.player_features || {};
  const sp = data.style_profile || {};
  const vision = data.vision || {};
  const tags = Array.isArray(data.style_tags) ? data.style_tags : [];

  const KP   = Number(pf["KP"] ?? 0);
  const DMG  = Number(pf["DMG%"] ?? 0);
  const DPM  = Number(pf["DPM_user"] ?? 0);
  const deaths_pg  = Number(sp.deaths_pg ?? pf.DPG ?? 0);
  const late_frac  = Number(sp.late_k_frac ?? 0);
  const wardsPlaced = Number(vision.placed ?? 0);
  const wardsKilled = Number(vision.killed ?? 0);

  const clamp01 = v => Math.max(0, Math.min(1, v));
  const lin = (x, a, b) => clamp01((x - a) / (b - a));

  // Aggressive：高 KP / 高 DPM / 較多 deaths
  const sAgg = 0.45 * lin(KP, 55, 80) + 0.35 * lin(DPM, 450, 900) + 0.20 * lin(deaths_pg, 3.0, 6.0);

  // Safe：低死亡、偏低 DMG/DPM
  const sSafe = 0.60 * (1 - lin(deaths_pg, 2.5, 5.0)) + 0.20 * (1 - lin(DMG, 20, 35)) + 0.20 * (1 - lin(DPM, 450, 900));

  // Team-oriented：高 KP + 有視野參與
  const sTeam = 0.70 * lin(KP, 55, 85) + 0.15 * lin(wardsPlaced, 8, 14) + 0.15 * lin(wardsKilled, 0.8, 1.8);

  // Scaling：後期比例高 + 輸出高
  const sScaling = 0.60 * lin(late_frac, 0.30, 0.55) + 0.40 * Math.max(lin(DPM, 450, 900), lin(DMG, 22, 35));

  let vec = [sAgg, sSafe, sTeam, sScaling];
  const sum = vec.reduce((a, b) => a + b, 0) || 1;
  vec = vec.map(v => (v / sum) * 100);

  const core = [
    { key: 'Aggressive',     value: Math.round(vec[0]) },
    { key: 'Safe',           value: Math.round(vec[1]) },
    { key: 'Team-oriented',  value: Math.round(vec[2]) },
    { key: 'Scaling',        value: Math.round(vec[3]) },
  ];

  const primarySet = new Set(['aggressive', 'safe', 'team-oriented', 'scaling']);
  const subs = tags.filter(t => !primarySet.has(t));

  return { core, subs };
}

// === Mini Match Card（移除說明段落） ===
function renderMiniMatchCard({ name, percent, analysis, img }) {
  const box = document.getElementById('miniMatchCard');
  if (!box) return;

  box.innerHTML = `
    <div class="match-card">
      <h1 class="match-title">You Matched With...</h1>

      <div class="card-container">
        <div class="profile-image">
          <img src="${img}" alt="${name}" onerror="this.src='images/players/default.jpg'">
        </div>

        <div class="progress-circle">
          <div class="progress-number">${percent.toFixed(1)}%</div>
        </div>

        <h2 class="profile-name">${name}</h2>

        <div class="button-group">
          <button class="btn btn-primary" id="saveMatchCard">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Save Your Result
          </button>
        </div>
      </div>
    </div>
  `;

  const saveBtn = document.getElementById('saveMatchCard');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const card = document.querySelector('.match-card');
      if (!card) return;

      try {
        const dataUrl = await htmlToImage.toPng(card, { quality: 1.0 });
        const link = document.createElement('a');
        link.download = 'match-card.jpg';
        link.href = dataUrl;
        link.click();
      } catch (err) {
        console.error('Image save failed:', err);
        alert('⚠️ Unable to save image.');
      }
    });
  } 
}

// === Heatmap ===
function renderHeatmap(points) {
  const canvas = document.getElementById('heatmapCanvas');
  if (!canvas) return;

  const MAP_W = 14870, MAP_H = 14980;
  const BORDER_FRAC = 15 / 280;
  const ACTIVE_FRAC = 1 - 2 * BORDER_FRAC;
  const cssSide = canvas.clientWidth || 600;
  const dpr = window.devicePixelRatio || 1;

  canvas.style.width = cssSide + 'px';
  canvas.style.height = cssSide + 'px';
  canvas.width = Math.round(cssSide * dpr);
  canvas.height = Math.round(cssSide * dpr);

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const offset = cssSide * BORDER_FRAC;
  const activeSide = cssSide * ACTIVE_FRAC;
  const sx = activeSide / MAP_W;
  const sy = activeSide / MAP_H;
  const r = Math.max(2, Math.min(6, Math.round(cssSide * 0.006)));

  const COLORS = {
    kill: 'rgba(0, 224, 255, 0.9)',   
    death: 'rgba(255,0,170,0.9)'
  };

  points.forEach(p => {
    const x = offset + p.x * sx;
    const y = offset + (MAP_H - p.y) * sy;
    ctx.fillStyle = COLORS[p.type];
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  });

  const legend = document.getElementById('heatmapLegend');
  if (legend) {
    legend.innerHTML = `
      <div class="heatmap-legend-item">
        <div class="heatmap-legend-dot" style="background: rgba(0,224,255,0.9)"></div>
        Kill Participation
      </div>
      <div class="heatmap-legend-item">
        <div class="heatmap-legend-dot" style="background: rgba(255,0,170,0.9)"></div>
        Death
      </div>
    `;
  }
}

// === Timeline ===
function renderTimeline(data) {
  const canvas = document.getElementById('timelineChart');
  if (!canvas) return;

  new Chart(canvas, {
    type: 'line',
    data: {
      labels: data.map(d => d.minute),
      datasets: [
        {
          label: 'Kill Participations',
          data: data.map(d => d.kills),
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139,92,246,0.2)',
          tension: 0.4,
          fill: false
        },
        {
          label: 'Deaths',
          data: data.map(d => d.deaths),
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239,68,68,0.2)',
          tension: 0.4,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' },
        title: { display: false }
      },
      scales: {
        x: { title: { display: true, text: 'Minute' } },
        y: { beginAtZero: true, title: { display: true, text: 'Events per Minute' } }
      }
    }
  });
}

// === Champions ===
function renderChampions(champs) {
  const list = document.getElementById('championList');
  if (!list) return;
  list.innerHTML = champs.map(c => `
    <div class="champion">
      <img src="images/champions/${c.name}.jpg" alt="${c.name}" onerror="this.src='images/champions/default.jpg'">
      <p>${c.name}</p>
      <p>${(c.playRate * 100).toFixed(1)}%</p>
    </div>
  `).join('');
}

// === AI Recommendations ===
function renderRecommendations(recData) {
  const champs = recData.similar || [];
  const list = document.getElementById('recommendationList');
  if (!list) return;

  list.innerHTML = champs.map(c => `
    <div class="champion">
      <img src="images/champions/${c.name}.jpg" alt="${c.name}" onerror="this.src='images/champions/default.jpg'">
      <p class="champ-name">${c.name}</p>
      <p class="champ-score">${(c.score * 100).toFixed(1)}%</p>
      <p class="reason-text">${escapeHtml(c.reason || 'No reason provided.')}</p>
    </div>
  `).join('');
}

// === 第二列左側：數據卡 ===
function renderDataCard(data) {
  const grid = document.getElementById('dataGrid');
  if (!grid) return;
  const pf = data.player_features || {};
  const sp = data.style_profile || {};
  const pos = (pf.Position || 'unknown').toUpperCase();
  grid.innerHTML = '';

  const cells = [
    ['Kills / game', fmtNum(sp.kills_pg)],
    ['Assists / game', fmtNum(sp.assists_pg)],
    ['Deaths / game', fmtNum(sp.deaths_pg)],
    ['KP', pf['KP'] != null ? pf['KP'].toFixed(1) + '%' : '—'],
    ['DMG%', pf['DMG%'] != null ? pf['DMG%'].toFixed(1) + '%' : '—'],
    ['DTH%', pf['DTH%'] != null ? pf['DTH%'].toFixed(1) + '%' : '—'],
    ['CSPM', fmtNum(pf['CSPM'])],
    ['DPM', pf['DPM_user'] != null ? pf['DPM_user'].toFixed(0) : '—'],
    ['GOLD%', pf['GOLD%'] != null ? pf['GOLD%'].toFixed(1) + '%' : '—'],
    ['Wards placed / game', fmtNum(data.vision?.placed)],
    ['Wards cleared / game', fmtNum(data.vision?.killed)],
    ['Position', pos],
  ];
  cells.forEach(([k, v]) => {
    const div = document.createElement('div');
    div.className = 'rounded-md border border-border p-3';
    div.innerHTML = `
      <div class="text-xs text-text-secondary">${k}</div>
      <div class="text-base font-bold">${v}</div>
    `;
    grid.appendChild(div);
  });
}

// === 第二列右側：風格卡（四大主風格 + 副詞條 + 理由） ===
function renderStyleAnalysisCard(data) {
  const tagsEl = document.getElementById('styleTags');
  const reasonsWrap = document.getElementById('styleReasonsWrap');
  const reasonsEl = document.getElementById('styleReasons');
  const barsEl = document.getElementById('styleBars');
  const card = document.getElementById('styleCard');
  if (!card) return;

  // 1) 四大主風格條
  const { core, subs } = deriveStyles(data);
  barsEl.innerHTML = '';
  core.forEach(cs => {
    const row = document.createElement('div');
    row.innerHTML = `
      <div class="flex items-center justify-between text-xs mb-1">
        <span class="text-text-secondary">${cs.key}</span>
        <span class="font-semibold">${Math.round(cs.value)}%</span>
      </div>
      <div class="w-full h-2 rounded-full bg-border overflow-hidden">
        <div class="h-2 bg-primary" style="width:${Math.round(cs.value)}%"></div>
      </div>
    `;
    barsEl.appendChild(row);
  });

  // 2) 副詞條（過濾掉四個主風格）
  tagsEl.innerHTML = '';
  subs.forEach(t => tagsEl.appendChild(makeTagBadge(t)));

  // 3) 理由（只列出副詞條對應的理由，避免和主風格重疊）
  const reasons = data.style_tag_reasons || {};
  const keys = subs.filter(k => reasons[k]);
  reasonsEl.innerHTML = '';
  if (keys.length === 0) {
    reasonsWrap.open = false;
    reasonsWrap.style.display = 'none';
  } else {
    reasonsWrap.style.display = 'block';
    keys.forEach(k => {
      const li = document.createElement('li');
      li.textContent = `[${k}] ${reasons[k]}`;
      reasonsEl.appendChild(li);
    });
  }
}

// === Tag 樣式 ===
function makeTagBadge(name) {
  const span = document.createElement('span');
  span.textContent = name.replace(/-/g,' ');
  span.className = 'text-xs px-2.5 py-1 rounded-full border';
  const colorMap = {
    'teamfight-carry':'#8ab4ff',
    'early-pressure':'#ffad60',
    'scaling':'#c58aff',
    'roamer':'#8bd7a8',
    'power-farmer':'#ffd166',
    'split-pusher':'#ff7b7b',
    'vision-control':'#7bd7ff',
    'low-risk':'#a5d6a7',
    'high-risk':'#ef9a9a',
    'aggressive':'#f28b82',
    'safe':'#81c995',
    'team-oriented':'#fdd663',
    'balanced':'#cfcfcf'
  };
  span.style.borderColor = colorMap[name] || '#666';
  return span;
}

function fmtNum(x) {
  if (x == null || Number.isNaN(x)) return '—';
  const n = Number(x);
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
function pct(x) {
  if (x == null || Number.isNaN(Number(x))) return '—';
  return (Number(x) * 100).toFixed(1) + '%';
}
