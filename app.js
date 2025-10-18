import { URL_SUMMONER, URL_STYLE, URL_SD, URL_CH } from "./config.js";
import { el, msg, safeFetch, guessRegional, fmtRank, htmlForChampions } from "./helpers.js";
import { initChampions, champName } from "./champ.js";

document.addEventListener("DOMContentLoaded", async () => {
    await initChampions();
    // Elements
    const lookupBtn  = el("lookup-btn");
    const nameInput  = el("summoner-name");
    const regionSel  = el("region");

    const btnStyle   = el("btn-style");
    const btnSD      = el("btn-sd");
    const btnCh      = el("btn-ch");
    const btnChMore  = el("btn-ch-more");

    // Local state
    const current = { puuid: null, regional: null, nextStart: 0 };

    // ----- Lookup Summoner -----
    lookupBtn.addEventListener("click", async () => {
        const riotId  = nameInput.value.trim();
        const platform = regionSel.value;

        if (!riotId) return msg("Please enter a Riot ID", "error");
        if (!riotId.includes("#")) return msg("Please use Riot ID format: GameName#TAG", "error");

        lookupBtn.textContent = "Looking up...";
        lookupBtn.disabled = true;

        try {
            const url = `${URL_SUMMONER}?riotId=${encodeURIComponent(riotId)}&platform=${encodeURIComponent(platform)}`;
            const { status, json } = await safeFetch(url);
            if (status !== 200) { msg(json.error || "Failed to fetch summoner data", "error"); return; }

            // Summoner block
            const displayName = json?.summoner?.name || (json?.account ? `${json.account.gameName}#${json.account.tag}` : "Unknown");
            el("summoner-info").innerHTML = `
                <div class="card">
                    <div><strong>Name:</strong> ${displayName}</div>
                    <div><strong>Level:</strong> ${json?.summoner?.level ?? "—"}</div>
                </div>
                <div class="card">
                    <div><strong>Top Champions:</strong></div>
                    <div class="mini">
                        ${
                        (json.topChampions || [])
                            .slice(0, 3)
                            .map((c, i) => {
                                const name = champName(c.championId);
                                return `#${i + 1} ${name} · lvl ${c.championLevel} · ${Number(c.championPoints || 0).toLocaleString()} pts`;
                            })
                            .join("<br>") || "No mastery data"
                        }
                    </div>
                </div>
            `;

            // Ranks block
            const ranks = Array.isArray(json.ranks) ? json.ranks : [];
            el("rank-info").innerHTML = ranks.length
                ? ranks.map(r => `<div class="card">${fmtRank(r)}</div>`).join("")
                : `<div class="card">Unranked</div>`;

            // Save state
            current.puuid    = json?.account?.puuid || null;
            current.regional = json?.regional || guessRegional(platform);
            current.nextStart = 0;

            // PUUID pill + show result area
            const pill = el("puuid-pill");
            pill.textContent = current.puuid ? `puuid: ${current.puuid}` : "";
            pill.style.display = current.puuid ? "inline-block" : "none";
            el("summoner-results").style.display = "block";

            // Reset previous outputs
            el("style-out").innerHTML = "";
            el("sd-out").innerHTML = "";
            el("ch-out").innerHTML = "";
            el("pageHint").textContent = "";

            msg("Summoner found!");
        } catch (e) {
            console.error(e);
            msg("Network error. Please try again.", "error");
        } finally {
            lookupBtn.textContent = "Look Up Summoner";
            lookupBtn.disabled = false;
        }
});

// Enter to trigger lookup
nameInput.addEventListener("keypress", (e) => { if (e.key === "Enter") lookupBtn.click(); });

// ----- Analyze Style -----
btnStyle.addEventListener("click", async () => {
    if (!current.puuid) return msg("Please look up a summoner first.", "error");
    const cnt = el("countStyle").value || "20";
    const url = `${URL_STYLE}?puuid=${encodeURIComponent(current.puuid)}&regional=${encodeURIComponent(current.regional)}&count=${cnt}`;
    const { status, json } = await safeFetch(url);
    if (status !== 200) { msg(json.error || "Style API failed", "error"); return; }
    const a = json.agg || {};
    const tags = (json.tags || []).join(", ") || "—";
    el("style-out").innerHTML = `
      <div><strong>Style:</strong> ${tags}</div>
      <div class="grid">
        <div class="card mini"><strong>Win Rate</strong><br>${a.winRate ? Math.round(a.winRate * 100) : 0}%</div>
        <div class="card mini"><strong>KDA</strong><br>${(a.kda || 0).toFixed(2)}</div>
        <div class="card mini"><strong>KP</strong><br>${a.kp ? Math.round(a.kp * 100) : 0}%</div>
        <div class="card mini"><strong>DMG / min</strong><br>${Math.round(a.dmgPerMin || 0)}</div>
        <div class="card mini"><strong>Vision / game</strong><br>${(a.visionScorePerGame || 0).toFixed(1)}</div>
        <div class="card mini"><strong>Obj.Part / game</strong><br>${(a.objPartPerGame || 0).toFixed(2)}</div>
      </div>
    `;
    msg("Style analyzed.");
});

// ----- Special Days -----
btnSD.addEventListener("click", async () => {
    if (!current.puuid) return msg("Please look up a summoner first.", "error");
    const cnt = el("countSD").value || "50";
    const qs = new URLSearchParams({
        puuid: current.puuid,
        regional: current.regional,
        count: String(cnt),
        ...(current.platform ? { platform: current.platform } : {}),
        ...(current.locale ? { locale: current.locale } : {}),
    })
    // const url = `${URL_SD}?puuid=${encodeURIComponent(current.puuid)}&regional=${encodeURIComponent(current.regional)}&count=${cnt}`;
    const url = `${URL_SD}?${qs.toString()}`;
    const { status, json } = await safeFetch(url);
    if (status !== 200) { msg(json.error || "Special-days API failed", "error"); return; }
    const usedTZ = json.usedTimezone || "UTC";
    const formatMD = (ms, timeZone = usedTZ) => {
        try {
            const parts = new Intl.DateTimeFormat("en-US", {
                month: "numeric",
                day: "numeric",
                timeZone,
            }).formatToParts(new Date(ms));
            const m = parts.find(p => p.type === "month")?.value;
            const d = parts.find(p => p.type === "day")?.value;
            return (m && d) ? `${m}/${d}` : "";
        } catch {
            return "";
        }
    };
    const formatISO = (ms, timeZone = usedTZ) => {
        try {
            return new Intl.DateTimeFormat("sv_SE", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                timeZone,
            }).format(new Date(ms));
        } catch {
            return "";
        }
    };
    const evs = Array.isArray(json.events) ? json.events : [];
    evs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    const badges = evs.length
      ? evs.slice(0, 5).map(e => `<span class="pill mini mono">${(e.notes || []).join(" · ")}</span>`).join(" ")
      : `<span class="mini">No notable events in range</span>`;
    const items = evs.length
      ? `<ul class="list">
            ${evs.map(e => {
                const dateMD = e.dateMD || (e.timestamp ? formatMD(e.timestamp) : "");
                const dateISO = e.dateISO || (e.timestamp ? formatISO(e.timestamp) : "");
                const champ = e.championName || (e.championId ? `#${e.championId}` : "Unknown");
                const notes = Array.isArray(e.notes) ? e.notes.join(", ") : "";
                const err = e.error ? `<span class="mini warn">(${e.error})</span>` : "";

                return `<li class="list-item">
                    <span class="mono">${dateMD || "-"}</span>
                    <span class="mini dim">(${dateISO || "-"})</span>
                    <span> · </span>
                    <strong>${champ}</strong>
                    <span> · </span>
                    <span>${notes}</span>
                    ${err}
                </li>`;
            }).join("")}
        </ul>`
      : `<div class="mini dim" style="margin-top:6px;">No events to show.</div>`;
    const tzInfo = json.usedTimeZone
      ? `<div class="mini dim">Time zone: <span class="mono">${json.usedTimeZone}</span>${json.timeZoneSource ? ` <span class="dim">[${json.timeZoneSource}]</span>` : ""}</div>`
      : `<div class="mini dim">Time zone: <span class="mono">${usedTZ}</span> (front-end)</div>`;
    

    el("sd-out").innerHTML = `
      <div class="grid">
        <div class="card mini"><strong>Max Win Streak</strong><br>${json.maxWinStreak || 0}</div>
        <div class="card mini"><strong>Max Lose Streak</strong><br>${json.maxLoseStreak || 0}</div>
        <div class="card mini"><strong>Current Win Streak</strong><br>${json.recentWinStreak || 0}</div>
        <div class="card mini"><strong>Current Lose Streak</strong><br>${json.recentLoseStreak || 0}</div>
      </div>

      ${tzInfo}

      <div class="section-title mini" style="margin-top:8px;"><strong>Highlights</strong></div>
      <div>${badges}</div>

      <div class="section-title mini" style="margin-top:12px;"><strong>All Special Days</strong></div>
      ${items}
      
      ${json.partial ? '<div class="mini warn" style="margin-top:6px;">Partial result (timeout-safe). Reduce count or fetch again.</div>' : ''}
    `;
    msg(json.partial ? "Partial special-days loaded." : "Special days loaded.");
});

// ----- Champion Stats (with paging) -----
btnCh.addEventListener("click", async () => {
    if (!current.puuid) return msg("Please look up a summoner first.", "error");
    current.nextStart = parseInt(el("startCh").value || "0", 10) || 0;
    await loadCh(false);
});

btnChMore.addEventListener("click", async () => { await loadCh(true); });

async function loadCh(append) {
    const cnt = el("countCh").value || "30";
    const url = `${URL_CH}?puuid=${encodeURIComponent(current.puuid)}&regional=${encodeURIComponent(current.regional)}&start=${current.nextStart}&count=${cnt}`;
    const { status, json } = await safeFetch(url);
    if (status !== 200) { msg(json.error || "Champions API failed", "error"); return; }

    const block = htmlForChampions(json, champName);
    if (!append) el("ch-out").innerHTML = block;
    else el("ch-out").insertAdjacentHTML("beforeend", block);

    current.nextStart = (json?.nextStart ?? (current.nextStart + Number(cnt)));
    el("pageHint").textContent = `nextStart=${current.nextStart}` + (json?.partial ? " (partial)" : "");
    msg(json.partial ? "Partial champions loaded." : "Champion stats loaded.");
  }
});
