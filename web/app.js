/* ============================================================
   EXILE HUB — mockup logic + sample data
   All data here is DEMO. Later this gets replaced by the
   aggregator output (feed.json) + poe.ninja / poe2db data.
   ============================================================ */

/* ---------------- SAMPLE DATA ---------------- */

const BUILDS = [];

const ASC_META = [];

const CURRENCY = [];

const FEED = [];

/* ---------------- HELPERS ---------------- */

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));

/* Inline outline icons (Lucide/Phosphor style) — one consistent family, themeable
   via currentColor, no emoji (emoji render differently per-OS and can't be tinted). */
const _ICONS = {
  play:      '<path d="M6 4l14 8-14 8z" fill="currentColor" stroke="none"/>',
  youtube:   '<path d="M22.5 6.9a2.8 2.8 0 0 0-1.9-2C18.9 4.5 12 4.5 12 4.5s-6.9 0-8.6.4a2.8 2.8 0 0 0-2 2A29 29 0 0 0 1 12a29 29 0 0 0 .5 5.1 2.8 2.8 0 0 0 1.9 2c1.7.4 8.6.4 8.6.4s6.9 0 8.6-.4a2.8 2.8 0 0 0 1.9-2 29 29 0 0 0 .5-5.1 29 29 0 0 0-.5-5.1z"/><path d="M10 15l5-3-5-3z" fill="currentColor" stroke="none"/>',
  newspaper: '<path d="M4 22a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M6 2h14a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H4"/><path d="M18 14h-8M15 18h-5M10 6h8v4h-8z"/>',
  sparkles:  '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" fill="currentColor" stroke="none"/>',
  send:      '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',
  twitch:    '<path d="M21 2H3v16h5v4l4-4h5l4-4V2z"/><path d="M11 11V7M16 11V7"/>',
  globe:     '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z"/>',
  star:      '<path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" fill="currentColor" stroke="none"/>',
  film:      '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18M17 3v18M3 7.5h4M3 12h18M3 16.5h4M17 7.5h4M17 16.5h4"/>',
};
const iconSvg = (name, cls = "ico-svg") =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${_ICONS[name] || ""}</svg>`;
/* Gold monogram for build cards — an illuminated-initial in place of a per-build emoji. */
const monogram = (s) => `<span class="mono" aria-hidden="true">${esc((String(s).trim()[0] || "?").toUpperCase())}</span>`;

function sparkline(values, color) {
  const w = 72, h = 22, pad = 2;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>
  </svg>`;
}

const deltaHtml = (d) => {
  if (!d) return `<span class="delta" style="color:var(--faint)">—</span>`;
  const up = d > 0;
  return `<span class="delta ${up ? "up" : "down"}">${up ? "▲" : "▼"} ${Math.abs(d)}%</span>`;
};

const trendHtml = (t) => t > 0 ? `<span class="delta up">▲</span>`
  : t < 0 ? `<span class="delta down">▼</span>` : `<span class="delta" style="color:var(--faint)">—</span>`;

const fmtPrice = (v) => v == null ? "" : v >= 100 ? Math.round(v).toLocaleString("ru-RU")
  : v >= 10 ? v.toFixed(1) : v.toFixed(2);

const pips = (n) => Array.from({ length: 3 }, (_, i) => `<span class="pip ${i < n ? "on" : ""}"></span>`).join("");

const fmtViews = (n) => typeof n === "number"
  ? (n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M" : n >= 1e3 ? Math.round(n / 1e3) + "k" : "" + n)
  : (n || "");

const thumbMedia = (i) => i.thumb_url
  ? `<img class="thumb-img" src="${esc(i.thumb_url)}" alt="" loading="lazy" onerror="this.style.display='none'">`
  : `<span class="thumb-emoji">${iconSvg("film")}</span>`;

/* ---------------- RENDER: TIER LIST ---------------- */

const buildState = { role: "all", budget: "all" };
let BUILD_DATA = null;   // replaced by data/builds.json (mobalytics link-out) when available

async function loadBuilds() {
  try {
    const res = await fetch("data/builds.json", { cache: "no-store" });
    if (!res.ok) return;
    const d = await res.json();
    if (!Array.isArray(d.builds) || !d.builds.length) return;
    BUILD_DATA = d.builds;
    const note = document.querySelector("#builds .section-note");
    if (note) note.innerHTML = `тир-лист и гайды: <a href="${esc(d.source_url || "https://mobalytics.gg/poe-2")}" target="_blank" rel="noopener" style="color:var(--gold)">mobalytics.gg</a>`;
    const f = document.querySelector("#buildFilters");
    if (f) f.style.display = "none";   // role/budget filters don't apply to link-out data
  } catch (e) { /* keep demo builds */ }
}

function liveBuildCard(b) {
  return `<a class="build-card" href="${esc(b.url)}" target="_blank" rel="noopener">
    <div class="build-icon">${monogram(b.name)}</div>
    <div class="build-body">
      <div class="build-name">${esc(b.name)}</div>
      <div class="build-asc">${esc(b.asc || "")}</div>
      <div class="build-foot"><span class="build-link">Гайд на mobalytics →</span></div>
    </div>
  </a>`;
}

function renderTierlist() {
  if (BUILD_DATA) {
    $("#tierlist").innerHTML = ["S", "A", "B", "C", "D"].map(t => {
      const cards = BUILD_DATA.filter(b => b.tier === t);
      return cards.length ? `<div class="tier-row"><div class="tier-badge tier-${t}">${t}</div>
        <div class="tier-cards">${cards.map(liveBuildCard).join("")}</div></div>` : "";
    }).join("");
    return;
  }
  const filtered = BUILDS.filter(b =>
    (buildState.role === "all"   || b.roles.includes(buildState.role)) &&
    (buildState.budget === "all" || b.budget === buildState.budget)
  );
  const tiers = ["S", "A", "B"];
  const html = tiers.map(t => {
    const cards = filtered.filter(b => b.tier === t);
    if (!cards.length) return "";
    return `<div class="tier-row">
      <div class="tier-badge tier-${t}">${t}</div>
      <div class="tier-cards">${cards.map(buildCard).join("")}</div>
    </div>`;
  }).join("");
  $("#tierlist").innerHTML = html || `<p class="section-note">Под эти фильтры билдов нет — попробуй ослабить условия.</p>`;
}

function buildCard(b) {
  return `<div class="build-card">
    <div class="build-icon">${monogram(b.name)}</div>
    <div class="build-body">
      <div class="build-name">${esc(b.name)}</div>
      <div class="build-asc">${esc(b.asc)}</div>
      <div class="build-tags">
        <span class="tag">${esc(b.budget)}</span>
        ${b.tags.map(t => `<span class="tag">${esc(t)}</span>`).join("")}
      </div>
      <div class="build-foot">
        <span class="difficulty">сложность ${pips(b.diff)}</span>
        <a class="build-link" href="#builds">Гайд →</a>
      </div>
    </div>
  </div>`;
}

/* ---------------- RENDER: META ---------------- */

let ascData = ASC_META;   // replaced by data/meta.json (poe.ninja) when available
let curData = CURRENCY;
let curUnit = "ex";

async function loadMeta() {
  try {
    const res = await fetch("data/meta.json", { cache: "no-store" });
    if (!res.ok) return;
    const d = await res.json();
    if (Array.isArray(d.ascendancies) && d.ascendancies.length) ascData = d.ascendancies;
    if (Array.isArray(d.currency) && d.currency.length) curData = d.currency;
    if (d.unit) curUnit = d.unit;
    if (d.generated_at) {
      const sub = document.querySelector("#economy .panel-sub");
      if (sub) sub.textContent = `цена в ${curUnit} · poe.ninja`;
    }
  } catch (e) { /* keep demo data */ }
}

function renderAscMeta() {
  if (!ascData.length) { $("#ascMeta").innerHTML = `<li class="empty-state">Пока нет данных — появятся после подключения к poe.ninja.</li>`; return; }
  const max = Math.max(...ascData.map(a => a.pct));
  $("#ascMeta").innerHTML = ascData.map(a => `
    <li class="bar-row">
      <span class="bar-name">${esc(a.name)}${a.cls ? ` <small>${esc(a.cls)}</small>` : ""}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${(a.pct / max * 100).toFixed(0)}%"></span></span>
      <span class="bar-meta"><span class="bar-pct">${a.pct}%</span>${a.delta != null ? deltaHtml(a.delta) : trendHtml(a.trend)}</span>
    </li>`).join("");
}

function renderEconomy() {
  if (!curData.length) { $("#econBody").innerHTML = `<tr><td colspan="4" class="empty-state">Пока нет данных — появятся после подключения к poe.ninja.</td></tr>`; return; }
  const unit = (curUnit || "ex").split(" ")[0].toLowerCase();
  $("#econBody").innerHTML = curData.map(c => {
    const color = c.delta > 0 ? "var(--green)" : c.delta < 0 ? "var(--red)" : "var(--faint)";
    const orb = c.img
      ? `<span class="cur-orb"><img src="${esc(c.img)}" alt="" loading="lazy" onerror="this.parentNode.textContent='◈'"></span>`
      : `<span class="cur-orb">${esc(c.orb || (c.name ? c.name[0].toUpperCase() : "◈"))}</span>`;
    const price = c.price != null ? esc(c.price) : fmtPrice(c.value);
    const spark = c.spark && c.spark.length ? c.spark : [1, 1];
    return `<tr>
      <td><div class="cur-cell">${orb}<span class="cur-name">${esc(c.name)}</span></div></td>
      <td><span class="cur-price">${price}</span> <span style="color:var(--faint);font-size:11px">${esc(unit)}</span></td>
      <td class="ta-c">${sparkline(spark, color)}</td>
      <td class="ta-r">${deltaHtml(c.delta)}</td>
    </tr>`;
  }).join("");
}

/* ---------------- RENDER: FEED ---------------- */

const feedState = { type: "all", lang: "all" };
let FEED_ITEMS = FEED;   // replaced by data/feed.json when available

async function loadFeed() {
  // On localhost try the live API first; on the public static site go straight to feed.json.
  const isLocal = ["localhost", "127.0.0.1"].includes(location.hostname);
  const sources = isLocal ? ["/api/feed?limit=60", "data/feed.json"] : ["data/feed.json"];
  for (const url of sources) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const data = await res.json();
      if (!Array.isArray(data.items) || !data.items.length) continue;
      FEED_ITEMS = data.items;
      const strong = document.querySelector(".league-strip strong");
      if (strong && data.league) strong.textContent = "Лига " + data.league;
      const tag = document.querySelector(".league-strip .sample-tag");
      if (tag && data.generated_at)
        tag.textContent = "обновлено " + new Date(data.generated_at)
          .toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
      return;
    } catch (e) { /* try next source */ }
  }
  console.warn("ни API, ни feed.json недоступны — показываю демо-данные.");
}

function renderFeed() {
  const items = FEED_ITEMS.filter(i =>
    (feedState.type === "all" || i.type === feedState.type) &&
    (feedState.lang === "all" || i.lang === feedState.lang)
  );
  const empty = FEED_ITEMS.length
    ? `<p class="section-note">Под выбранные фильтры записей нет.</p>`
    : `<p class="empty-state">Пока пусто. Скоро здесь появятся свежие видео, новости и Reddit по лиге — как только начнём наполнять ленту.</p>`;
  $("#feedGrid").innerHTML = items.length ? items.map(feedCard).join("") : empty;
}

// Wrap a card in a real <a> when it has a destination (so it's clickable AND
// keyboard-focusable); fall back to a non-interactive <article> when it doesn't,
// so a card never *looks* clickable while doing nothing.
function cardWrap(href, cls, inner) {
  return href
    ? `<a class="${cls}" href="${esc(href)}" target="_blank" rel="noopener">${inner}</a>`
    : `<article class="${cls}">${inner}</article>`;
}

function feedCard(i) {
  const langPill = `<span class="lang-pill ${i.lang}">${i.lang.toUpperCase()}</span>`;
  const cls = `feed-card${i.isNew ? " is-new" : ""}`;
  const href = i.url || i.link || "";

  if (i.featured && i.digest) return featuredCard(i);

  if (i.type === "video") {
    return cardWrap(href, cls, `
      <div class="thumb ${i.grad || ""}">
        ${thumbMedia(i)}
        <span class="play"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>
        ${i.duration ? `<span class="duration">${esc(i.duration)}</span>` : ""}
      </div>
      <div class="feed-body">
        <div class="feed-src"><span class="src-badge src-yt">${iconSvg("play")}</span><span class="src-name">${esc(i.channel)}</span>${langPill}</div>
        <h3 class="feed-title">${esc(i.title)}</h3>
        ${i.digest ? digestMini(i.digest) : ""}
        <div class="feed-meta"><span>${i.views != null && i.views !== "" ? fmtViews(i.views) + " просмотров" : "YouTube"}</span><span>${esc(i.time)}</span></div>
      </div>`);
  }

  if (i.type === "reddit") {
    return cardWrap(href, cls, `
      <div class="feed-body">
        <div class="feed-src"><span class="src-badge src-reddit">r/</span><span class="src-name">${esc(i.source)}</span>${langPill}</div>
        <h3 class="feed-title">${esc(i.title)}</h3>
        <div class="feed-meta"><span class="up">${i.ups ? "▲ " + esc(i.ups) : "обсуждение"}</span><span>${esc(i.time)}</span></div>
      </div>`);
  }

  // news
  return cardWrap(href, cls, `
    <div class="feed-body">
      <div class="feed-src"><span class="src-badge src-news">${iconSvg("newspaper")}</span><span class="src-name">${esc(i.source)}</span>${langPill}</div>
      <h3 class="feed-title">${esc(i.title)}</h3>
      ${i.snippet ? `<p class="feed-snippet">${esc(i.snippet)}</p>` : ""}
      <div class="feed-meta"><span>Новость</span><span>${esc(i.time)}</span></div>
    </div>`);
}

function featuredCard(i) {
  const d = i.digest;
  const signals = (d.signals || []).map(s => `<span class="signal ${s.k}">${esc(s.t)}</span>`).join("");
  const builds  = (d.builds  || []).map(b => `<span class="build-chip">${esc(b)}</span>`).join("");
  const points  = (d.points  || []).map(p => `<li>${esc(p)}</li>`).join("");
  const sBlock = signals ? `<div class="digest-block"><span class="digest-row-label">Сигналы патча</span><div class="signals">${signals}</div></div>` : "";
  const bBlock = builds  ? `<div class="digest-block"><span class="digest-row-label">Билды</span><div class="build-chips">${builds}</div></div>` : "";
  const pBlock = points  ? `<div class="digest-block"><span class="digest-row-label">Главное</span><ul class="digest-points">${points}</ul></div>` : "";
  const href = i.url || i.link || "";
  return cardWrap(href, "feed-card featured is-new", `
    <div class="thumb ${i.grad || ""}">
      ${thumbMedia(i)}
      <span class="play"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>
      ${i.duration ? `<span class="duration">${esc(i.duration)}</span>` : ""}
    </div>
    <div class="feed-body">
      <div class="feed-src">
        <span class="src-badge src-yt">${iconSvg("play")}</span>
        <span class="src-name">${esc(i.channel)}</span>
        ${i.views != null ? `<span class="src-name">· ${fmtViews(i.views)} просмотров</span>` : ""}
        <span class="lang-pill ${i.lang || "en"}">${(i.lang || "en").toUpperCase()}</span>
      </div>
      <h3 class="feed-title">${esc(i.title)}</h3>
      <div class="digest">
        <div class="digest-label">${iconSvg("sparkles")} AI-дайджест из видео</div>
        <p class="digest-tldr">${esc(d.tldr)}</p>
        ${pBlock}${sBlock}${bBlock}
      </div>
    </div>`);
}

function digestMini(d) {
  const pts  = (d.points || []).slice(0, 3).map(p => `<li>${esc(p)}</li>`).join("");
  const tags = (d.tags   || []).slice(0, 4).map(t => `<span class="mini-tag">${esc(t)}</span>`).join("");
  return `<div class="digest-mini">
    <span class="digest-mini-label">${iconSvg("sparkles")} AI-дайджест</span>
    <p class="digest-mini-tldr">${esc(d.tldr || "")}</p>
    ${pts ? `<ul class="digest-points mini">${pts}</ul>` : ""}
    ${tags ? `<div class="mini-tags">${tags}</div>` : ""}
  </div>`;
}

/* ---------------- INTERACTIONS ---------------- */

function wireChipGroup(container, onPick) {
  $$(".filter-group", container).forEach(group => {
    const key = group.dataset.filter;
    group.addEventListener("click", e => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      $$(".chip", group).forEach(c => { c.classList.remove("is-active"); c.setAttribute("aria-pressed", "false"); });
      chip.classList.add("is-active");
      chip.setAttribute("aria-pressed", "true");
      onPick(key, chip.dataset.value);
    });
  });
}

async function loadSiteArticles() {
  try {
    const res = await fetch("data/articles.json", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    if (!Array.isArray(data.articles) || !data.articles.length) return;
    $("#articlesGrid").innerHTML = data.articles.map(articleCard).join("");
    document.querySelector("#articles")?.classList.remove("hidden");
    document.querySelector("#navArticles")?.classList.remove("hidden");
  } catch (e) { /* no articles yet */ }
}

function articleCard(a) {
  const body = esc(a.body || "").replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br>");
  return `<article class="article-card">
    <h3 class="article-title">${a.promote ? iconSvg("star") + " " : ""}${esc(a.title)}</h3>
    ${a.author ? `<div class="article-author">${esc(a.author)}</div>` : ""}
    ${a.summary ? `<p class="article-summary">${esc(a.summary)}</p>` : ""}
    ${a.body ? `<details class="article-more"><summary>Читать полностью</summary><div class="article-body"><p>${body}</p></div></details>` : ""}
  </article>`;
}

async function loadSiteCreators() {
  try {
    const res = await fetch("data/creators.json", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    if (!Array.isArray(data.creators) || !data.creators.length) return;
    $("#creatorsGrid").innerHTML = data.creators.map(creatorCard).join("");
    document.querySelector("#creators")?.classList.remove("hidden");
  } catch (e) { /* no promoted creators yet */ }
}

function creatorCard(c) {
  const link = (url, label) => url ? `<a class="creator-social" href="${esc(url)}" target="_blank" rel="noopener">${label}</a>` : "";
  const tg = c.telegram ? (c.telegram.startsWith("http") ? c.telegram : "https://t.me/" + c.telegram.replace(/^@/, "")) : "";
  const tw = c.twitch ? (c.twitch.startsWith("http") ? c.twitch : "https://twitch.tv/" + c.twitch.replace(/^@/, "")) : "";
  return `<article class="creator-card">
    <div class="creator-name">${esc(c.name)}</div>
    <div class="creator-socials">
      ${link(c.youtube_url, iconSvg("youtube") + " YouTube")}${link(tg, iconSvg("send") + " Telegram")}${link(tw, iconSvg("twitch") + " Twitch")}${link(c.website, iconSvg("globe") + " Сайт")}
    </div>
  </article>`;
}

async function init() {
  await Promise.all([loadFeed(), loadMeta(), loadBuilds(), loadSiteArticles(), loadSiteCreators()]);
  renderTierlist();
  renderAscMeta();
  renderEconomy();
  renderFeed();

  // reflect toggle (tab/chip/lang) state to assistive tech
  $$(".tab, .chip, .lang-btn").forEach(b => b.setAttribute("aria-pressed", String(b.classList.contains("is-active"))));

  // build filters
  wireChipGroup($("#buildFilters"), (key, val) => {
    buildState[key] = val;
    renderTierlist();
  });

  // feed type tabs
  $("#feedTabs").addEventListener("click", e => {
    const tab = e.target.closest(".tab");
    if (!tab) return;
    $$(".tab", $("#feedTabs")).forEach(t => { t.classList.remove("is-active"); t.setAttribute("aria-pressed", "false"); });
    tab.classList.add("is-active");
    tab.setAttribute("aria-pressed", "true");
    feedState.type = tab.dataset.type;
    renderFeed();
  });

  // language toggle (filters the feed)
  $("#langToggle").addEventListener("click", e => {
    const btn = e.target.closest(".lang-btn");
    if (!btn) return;
    $$(".lang-btn", $("#langToggle")).forEach(b => { b.classList.remove("is-active"); b.setAttribute("aria-pressed", "false"); });
    btn.classList.add("is-active");
    btn.setAttribute("aria-pressed", "true");
    feedState.lang = btn.dataset.lang;
    renderFeed();
  });

  // mobile nav
  const burger = $("#burger"), nav = $("#nav");
  const setNav = (open) => { nav.classList.toggle("open", open); burger.setAttribute("aria-expanded", String(open)); };
  burger.addEventListener("click", () => setNav(!nav.classList.contains("open")));
  nav.addEventListener("click", e => { if (e.target.tagName === "A") setNav(false); });
}

document.addEventListener("DOMContentLoaded", init);
