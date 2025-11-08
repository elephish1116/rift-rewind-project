// const LAMBDA_STATS_URL = 'https://h2unirbnaisgy33o75ualduq2u0tovkb.lambda-url.ap-southeast-2.on.aws/'; // ← Replace
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
    
    
    progressContainer.style.display = 'block';
    progressBar.style.transition = 'none';
    const START_BASE = 5;
    progressBar.style.width = START_BASE + '%';
    void progressBar.offsetWidth; 
    progressBar.style.transition = 'width 0.4s ease'

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

    progressContainer.style.display = 'block';
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
        const playerImg = `images/players/${playerName}.jpg`;

        resultDiv.innerHTML = `
          <div class="match-card">
            <h1 class="match-title">You Matched With...</h1>

            <div class="card-container">
              <div class="profile-image">
                <img src="${playerImg}" alt="${playerName}" onerror="this.src='images/players/default.jpg'">
              </div>

               <div class="progress-circle">
                <div class="progress-number">${simPercent.toFixed(1)}%</div>
              </div>

              <h2 class="profile-name">${playerName}</h2>

              <p class="profile-description">
                ${escapeHtml(data.style_analysis || 'No analysis available.')}
              </p>

              <div class="button-group">
                <button class="btn btn-primary">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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

        const statsHTML = `
          <div class="player-stats">
            <h2>Player Insights</h2>
            <div class="insight-section heatmap">
              <h3>🔥 Kill Heatmap</h3>
              <canvas id="heatmapCanvas"></canvas>
            </div>
            <div class="insight-section timeline">
              <h3>📈 Match Timeline</h3>
              <canvas id="timelineChart"></canvas>
            </div>
            <div class="insight-section champions">
              <h3>🏆 Most Played Champions</h3>
              <div id="championList"></div>
            </div>
            <div class="insight-section vision">
              <h3>👁️ Vision Control</h3>
              <canvas id="visionChart"></canvas>
            </div>
          </div>
        `;
        resultDiv.insertAdjacentHTML('beforeend', statsHTML);

        // 最後再渲染圖表（先有 DOM 再畫）
        if (data.heatmap_points) renderHeatmap(data.heatmap_points);
        if (data.timeline)        renderTimeline(data.timeline);
        if (data.common_champions) renderChampions(data.common_champions);
        if (data.vision)          renderVision(data.vision);

      }
    } catch (err) {
      showLookupMessage(`⚠️ Network or CORS error${err}`, 'error');
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

// --- Save Card as Image ---
document.addEventListener('click', async function (e) {
  const saveBtn = e.target.closest('.btn-primary');
  if (!saveBtn) return; 

  const card = document.querySelector('.match-card');
  if (!card) return alert('❌ No card found to save.');

  // temporarily hide button group to avoid appearing in the image
  const buttonGroup = card.querySelector('.button-group');
  if (buttonGroup) buttonGroup.style.display = 'none';

  try {
    const dataUrl = await htmlToImage.toJpeg(card, {
      pixelRatio: 2,            
      backgroundColor: '#2d2a54',
      useCORS: true,
      cacheBust: true
    });

    // 建立下載連結
    const link = document.createElement('a');
    link.download = 'match_card.jpg';
    link.href = dataUrl;
    link.click();

  } catch (err) {
    console.error(err);
    alert('⚠️ Failed to save image: ' + err.message);
  } finally {
    // show back button
    if (buttonGroup) buttonGroup.style.display = 'flex';
  }
});


function showLookupMessage(text, type) {
  const msg = document.getElementById('lookup-message');
  msg.textContent = text;
  msg.className = `form-message ${type}`;
  msg.style.display = 'block';
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function showMessage(text, type) {
    const messageDiv = document.getElementById('form-message');
    messageDiv.textContent = text;
    messageDiv.className = `form-message ${type}`;
    messageDiv.style.display = 'block';

    // Auto-hide after 10 seconds
    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 10000);
}

// Heatmap
// function renderHeatmap(points) {
//   const canvas = document.getElementById('heatmapCanvas');
//   if (!canvas) return;

//   // --- Summoner’s Rift 官方座標比例（接近正方形）---
//   const MAP_W = 14870;
//   const MAP_H = 14980;
//   const ratio = MAP_H / MAP_W; // ≈ 1:1

//   // 以容器寬度為基準，自動設定畫布寬高（保持與地圖相同的長寬比）
//   const cssWidth = canvas.clientWidth || 600;
//   const cssHeight = Math.round(cssWidth * ratio);

//   // 讓畫布外觀尺寸與內部像素尺寸一致（避免拉伸失真）
//   canvas.style.width = cssWidth + 'px';
//   canvas.style.height = cssHeight + 'px';

//   // Retina 像素密度處理（讓點不糊）
//   const dpr = window.devicePixelRatio || 1;
//   canvas.width  = Math.round(cssWidth * dpr);
//   canvas.height = Math.round(cssHeight * dpr);

//   const ctx = canvas.getContext('2d');
//   ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // 之後用 CSS 尺寸作畫

//   // 映射比例（以 CSS 尺寸為座標系統）
//   const sx = cssWidth  / MAP_W;
//   const sy = cssHeight / MAP_H;

//   // 畫點（y 要翻轉）
//   points.forEach(p => {
//     const x = p.x * sx;
//     const y = (MAP_H - p.y) * sy; 
//     ctx.fillStyle = (p.type === 'death')
//       ? 'rgba(239, 68, 68, 0.45)'   // 死亡：紅
//       : 'rgba(139, 92, 246, 0.45)'; // 參與擊殺：紫
//     ctx.beginPath();
//     ctx.arc(x, y, 4, 0, Math.PI * 2);
//     ctx.fill();
//   });
// }

function renderHeatmap(points) {
  const canvas = document.getElementById('heatmapCanvas');
  if (!canvas) return;

  // LoL 地圖座標範圍（SR）
  const MAP_W = 14870;
  const MAP_H = 14980;

  // 這張 minimap.png 的「相對」邊框比例（四邊一樣厚）
  const BORDER_FRAC = 15 / 280;      // ≈ 0.053571
  const ACTIVE_FRAC = 1 - 2 * BORDER_FRAC; // ≈ 0.892857

  // 以 CSS 寬度為基準放大（保持正方形）
  const cssSide = canvas.clientWidth || 600; // 你可以任意放大容器，這裡就會跟著變
  const dpr = window.devicePixelRatio || 1;

  // 讓畫布實際像素與外觀一致（避免糊）
  canvas.style.width  = cssSide + 'px';
  canvas.style.height = cssSide + 'px';
  canvas.width  = Math.round(cssSide * dpr);
  canvas.height = Math.round(cssSide * dpr);

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // 用 CSS 尺寸作畫

  // 根據目前畫布邊長，動態算出「有效繪圖區」的位置與縮放
  const offset = cssSide * BORDER_FRAC;       // 內縮邊框（四邊）
  const activeSide = cssSide * ACTIVE_FRAC;   // 正中央可繪 250 区域的放大版邊長

  // 把 LoL 座標映射到「有效繪圖區」
  const sx = activeSide / MAP_W;
  const sy = activeSide / MAP_H;

  // 建議點半徑隨尺寸縮放
  const r = Math.max(2, Math.min(6, Math.round(cssSide * 0.006)));

  // 畫點（注意方向：這裡採用「不翻轉」，紅方泉水在右上、藍方在左下）
  points.forEach(p => {
    const x = offset + p.x * sx;
    const y = offset + (MAP_H - p.y) * sy;

    if (p.type === 'kill') {
      ctx.fillStyle   = 'rgba(22, 227, 15, 0.95)';
      ctx.shadowColor = 'rgba(22, 227, 15, 0.75)';
    } else if (p.type === 'death') {
      ctx.fillStyle   = 'rgba(247, 148, 26, 0.95)';
      ctx.shadowColor = 'rgba(247, 148, 26, 0.75)';
    }
    ctx.shadowBlur = 12;

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  });
}


// Timeline
function renderTimeline(data) {
  const ctx = document.getElementById('timelineChart');
  if (!ctx) return;

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => d.minute),
      datasets: [
        {
          label: 'Kill Participations',
          data: data.map(d => d.kills),
          borderColor: '#8b5cf6',   // 紫色線：擊殺參與
          backgroundColor: 'rgba(139, 92, 246, 0.2)',
          tension: 0.4,
          fill: false
        },
        {
          label: 'Deaths',
          data: data.map(d => d.deaths),
          borderColor: '#ef4444',   // 紅色線：死亡
          backgroundColor: 'rgba(239, 68, 68, 0.2)',
          tension: 0.4,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'top' },
        title: {
          display: true,
          text: 'Kill Participation vs Death Timeline'
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'Minute' }
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Events per Minute' }
        }
      }
    }
  });
}

// Champions
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

// Vision
function renderVision(v) {
  const ctx = document.getElementById('visionChart');
  if (!ctx) return;
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Wards Placed', 'Wards Killed'],
      datasets: [{
        data: [v.placed, v.killed],
        backgroundColor: ['#a78bfa', '#7877c6']
      }]
    },
    options: { cutout: '70%' }
  });
}