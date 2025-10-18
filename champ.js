const LOCALE = "en_US";

let idToName = {};
let isReady = false;

export async function initChampions() {
  if (isReady) return;
  try {
    const versionsRes = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
    const versions = await versionsRes.json();
    const latest = versions?.[0];
    if (!latest) throw new Error("No DDragon versions");

    const champsRes = await fetch(`https://ddragon.leagueoflegends.com/cdn/${latest}/data/${LOCALE}/champion.json`);
    const champs = await champsRes.json();

    const map = {};
    for (const key of Object.keys(champs.data || {})) {
      const c = champs.data[key];
      // c.key 是數字字串（例："266"），c.name 是顯示名稱
      map[c.key] = c.name;
    }
    idToName = map;
    isReady = true;
  } catch (e) {
    console.error("initChampions failed:", e);
    // 若失敗，仍讓程式可跑，只是名稱會退回顯示 id
    idToName = {};
    isReady = true;
  }
}

/** 將 championId（數字或字串）轉名稱；找不到就回傳 "#<id>" 當作後援 */
export function champName(id) {
  const k = String(id);
  return idToName[k] || `#${k}`;
}
