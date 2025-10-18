export const el = (id) => document.getElementById(id);

export const msg = (text, type = "success") => {
  const div = el("lookup-message");
  div.textContent = text;
  div.className = `lookup-message ${type}`;
  div.style.display = "block";
  setTimeout(() => (div.style.display = "none"), 6000);
};

export const safeFetch = async (url) => {
  const r = await fetch(url);
  const t = await r.text();
  try {
    return { status: r.status, json: JSON.parse(t) };
  } catch {
    return { status: r.status, json: { _raw: t } };
  }
};

export const guessRegional = (platform) => {
  const asia = new Set(["kr", "jp1"]);
  const amer = new Set(["na1", "br1", "la1", "la2"]);
  const eu   = new Set(["euw1", "eun1", "tr1", "ru"]);
  const sea  = new Set(["oc1", "ph2", "sg2", "th2", "tw2", "vn2", "id1"]);
  if (asia.has(platform)) return "asia";
  if (amer.has(platform)) return "americas";
  if (eu.has(platform)) return "europe";
  if (sea.has(platform)) return "sea";
  return "americas";
};

export const fmtRank = (e) => {
  if (!e || !e.tier) return "Unranked";
  const q = (e.queueType || "").replaceAll("_", " ").toLowerCase();
  const total = (e.wins || 0) + (e.losses || 0);
  const wr = total > 0 ? Math.round((e.wins * 100) / total) : 0;
  return `${e.tier} ${e.rank || ""} – ${e.leaguePoints || 0} LP (${e.wins || 0}-${e.losses || 0}, ${wr}% WR) · ${q}`;
};

export const htmlForChampions = (j) => {
  const cell = (x) =>
    `<div class="card mini"><strong>#${x.championId}</strong><br>${(x.winRate * 100).toFixed(0)}% WR · KDA ${(x.kda || 0).toFixed(2)} · ${x.games} games</div>`;
  const simpleCell = (x) =>
    `<div class="card mini"><strong>#${x.championId}</strong><br>KDA ${(x.kda || 0).toFixed(2)} · ${x.games} games</div>`;

  const strong = (j.strong || []).slice(0, 6).map(cell).join("");
  const weak   = (j.weak   || []).slice(0, 6).map(cell).join("");
  const rec    = (j.recommend || []).slice(0, 6).map(simpleCell).join("");

  return `
    <div class="mini"><strong>Strong picks</strong></div>
    <div class="grid">${strong || '<div class="mini">—</div>'}</div>
    <div class="mini" style="margin-top:10px;"><strong>Weak picks</strong></div>
    <div class="grid">${weak || '<div class="mini">—</div>'}</div>
    <div class="mini" style="margin-top:10px;"><strong>Try these</strong></div>
    <div class="grid">${rec || '<div class="mini">—</div>'}</div>
    ${j.partial ? '<div class="mini warn" style="margin-top:6px;">Partial result – click Load More to continue.</div>' : ''}
  `;
};
