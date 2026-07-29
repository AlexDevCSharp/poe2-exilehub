/* ============================================================
   EXILE HUB — mockup logic + sample data
   All data here is DEMO. Later this gets replaced by the
   aggregator output (feed.json) + poe.ninja / poe2db data.
   ============================================================ */

/* ---------------- SAMPLE DATA ---------------- */

const BUILDS = [
  { name: "Spark Stormweaver",        asc: "Sorceress · Stormweaver", icon: "⚡", tier: "S", tags: ["Лёгкий", "Маг"],        roles: ["Лигостарт", "Фарм"],            budget: "Бомж",    diff: 1 },
  { name: "Lightning Spear Amazon",   asc: "Huntress · Amazon",       icon: "🔱", tier: "S", tags: ["Мета", "Универсал"],     roles: ["Лигостарт", "Боссинг", "Фарм"], budget: "Средний", diff: 2 },
  { name: "Gas Arrow Pathfinder",     asc: "Ranger · Pathfinder",     icon: "🏹", tier: "S", tags: ["Фарм карт", "Дёшево"],    roles: ["Фарм", "Лигостарт"],            budget: "Бомж",    diff: 2 },
  { name: "Minion Infernalist",       asc: "Witch · Infernalist",     icon: "💀", tier: "A", tags: ["Безопасный", "Армия"],    roles: ["Лигостарт"],                    budget: "Бомж",    diff: 1 },
  { name: "Hammer of the Gods",       asc: "Warrior · Warbringer",    icon: "🔨", tier: "A", tags: ["Боссинг", "Танк"],        roles: ["Боссинг"],                      budget: "Средний", diff: 2 },
  { name: "Ice Strike Invoker",       asc: "Monk · Invoker",          icon: "❄️", tier: "A", tags: ["ДПС", "Скилловый"],       roles: ["Боссинг", "Фарм"],              budget: "Средний", diff: 3 },
  { name: "Galvanic Shards Hunter",   asc: "Mercenary · Witchhunter", icon: "🔫", tier: "B", tags: ["Кроссбоу", "Дёшево"],     roles: ["Лигостарт", "Фарм"],            budget: "Бомж",    diff: 2 },
  { name: "Comet Chronomancer",       asc: "Sorceress · Chronomancer",icon: "☄️", tier: "B", tags: ["Бурст", "Боссинг"],       roles: ["Боссинг"],                      budget: "Богатый", diff: 3 },
];

const ASC_META = [
  { name: "Amazon",      cls: "Huntress",  pct: 18.2, delta:  6.4 },
  { name: "Stormweaver", cls: "Sorceress", pct: 13.5, delta: -1.2 },
  { name: "Deadeye",     cls: "Ranger",    pct: 10.8, delta:  0.5 },
  { name: "Invoker",     cls: "Monk",      pct:  9.1, delta: -2.0 },
  { name: "Witchhunter", cls: "Mercenary", pct:  7.6, delta:  1.1 },
  { name: "Infernalist", cls: "Witch",     pct:  7.0, delta: -0.8 },
  { name: "Titan",       cls: "Warrior",   pct:  6.2, delta:  0.3 },
];

const CURRENCY = [
  { name: "Mirror of Kalandra", orb: "🪞", price: "168 000", delta:  3.1, spark: [120,124,121,130,135,150,162,168] },
  { name: "Divine Orb",         orb: "🟡", price: "215",     delta:  8.4, spark: [180,178,185,190,188,200,210,215] },
  { name: "Chaos Orb",          orb: "🟠", price: "9.4",     delta: -2.3, spark: [12,11.5,11,10.4,10,9.8,9.6,9.4] },
  { name: "Annulment Orb",      orb: "🔵", price: "6.1",     delta:  1.2, spark: [5.6,5.7,5.9,5.8,6.0,6.0,6.05,6.1] },
  { name: "Vaal Orb",           orb: "🟣", price: "1.8",     delta:  0.6, spark: [1.7,1.72,1.75,1.74,1.78,1.79,1.8,1.8] },
  { name: "Exalted Orb",        orb: "⚪", price: "1.00",    delta:  0.0, spark: [1,1,1,1,1,1,1,1] },
];

const FEED = [
  { type:"video", lang:"en", isNew:true, featured:true,
    title:"Top 10 Builds to League Start in 0.5 — Path of Exile 2", channel:"Fubgun",
    duration:"8:12", views:"418k", time:"свежее", thumb:"⚔️", grad:"thumb-grad-1",
    url:"https://youtu.be/SAOsK-0Aa2U",
    digest:{
      tldr:"Топ-10 стартовых билдов 0.5 для обычного игрока (первая неделя, ~40–50 ч). Список не отранжирован, но первые 6 сильнее остальных. Все проходят кампанию и бьют квестовых пинакл-боссов на SSF-шмоте.",
      signals:[
        { t:"Тотемы: нерф",                       k:"down" },
        { t:"Миньоны: +25% урона",                k:"up"   },
        { t:"Твистеры / гранаты / арбалет: без нерфов", k:"ok" },
        { t:"Друид-медведь: лёгкий нерф",         k:"down" },
      ],
      builds:["Ice Shot Deadeye","Twisters Deadeye","Гранаты/Арбалет Tactician","Martial Artist","Lich","Disciple of Varashta","Тотемы","Shield Wall Warrior","Bear Druid","Spark-каст"],
      tags:["лигостарт","тир-лист","0.5","новичкам"],
    } },
  { type:"video",  lang:"en", isNew:true,  title:"Best League Start Builds for 0.2 — Full Tier List", channel:"Zizaran",            duration:"18:24", time:"2 ч назад",  thumb:"⚔️", grad:"thumb-grad-1" },
  { type:"news",   lang:"en", isNew:true,  title:"0.2.1 Patch Notes — Balance Changes & Bug Fixes",   source:"pathofexile.com",     snippet:"Правки копейных умений Amazon, плотность монстров на картах, фиксы вылетов…", time:"5 ч назад" },
  { type:"video",  lang:"ru", isNew:true,  title:"ТОП-5 билдов на старт лиги PoE2 — что качать новичку", channel:"Канал «Изгнанник»", duration:"22:10", time:"3 ч назад",  thumb:"🏹", grad:"thumb-grad-2" },
  { type:"video",  lang:"ru", isNew:true,  title:"Разбор патча 0.2.1 за 10 минут",                    channel:"Канал «Поэзия»",     duration:"11:32", time:"6 ч назад",  thumb:"🛠️", grad:"thumb-grad-2" },
  { type:"reddit", lang:"en", isNew:false, title:"PSA: ранний вендор-рецепт на сопротивления, который все пропускают", source:"r/PathOfExile2", ups:"1.2k", time:"8 ч назад" },
  { type:"video",  lang:"en", isNew:false, title:"Gas Arrow Pathfinder — Mapping Guide + PoB",        channel:"Subtractem",         duration:"31:40", time:"1 дн назад", thumb:"🎯", grad:"thumb-grad-1" },
  { type:"news",   lang:"en", isNew:false, title:"Срез экономики: Divine Orb взлетел после патча",     source:"poe.ninja",           snippet:"Divine +8% за сутки — вернулся спрос на крафт. Exalted стабилен…", time:"1 дн назад" },
  { type:"reddit", lang:"ru", isNew:false, title:"Гайд: как фармить экзальты на старте без вложений",  source:"r/pathofexile",       ups:"342",  time:"1 дн назад" },
  { type:"video",  lang:"en", isNew:false, title:"Endgame & Atlas Progression Explained for Beginners",channel:"CaptainLance",       duration:"24:05", time:"2 дн назад", thumb:"🗺️", grad:"thumb-grad-3" },
];

/* ---------------- HELPERS ---------------- */

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));

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
  ? `<img class="thumb-img" src="${i.thumb_url}" alt="" loading="lazy" onerror="this.style.display='none'">`
  : `<span class="thumb-emoji">${i.thumb || "🎬"}</span>`;

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
    <div class="build-icon">${esc(b.icon || "⚔️")}</div>
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
    <div class="build-icon">${b.icon}</div>
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
  const max = Math.max(...ascData.map(a => a.pct));
  $("#ascMeta").innerHTML = ascData.map(a => `
    <li class="bar-row">
      <span class="bar-name">${esc(a.name)}${a.cls ? ` <small>${esc(a.cls)}</small>` : ""}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${(a.pct / max * 100).toFixed(0)}%"></span></span>
      <span class="bar-meta"><span class="bar-pct">${a.pct}%</span>${a.delta != null ? deltaHtml(a.delta) : trendHtml(a.trend)}</span>
    </li>`).join("");
}

function renderEconomy() {
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
  $("#feedGrid").innerHTML = items.length
    ? items.map(feedCard).join("")
    : `<p class="section-note">Под выбранные фильтры записей нет.</p>`;
}

function feedCard(i) {
  const langPill = `<span class="lang-pill ${i.lang}">${i.lang.toUpperCase()}</span>`;
  const newClass = i.isNew ? " is-new" : "";

  if (i.featured && i.digest) return featuredCard(i);

  if (i.type === "video") {
    return `<article class="feed-card${newClass}">
      <div class="thumb ${i.grad || ""}">
        ${thumbMedia(i)}
        <span class="play"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>
        ${i.duration ? `<span class="duration">${esc(i.duration)}</span>` : ""}
      </div>
      <div class="feed-body">
        <div class="feed-src"><span class="src-badge src-yt">▶</span><span class="src-name">${esc(i.channel)}</span>${langPill}</div>
        <h3 class="feed-title">${esc(i.title)}</h3>
        ${i.digest ? digestMini(i.digest) : ""}
        <div class="feed-meta"><span>${i.views != null && i.views !== "" ? fmtViews(i.views) + " просмотров" : "YouTube"}</span><span>${esc(i.time)}</span></div>
      </div>
    </article>`;
  }

  if (i.type === "reddit") {
    return `<article class="feed-card${newClass}">
      <div class="feed-body">
        <div class="feed-src"><span class="src-badge src-reddit">r/</span><span class="src-name">${esc(i.source)}</span>${langPill}</div>
        <h3 class="feed-title">${esc(i.title)}</h3>
        <div class="feed-meta"><span class="up">${i.ups ? "▲ " + esc(i.ups) : "обсуждение"}</span><span>${esc(i.time)}</span></div>
      </div>
    </article>`;
  }

  // news
  return `<article class="feed-card${newClass}">
    <div class="feed-body">
      <div class="feed-src"><span class="src-badge src-news">📰</span><span class="src-name">${esc(i.source)}</span>${langPill}</div>
      <h3 class="feed-title">${esc(i.title)}</h3>
      <p class="feed-snippet">${esc(i.snippet)}</p>
      <div class="feed-meta"><span>Новость</span><span>${esc(i.time)}</span></div>
    </div>
  </article>`;
}

function featuredCard(i) {
  const d = i.digest;
  const signals = (d.signals || []).map(s => `<span class="signal ${s.k}">${esc(s.t)}</span>`).join("");
  const builds  = (d.builds  || []).map(b => `<span class="build-chip">${esc(b)}</span>`).join("");
  const points  = (d.points  || []).map(p => `<li>${esc(p)}</li>`).join("");
  const sBlock = signals ? `<div class="digest-block"><span class="digest-row-label">🆕 Сигналы патча</span><div class="signals">${signals}</div></div>` : "";
  const bBlock = builds  ? `<div class="digest-block"><span class="digest-row-label">Билды</span><div class="build-chips">${builds}</div></div>` : "";
  const pBlock = points  ? `<div class="digest-block"><span class="digest-row-label">Главное</span><ul class="digest-points">${points}</ul></div>` : "";
  return `<article class="feed-card featured is-new">
    <div class="thumb ${i.grad || ""}">
      ${thumbMedia(i)}
      <span class="play"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>
      ${i.duration ? `<span class="duration">${esc(i.duration)}</span>` : ""}
    </div>
    <div class="feed-body">
      <div class="feed-src">
        <span class="src-badge src-yt">▶</span>
        <span class="src-name">${esc(i.channel)}</span>
        ${i.views != null ? `<span class="src-name">· ${fmtViews(i.views)} просмотров</span>` : ""}
        <span class="lang-pill ${i.lang || "en"}">${(i.lang || "en").toUpperCase()}</span>
      </div>
      <h3 class="feed-title">${esc(i.title)}</h3>
      <div class="digest">
        <div class="digest-label">✨ AI-дайджест из видео</div>
        <p class="digest-tldr">${esc(d.tldr)}</p>
        ${pBlock}${sBlock}${bBlock}
      </div>
    </div>
  </article>`;
}

function digestMini(d) {
  const pts  = (d.points || []).slice(0, 3).map(p => `<li>${esc(p)}</li>`).join("");
  const tags = (d.tags   || []).slice(0, 4).map(t => `<span class="mini-tag">${esc(t)}</span>`).join("");
  return `<div class="digest-mini">
    <span class="digest-mini-label">✨ AI-дайджест</span>
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
      $$(".chip", group).forEach(c => c.classList.remove("is-active"));
      chip.classList.add("is-active");
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
    <h3 class="article-title">${a.promote ? "⭐ " : ""}${esc(a.title)}</h3>
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
      ${link(c.youtube_url, "▶ YouTube")}${link(tg, "✈ Telegram")}${link(tw, "🎮 Twitch")}${link(c.website, "🔗 Сайт")}
    </div>
  </article>`;
}

async function init() {
  await Promise.all([loadFeed(), loadMeta(), loadBuilds(), loadSiteArticles(), loadSiteCreators()]);
  renderTierlist();
  renderAscMeta();
  renderEconomy();
  renderFeed();

  // build filters
  wireChipGroup($("#buildFilters"), (key, val) => {
    buildState[key] = val;
    renderTierlist();
  });

  // feed type tabs
  $("#feedTabs").addEventListener("click", e => {
    const tab = e.target.closest(".tab");
    if (!tab) return;
    $$(".tab", $("#feedTabs")).forEach(t => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    feedState.type = tab.dataset.type;
    renderFeed();
  });

  // language toggle (filters the feed)
  $("#langToggle").addEventListener("click", e => {
    const btn = e.target.closest(".lang-btn");
    if (!btn) return;
    $$(".lang-btn", $("#langToggle")).forEach(b => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    feedState.lang = btn.dataset.lang;
    renderFeed();
  });

  // mobile nav
  const burger = $("#burger"), nav = $("#nav");
  burger.addEventListener("click", () => nav.classList.toggle("open"));
  nav.addEventListener("click", e => { if (e.target.tagName === "A") nav.classList.remove("open"); });
}

document.addEventListener("DOMContentLoaded", init);
