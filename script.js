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
      const timeout = setTimeout(() => controller.abort(), 300000);

      const friendId = playerForm.friend_id?.value?.trim() || '';
      const friendTag = playerForm.friend_tag?.value?.trim() || '';
      const friendPlatform = document.getElementById('friend_platform')?.value || '';


      const response = await fetch(LAMBDA_STATS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          riot_id: riotId,
          tag: tag,
          platform: document.getElementById('platform').value,
          ...(friendId && friendTag ? {
            friend_id: friendId,
            friend_tag: friendTag,
            friend_platform: friendPlatform || document.getElementById('platform').value
          } : {})
        }),
        signal: controller.signal
      }).finally(() => clearTimeout(timeout));

      const data = await response.json();

      if (!response.ok || data.error) {
        showLookupMessage(`❌ ${data.error || 'fail'}`, 'error');
      } else {
        if (data.note) {
          showLookupMessage(`ℹ️ ${data.note}`, 'info');
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

        // === Inject main result layout （三列）
        const statsHTML = `
          <div class="player-stats">
            <h2>Player Insights</h2>

            <!-- Row 1: Champion Stats + Best Match -->
            <section id="row1" style="margin-bottom:clamp(1.2rem,2vw,2rem)">
              <div class="rounded-lg border border-border bg-card p-6 h-full">
                <h3 class="text-text-primary text-lg font-bold mb-6 text-center">Champion Stats</h3>
                <div>
                  <h4 class="text-text-secondary text-sm font-medium mb-3 text-center">Top 3 Most Played</h4>
                  <div id="championList"></div>
                </div>
                <div class="mt-10">
                  <h4 class="text-text-secondary text-sm font-medium mb-3 text-center">Top 3 Recommended by AI</h4>
                  <div id="recommendationList"></div>
                </div>
              </div>
              <div class="rounded-lg border border-border bg-card p-6 h-full">
                <h3 class="text-text-primary text-lg font-bold mb-4 text-center">Your Best Match</h3>
                <div id="miniMatchCard"></div>
              </div>
            </section>

            <!-- Row 2: Player Stats (left, wide) + Style Analysis (right, narrow) -->
            <section id="row2" style="margin-bottom:clamp(1.2rem,2vw,2rem)">
              <div class="rounded-lg border border-border bg-card p-6 h-full">
                <h3 class="text-text-primary text-lg font-bold mb-4">📊 Player Stats</h3>
                <div id="detailStatsGrid" class="grid grid-cols-2 gap-3"></div>
              </div>

              <div class="rounded-lg border border-border bg-card p-6 h-full" id="styleCard">
                <h3 class="text-text-primary text-lg font-bold mb-4 text-center">🔎 Style Analysis</h3>

                <!-- 四個主風格百分比條：Aggressive / Safe / Team-oriented / Scaling -->
                <div id="styleBars" class="space-y-3 mb-4"></div>

                <!-- Tags -->
                <div>
                  <h4 class="text-text-secondary text-xs font-medium mb-2">Tags</h4>
                  <div id="styleTags" class="flex flex-wrap gap-2"></div>
                </div>
              </div>
            </section>
            <!-- Row 2.5: Duo Radar (optional) -->
            <section id="row2b" style="margin-bottom:clamp(1.2rem,2vw,2rem)">
              <div class="rounded-lg border border-border bg-card p-6 h-full">
                <h3 class="text-text-primary text-lg font-bold mb-4">🎯 Duo Radar</h3>
                <p id="duoNote" class="text-xs text-text-secondary mb-3"></p>
                <div class="w-full max-w-[640px] mx-auto aspect-square">
                  <canvas id="duoRadar"></canvas>
                </div>
              </div>
            </section>
            <!-- Row 3: Heatmap + Timeline -->
            <section id="row3">
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

        // 等待 DOM commit 完成，避免 null.innerHTML
        await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);

        applyResponsiveGrids();

        // === Render actual data ===
        renderMiniMatchCard({
          name: playerName,
          percent: simPercent,
          analysis: data.style_analysis || '',
          img: `images/players/${playerName}.jpg`
        });

        if (data.heatmap_points) renderHeatmap(data.heatmap_points);
        if (data.timeline) renderTimeline(data.timeline);
        if (data.common_champions) renderChampions(data.common_champions);
        if (data.champion_recommendation) renderRecommendations(data.champion_recommendation);

        renderStyleAnalysisAndStats(data);
        // Duo Radar（有資料才畫，沒有就隱藏）
        if (data.duo_comparison && !data.duo_comparison.error) {
          renderDuoRadar(data.duo_comparison);
        } else {
          const row2b = document.getElementById('row2b');
          if (row2b) {
            if (data.duo_comparison?.error) {
              const note = document.getElementById('duoNote');
              if (note) note.textContent = `⚠️ ${data.duo_comparison.error}`;
            } else {
              row2b.style.display = 'none';
            }
          }
        }

      }
    } catch (err) {
      const msgText = (err && err.name === 'AbortError')
        ? 'Request timeout (aborted).'
        : (err?.message || String(err));
      showLookupMessage(`⚠️ Error: ${msgText}`, 'error');
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

// === Mini Match Card ===
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

        <p class="profile-description">
          ${escapeHtml(analysis || 'No analysis available.')}
        </p>

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

function renderDuoRadar(duo) {
  const canvas = document.getElementById('duoRadar');
  const note = document.getElementById('duoNote');
  if (!canvas) return;

  const userName = duo.user_name || 'You';
  const friendName = duo.friend_name || 'Friend';
  const userRadar = duo.user_radar || {};
  const friendRadar = duo.friend_radar || {};

  const keys = Array.from(new Set([...Object.keys(userRadar), ...Object.keys(friendRadar)]));

  if (note) note.textContent = `Comparing ${userName} and ${friendName}`;

  const uVals = keys.map(k => Number(userRadar[k] ?? 0));
  const fVals = keys.map(k => Number(friendRadar[k] ?? 0));

  // 若已存在圖，先銷毀
  if (canvas._chart) {
    canvas._chart.destroy();
    canvas._chart = null;
  }

  // ---- 顏色設定（深色主題）----
  const GRID = 'rgba(255,255,255,0.12)';      // 內部格線
  const AXES = 'rgba(255,255,255,0.18)';      // 放射軸線
  const LABEL = 'rgba(255,255,255,0.75)';     // 文字
  const TICK  = 'rgba(255,255,255,0.55)';     // 刻度
  const OUTER = 'rgba(255,255,255,0.45)';     // 最外框

  // ---- 自訂插件：把外框再描粗一圈 ----
  const outerFrame = {
    id: 'outerFrame',
    afterDraw(chart, args, pluginOpts) {
      const r = chart.scales?.r;
      if (!r) return;
      const ctx = chart.ctx;
      const color = pluginOpts?.color || OUTER;
      const lw = pluginOpts?.lineWidth || 2;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.beginPath();
      const count = r._pointLabels.length;
      for (let i = 0; i < count; i++) {
        const pt = r.getPointPositionForValue(i, r.max);
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
  };

  const chart = new Chart(canvas, {
    type: 'radar',
    data: {
      labels: keys,
      datasets: [
        {
          label: userName,
          data: uVals,
          borderWidth: 2.5,
          pointRadius: 2.5,
          borderColor: '#8b5cf6',                 // 紫
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#ffffff',
          backgroundColor: 'rgba(139,92,246,0.18)'
        },
        {
          label: friendName,
          data: fVals,
          borderWidth: 2.5,
          pointRadius: 2.5,
          borderColor: '#86efac',                 // 綠
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#ffffff',
          backgroundColor: 'rgba(134,239,172,0.18)'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: 10 },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: LABEL,
            usePointStyle: true,
            generateLabels(chart) {
              const base = Chart.defaults.plugins.legend.labels.generateLabels(chart);
              return base.map(item => {
                const ds = chart.data.datasets[item.datasetIndex];
                item.fillStyle = ds.borderColor;
                item.strokeStyle = ds.borderColor;
                item.lineWidth = 2;
                item.pointStyle = 'circle';
                return item;
              });
            }
          }
        },
        tooltip: { enabled: true },
        outerFrame: { color: OUTER, lineWidth: 2 }   // 插件參數
      },
      scales: {
        r: {
          suggestedMin: 0,
          suggestedMax: 10,
          angleLines: { color: AXES, lineWidth: 1 },
          grid: { color: GRID, lineWidth: 1 },       // 內部多邊格線
          ticks: {
            color: TICK,
            backdropColor: 'transparent',
            showLabelBackdrop: false,
            stepSize: 2
          },
          pointLabels: { color: LABEL, font: { size: 12 } }
        }
      },
      elements: { line: { tension: 0 } }
    },
    plugins: [outerFrame]
  });

  canvas._chart = chart;
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

// === 依你的 styles.css 做版面：row2 左寬右窄、row3 3:7；≤1024 單欄 ===
function applyResponsiveGrids() {
  const row2 = document.getElementById('row2');
  const row2b = document.getElementById('row2b');
  const row3 = document.getElementById('row3');
  if (!row2 || !row3) return;

  const narrow = window.innerWidth <= 1024;

  if (narrow) {
    row2.style.display = 'grid';
    row2.style.gridTemplateColumns = '1fr';
    row2.style.gap = '2rem';

    if (row2b) {
      row2b.style.display = 'grid';
      row2b.style.gridTemplateColumns = '1fr';
      row2b.style.gap = '2rem';
    }

    row3.style.display = 'grid';
    row3.style.gridTemplateColumns = '1fr';
    row3.style.gap = '2rem';
  } else {
    row2.style.display = 'grid';
    row2.style.gridTemplateColumns = '7fr 3fr';
    row2.style.gap = '2rem';
    row2.style.alignItems = 'stretch';

    if (row2b) {
      row2b.style.display = 'grid';
      row2b.style.gridTemplateColumns = '1fr';
      row2b.style.gap = '2rem';
      row2b.style.alignItems = 'stretch';
    }

    row3.style.display = 'grid';
    row3.style.gridTemplateColumns = '3fr 7fr';
    row3.style.gap = '2rem';
    row3.style.alignItems = 'stretch';
  }
}

window.addEventListener('resize', () => {
  applyResponsiveGrids();
});

// === Style Analysis + Player Stats（第二列渲染） ===
function renderStyleAnalysisAndStats(data) {
  const statsGrid = document.getElementById('detailStatsGrid');
  const barsEl = document.getElementById('styleBars');
  const tagsEl = document.getElementById('styleTags');
  if (!statsGrid || !barsEl || !tagsEl) return;

  // ===== Player Stats（左側） =====
  const pf = data.player_features || {};
  const sp = data.style_profile || {};
  const vs = data.vision || {};

  statsGrid.innerHTML = '';
  const cells = [
    ['Kills / game', fmtNum(sp.kills_pg)],
    ['Deaths / game', fmtNum(sp.deaths_pg)],
    ['Assists / game', fmtNum(sp.assists_pg)],
    ['KP', pf['KP'] != null ? pf['KP'].toFixed(1) + '%' : '—'],
    ['DMG%', pf['DMG%'] != null ? pf['DMG%'].toFixed(1) + '%' : '—'],
    ['DTH%', pf['DTH%'] != null ? pf['DTH%'].toFixed(1) + '%' : '—'],
    ['CSPM', fmtNum(pf['CSPM'])],
    ['DPM', pf['DPM_user'] != null ? pf['DPM_user'].toFixed(0) : '—'],
    ['GOLD%', pf['GOLD%'] != null ? pf['GOLD%'].toFixed(1) + '%' : '—'],
    ['Wards placed / game', fmtNum(vs?.placed)],
    ['Wards cleared / game', fmtNum(vs?.killed)],
  ];
  cells.forEach(([k, v]) => {
    const div = document.createElement('div');
    div.className = 'rounded-md border border-border p-3';
    div.innerHTML = `
      <div class="text-xs text-text-secondary">${k}</div>
      <div class="text-base font-bold">${v}</div>
    `;
    statsGrid.appendChild(div);
  });

  // ===== Style Bars（右側，四個主風格） =====
  barsEl.innerHTML = '';

  const clamp01 = v => Math.max(0, Math.min(1, v));
  const toPct = v => Math.round(clamp01(v) * 100);

  // Aggressive: 高 DPM / 高 KP / 死亡偏高（進攻換風險）
  const sAgg = clamp01(((pf['DPM_user'] || 0) / 600) * 0.5 + ((pf['KP'] || 0) / 70) * 0.3 + ((sp.deaths_pg || 0) / 5) * 0.2);
  const scoreAggressive = toPct(sAgg);

  // Safe: 低死亡、穩定（DPM 適中、DMG% 適中）
  const sSafe = clamp01((Math.max(0, 5 - (sp.deaths_pg || 0)) / 5) * 0.7 + (Math.max(0, 28 - (pf['DMG%'] || 0)) / 28) * 0.3);
  const scoreSafe = toPct(sSafe);

  // Team-oriented: 高 KP、視野有貢獻
  const sTeam = clamp01(((pf['KP'] || 0) / 70) * 0.7 + ((vs?.placed || 0) / 12) * 0.15 + ((vs?.killed || 0) / 2) * 0.15);
  const scoreTeam = toPct(sTeam);

  // Scaling: 晚期參與 + 輸出較高
  const sScaling = clamp01((sp.late_k_frac || 0) * 0.6 + ((pf['DPM_user'] || 0) / 600) * 0.4);
  const scoreScaling = toPct(sScaling);

  const bars = [
    ['Aggressive',      scoreAggressive],
    ['Safe',            scoreSafe],
    ['Team-oriented',   scoreTeam],
    ['Scaling',         scoreScaling],
  ];

  bars.forEach(([label, val]) => {
    const row = document.createElement('div');
    row.innerHTML = `
      <div class="flex items-center justify-between text-xs mb-1">
        <span class="text-text-secondary">${label}</span>
        <span class="font-semibold">${val}%</span>
      </div>
      <div class="w-full h-2 rounded-full bg-border overflow-hidden">
        <div class="h-2 bg-primary" style="width:${val}%"></div>
      </div>
    `;
    barsEl.appendChild(row);
  });

  // ===== Tags（其餘副詞條） =====
  tagsEl.innerHTML = '';
  (data.style_tags || []).forEach(t => tagsEl.appendChild(makeTagBadge(t)));
}

function makeTagBadge(name) {
  const span = document.createElement('span');
  span.textContent = name;
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
