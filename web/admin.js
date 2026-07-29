/* EXILE HUB — admin panel logic (talks to /api/admin/*) */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const state = { status: "all" };

function setStatus(msg, cls = "") {
  const el = $("#status");
  el.textContent = msg;
  el.className = "container admin-status " + cls;
}

async function api(method, url, body) {
  const opt = { method, headers: { "Content-Type": "application/json" } };
  if (body !== undefined) opt.body = JSON.stringify(body);
  const res = await fetch(url, opt);
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status}`);
  return res.json();
}

/* ---------- load + render ---------- */

async function loadItems() {
  setStatus("Загрузка…", "busy");
  try {
    const data = await api("GET", `/api/admin/items?status=${state.status}`);
    render(data);
    const c = data.counts;
    setStatus(`Готово · всего ${c.all} · новых ${c.new} · одобрено ${c.approved} · скрыто ${c.hidden} · удалено ${c.deleted} · лига ${data.meta.league}`, "ok");
  } catch (e) {
    setStatus("Ошибка загрузки: " + e.message + " — запущен ли бэкенд на :8000?", "err");
  }
}

function render(data) {
  $$("#statusTabs .chip").forEach(c => c.classList.toggle("is-active", c.dataset.status === state.status));
  $("#count").textContent = `${data.items.length} записей`;
  const list = $("#adminList");
  if (!data.items.length) { list.innerHTML = `<p class="empty">Пусто. Прогони пайплайн или добавь запись вручную.</p>`; return; }
  list.innerHTML = data.items.map(itemHtml).join("");
}

function itemHtml(it) {
  const d = it.digest || {};
  const thumb = it.thumb_url
    ? `<img src="${esc(it.thumb_url)}" alt="" loading="lazy" onerror="this.style.display='none'">`
    : `<span class="ph">${it.type === "video" ? "🎬" : it.type === "reddit" ? "💬" : "📰"}</span>`;
  const statusBadge = `<span class="a-badge b-${it.status}">${it.status}</span>`;
  const pinBadge = it.pinned ? `<span class="a-badge b-pin">📌 pin</span>` : "";
  const tgBadge = it.tg_posted ? `<span class="a-badge b-tg">📤 в TG</span>` : "";
  const anaBadge = it.analyzed ? `<span class="a-badge" style="color:var(--green);border-color:rgba(116,196,122,.4)">✓ разобрано</span>` : "";
  const actions = it.status === "deleted"
    ? `<button class="a-btn on-approve" data-act="restore">↩ Восстановить</button>
       <button class="a-btn on-del" data-act="harddel">🗑 Стереть навсегда</button>`
    : `<button class="a-btn on-approve" data-act="approve">✓ Одобрить</button>
       <button class="a-btn on-hide" data-act="hide">🚫 Скрыть</button>
       <button class="a-btn ${it.pinned ? "active" : ""}" data-act="pin">📌 ${it.pinned ? "Закреплено" : "Закрепить"}</button>
       <button class="a-btn" data-act="edit">✎ Правка</button>
       <button class="a-btn ${it.tg_posted ? "active" : ""}" data-act="tg">📤 ${it.tg_posted ? "В TG ✓" : "В Telegram"}</button>
       <button class="a-btn on-del" data-act="del">🗑 Удалить</button>`;
  const meta = [it.channel || it.source, it.views != null ? fmtViews(it.views) + " просм." : null, it.duration, it.lang.toUpperCase(), it.manual ? "ручная" : null]
    .filter(Boolean).map(esc).join(" · ");
  const digestLine = d.tldr ? `<div class="a-digest">✨ ${esc(d.tldr)}</div>` : "";

  return `<article class="a-item ${it.pinned ? "pinned" : ""} ${it.status === "hidden" ? "hidden" : ""}" data-id="${esc(it.id)}">
    <div class="a-thumb">${thumb}</div>
    <div class="a-body">
      <div class="a-top">
        <div style="flex:1;min-width:0">
          <div class="a-title">${esc(it.title)}</div>
          <div class="a-meta"><span class="a-badge b-type">${esc(it.type)}</span>${statusBadge}${pinBadge}${tgBadge}${anaBadge}<span>${meta}</span>${it.url ? `<a href="${esc(it.url)}" target="_blank" rel="noopener" style="color:var(--gold)">открыть ↗</a>` : ""}</div>
        </div>
      </div>
      ${digestLine}
      <div class="a-actions">${actions}</div>
      <div class="a-editor">
        <label>Заголовок<input data-f="title" value="${esc(it.title)}"></label>
        <label>TL;DR (дайджест)<textarea data-f="tldr">${esc(d.tldr || "")}</textarea></label>
        <label>Тезисы — по одному на строку<textarea data-f="points">${esc((d.points || []).join("\n"))}</textarea></label>
        <label>Теги — через запятую<input data-f="tags" value="${esc((d.tags || []).join(", "))}"></label>
        <div class="a-actions">
          <button class="a-btn active" data-act="save">💾 Сохранить</button>
          <button class="a-btn" data-act="edit">Свернуть</button>
        </div>
      </div>
      <div class="tg-panel">
        <label>Пост в Telegram <span class="tg-hint"></span>
          <textarea data-f="tgtext" rows="8"></textarea>
        </label>
        <div class="a-actions">
          <button class="a-btn active" data-act="tg-send">📤 Отправить</button>
          <button class="a-btn" data-act="tg-cancel">Отмена</button>
        </div>
      </div>
    </div>
  </article>`;
}

const fmtViews = (n) => typeof n === "number"
  ? (n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M" : n >= 1e3 ? Math.round(n / 1e3) + "k" : "" + n) : "";

/* ---------- actions ---------- */

async function itemAction(id, act, card) {
  try {
    if (act === "approve") await api("POST", `/api/admin/item/${encodeURIComponent(id)}`, { status: "approved" });
    else if (act === "hide") await api("POST", `/api/admin/item/${encodeURIComponent(id)}`, { status: "hidden" });
    else if (act === "pin") {
      const pinned = !card.classList.contains("pinned");
      await api("POST", `/api/admin/item/${encodeURIComponent(id)}`, { pinned });
    } else if (act === "del") {
      await api("DELETE", `/api/admin/item/${encodeURIComponent(id)}`);   // soft: goes to «Удалено», restorable
    } else if (act === "restore") {
      await api("POST", `/api/admin/item/${encodeURIComponent(id)}`, { status: "new" });
    } else if (act === "harddel") {
      if (!confirm("Стереть НАВСЕГДА? Запись исчезнет из базы без возможности вернуть.")) return;
      await api("DELETE", `/api/admin/item/${encodeURIComponent(id)}?hard=true`);
    } else if (act === "edit") {
      card.querySelector(".a-editor").classList.toggle("open");
      return;
    } else if (act === "save") {
      const get = (f) => card.querySelector(`[data-f="${f}"]`).value;
      const points = get("points").split("\n").map(s => s.trim()).filter(Boolean);
      const tags = get("tags").split(",").map(s => s.trim()).filter(Boolean);
      await api("POST", `/api/admin/item/${encodeURIComponent(id)}`, {
        title: get("title"), digest: { tldr: get("tldr"), points, tags },
      });
    } else if (act === "tg") {
      const panel = card.querySelector(".tg-panel");
      if (!panel.classList.contains("open")) {
        const r = await api("POST", "/api/telegram/preview", { item_id: id });
        card.querySelector('[data-f="tgtext"]').value = r.text;
        card.querySelector(".tg-hint").textContent = r.configured
          ? "— бот настроен, уйдёт в канал" : "— DRY-RUN: нет токена, пост сформируется, но не отправится";
      }
      panel.classList.toggle("open");
      return;
    } else if (act === "tg-cancel") {
      card.querySelector(".tg-panel").classList.remove("open");
      return;
    } else if (act === "tg-send") {
      const text = card.querySelector('[data-f="tgtext"]').value;
      const r = await api("POST", "/api/telegram/send", { item_id: id, text });
      if (r.dry_run) {
        setStatus("DRY-RUN: пост сформирован, но не отправлен (" + (r.reason || "нет токена") + ").", "busy");
        return;
      }
      setStatus(r.ok ? "Отправлено в Telegram ✓" : "Ошибка TG: " + (r.error || ""), r.ok ? "ok" : "err");
    }
    await loadItems();
  } catch (e) {
    setStatus("Ошибка: " + e.message, "err");
  }
}

/* ---------- top bar ---------- */

async function runPipeline() {
  if (!confirm("Прогнать пайплайн? Это сходит в YouTube/Reddit и займёт до минуты.")) return;
  setStatus("Пайплайн работает…", "busy");
  try {
    const r = await api("POST", "/api/refresh");
    setStatus(r.ok ? "Пайплайн завершён." : "Пайплайн вернул ошибку (см. консоль).", r.ok ? "ok" : "err");
    if (!r.ok) console.warn(r.log);
    await loadItems();
  } catch (e) { setStatus("Ошибка пайплайна: " + e.message, "err"); }
}

async function publish() {
  setStatus("Публикация…", "busy");
  try {
    const r = await api("POST", "/api/admin/publish");
    setStatus(`Опубликовано на сайт: ${r.items} записей (web/data/feed.json).`, "ok");
  } catch (e) { setStatus("Ошибка публикации: " + e.message, "err"); }
}

async function addManual() {
  const v = (id) => $(id).value.trim();
  const payload = {
    type: v("#f-type"), lang: v("#f-lang"), title: v("#f-title"),
    url: v("#f-url"), thumb_url: v("#f-thumb"), snippet: v("#f-snippet"), status: "approved",
  };
  if (!payload.title) { setStatus("Заголовок обязателен.", "err"); return; }
  const tldr = v("#f-tldr");
  if (tldr) payload.digest = { tldr };
  try {
    await api("POST", "/api/admin/add", payload);
    ["#f-title", "#f-url", "#f-thumb", "#f-snippet", "#f-tldr"].forEach(id => $(id).value = "");
    $("#addForm").classList.add("hidden");
    setStatus("Запись добавлена.", "ok");
    await loadItems();
  } catch (e) { setStatus("Ошибка добавления: " + e.message, "err"); }
}

/* ---------- search ---------- */

let SEARCH_RESULTS = [];
const fmtDate = (ymd) => ymd && ymd.length === 8 ? `${ymd.slice(6, 8)}.${ymd.slice(4, 6)}.${ymd.slice(0, 4)}` : "";

async function runSearch() {
  const val = (id) => $(id).value.trim();
  const payload = {
    query: val("#s-query"), author: val("#s-author"), period: $("#s-period").value,
    date_from: val("#s-from"), date_to: val("#s-to"),
    min_views: Number(val("#s-minviews")) || 0, sort: $("#s-sort").value,
    lang: $("#s-lang").value, only_poe2: $("#s-poe2").checked, limit: Number(val("#s-limit")) || 15,
  };
  $("#s-status").textContent = "Ищу… (при фильтре по дате — до минуты)";
  $("#searchResults").innerHTML = "";
  $("#s-addbar").classList.add("hidden");
  try {
    const r = await api("POST", "/api/admin/search", payload);
    if (!r.ok) { $("#s-status").textContent = "Ошибка: " + (r.error || "поиск не удался"); return; }
    SEARCH_RESULTS = r.results;
    $("#s-status").textContent = `Найдено: ${r.count}`;
    renderSearchResults(r.results);
    if (r.results.length) $("#s-addbar").classList.remove("hidden");
  } catch (e) { $("#s-status").textContent = "Ошибка: " + e.message; }
}

function renderSearchResults(results) {
  if (!results.length) { $("#searchResults").innerHTML = `<p style="color:var(--faint)">Ничего не найдено — ослабь фильтры.</p>`; return; }
  $("#searchResults").innerHTML = results.map((r, i) => {
    const tag = r.analyzed ? `<span style="color:var(--green);font-size:11px">✓ уже разобрано</span>`
      : r.known ? `<span style="color:var(--faint);font-size:11px">уже в базе</span>` : "";
    return `<label class="sr-row">
      <input type="checkbox" class="sr-check" data-i="${i}" ${r.analyzed ? "" : "checked"} />
      <img src="${esc(r.thumb_url)}" class="sr-thumb" alt="" loading="lazy" onerror="this.style.visibility='hidden'" />
      <div class="sr-body">
        <div class="sr-title">${esc(r.title)} ${tag}</div>
        <div class="sr-meta">${esc(r.channel)}${r.views != null ? " · " + fmtViews(r.views) + " просм." : ""}${r.upload_date ? " · " + fmtDate(r.upload_date) : ""} · <a href="${esc(r.url)}" target="_blank" rel="noopener" style="color:var(--gold)">открыть ↗</a></div>
      </div>
    </label>`;
  }).join("");
}

async function addSearchSelected() {
  const items = [...document.querySelectorAll(".sr-check:checked")].map(c => SEARCH_RESULTS[Number(c.dataset.i)]).filter(Boolean);
  if (!items.length) { $("#s-status").textContent = "Ничего не выбрано."; return; }
  $("#s-status").textContent = `Добавляю ${items.length}… (дайджест — если подключён ключ)`;
  try {
    const r = await api("POST", "/api/admin/search/add", { items, analyze: true });
    $("#s-status").textContent = `Добавлено: ${r.added}, дайджестов: ${r.digested}. Смотри в очереди ниже.`;
    await loadItems();
  } catch (e) { $("#s-status").textContent = "Ошибка: " + e.message; }
}

/* ---------- creators (bloggers/streamers) ---------- */

const SOCIALS = [
  ["youtube_url", "YouTube URL"], ["handle", "Handle @"], ["telegram", "Telegram"], ["twitch", "Twitch"],
  ["twitter", "X / Twitter"], ["discord", "Discord"], ["website", "Сайт"], ["lang", "Язык"],
];
const tgUrl = (t) => t.startsWith("http") ? t : "https://t.me/" + t.replace(/^@/, "");
const twUrl = (t) => t.startsWith("http") ? t : "https://twitch.tv/" + t.replace(/^@/, "");

async function loadCreators() {
  try {
    const d = await api("GET", "/api/admin/creators");
    $("#cr-count").textContent = `(${d.creators.length})`;
    renderCreators(d.creators);
  } catch (e) { $("#creatorsList").innerHTML = `<p style="color:var(--red)">Ошибка: ${esc(e.message)}</p>`; }
}

function renderCreators(list) {
  if (!list.length) { $("#creatorsList").innerHTML = `<p style="color:var(--faint)">Пусто. Прогони поиск/пайплайн — авторы заведутся сами.</p>`; return; }
  const chips = (c) => [
    c.youtube_url && `<a href="${esc(c.youtube_url)}" target="_blank" rel="noopener">YT</a>`,
    c.telegram && `<a href="${esc(tgUrl(c.telegram))}" target="_blank" rel="noopener">TG</a>`,
    c.twitch && `<a href="${esc(twUrl(c.twitch))}" target="_blank" rel="noopener">Twitch</a>`,
  ].filter(Boolean).join(" · ");
  $("#creatorsList").innerHTML = list.map(c => `
    <div class="cr-row" data-id="${c.id}">
      <div class="cr-head">
        <span class="cr-name">${c.promote ? "⭐ " : ""}${esc(c.name)}</span>
        <span class="cr-meta">${c.videos} видео${chips(c) ? " · " + chips(c) : ""}</span>
        <button class="a-btn" data-cr-act="edit">✎ Правка</button>
      </div>
      <div class="cr-editor">
        ${SOCIALS.map(([f, lbl]) => `<label>${lbl}<input data-cf="${f}" value="${esc(c[f] || "")}"></label>`).join("")}
        <label>Приоритет<input data-cf="priority" type="number" value="${c.priority || 0}"></label>
        <label>Статус<select data-cf="status">${["active", "archived", "blocked"].map(s => `<option ${c.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>
        <label class="full">Заметки<textarea data-cf="notes">${esc(c.notes || "")}</textarea></label>
        <label class="full" style="flex-direction:row;align-items:center;gap:8px"><input data-cf="promote" type="checkbox" ${c.promote ? "checked" : ""} style="width:auto"> ⭐ Продвигаем этого автора</label>
        <div class="full"><button class="a-btn active" data-cr-act="save">💾 Сохранить</button></div>
      </div>
    </div>`).join("");
}

async function saveCreator(id, row) {
  const fields = {};
  row.querySelectorAll("[data-cf]").forEach(el => {
    fields[el.dataset.cf] = el.type === "checkbox" ? el.checked : el.type === "number" ? Number(el.value) : el.value.trim();
  });
  try {
    await api("POST", `/api/admin/creator/${id}`, fields);
    setStatus("Автор сохранён.", "ok");
    await loadCreators();
  } catch (e) { setStatus("Ошибка: " + e.message, "err"); }
}

/* ---------- articles ---------- */

const AR_STATUS = ["draft", "published", "outdated", "archived"];

async function loadArticles() {
  try {
    const d = await api("GET", "/api/admin/articles");
    $("#ar-count").textContent = `(${d.counts.all} · опубл. ${d.counts.published})`;
    renderArticles(d.articles);
  } catch (e) { $("#articlesList").innerHTML = `<p style="color:var(--red)">Ошибка: ${esc(e.message)}</p>`; }
}

function renderArticles(list) {
  if (!list.length) { $("#articlesList").innerHTML = `<p style="color:var(--faint)">Пусто. Нажми «✚ Новая статья».</p>`; return; }
  $("#articlesList").innerHTML = list.map(a => `
    <div class="cr-row" data-id="${a.id}">
      <div class="cr-head">
        <span class="cr-name">${a.promote ? "⭐ " : ""}${esc(a.title || "(без названия)")}</span>
        <span class="cr-meta"><span class="ar-status" style="color:${a.status === "published" ? "var(--green)" : "var(--faint)"}">${esc(a.status)}</span> · ${esc(a.lang)}</span>
        <button class="a-btn" data-ar-act="edit">✎ Правка</button>
      </div>
      <div class="cr-editor">
        <label class="full">Заголовок<input data-af="title" value="${esc(a.title || "")}"></label>
        <label class="full">Краткое описание<input data-af="summary" value="${esc(a.summary || "")}"></label>
        <label class="full">Текст статьи<textarea data-af="body" class="ar-body-input">${esc(a.body || "")}</textarea></label>
        <label>Язык<select data-af="lang">${["ru", "en"].map(l => `<option ${a.lang === l ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <label>Статус<select data-af="status">${AR_STATUS.map(s => `<option ${a.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>
        <label>Приоритет<input data-af="priority" type="number" value="${a.priority || 0}"></label>
        <label class="full" style="flex-direction:row;align-items:center;gap:8px"><input data-af="promote" type="checkbox" ${a.promote ? "checked" : ""} style="width:auto"> ⭐ Продвигать статью</label>
        <div class="full" style="display:flex;gap:8px">
          <button class="a-btn active" data-ar-act="save">💾 Сохранить</button>
          <button class="a-btn on-del" data-ar-act="del">🗑 Удалить</button>
        </div>
      </div>
    </div>`).join("");
}

async function saveArticle(id, row) {
  const fields = {};
  row.querySelectorAll("[data-af]").forEach(el => {
    fields[el.dataset.af] = el.type === "checkbox" ? el.checked : el.type === "number" ? Number(el.value) : el.value;
  });
  try { await api("POST", `/api/admin/article/${id}`, fields); setStatus("Статья сохранена.", "ok"); await loadArticles(); }
  catch (e) { setStatus("Ошибка: " + e.message, "err"); }
}

async function newArticle() {
  try {
    const r = await api("POST", "/api/admin/articles", { title: "Новая статья", status: "draft", lang: "ru" });
    await loadArticles();
    const row = document.querySelector(`#articlesList .cr-row[data-id="${r.id}"]`);
    if (row) row.querySelector(".cr-editor").classList.add("open");
    setStatus("Создан черновик — заполни и сохрани.", "ok");
  } catch (e) { setStatus("Ошибка: " + e.message, "err"); }
}

async function deleteArticle(id) {
  try { await api("DELETE", `/api/admin/article/${id}`); setStatus("Статья убрана в удалённые.", "ok"); await loadArticles(); }
  catch (e) { setStatus("Ошибка: " + e.message, "err"); }
}

async function publishArticles() {
  try { const r = await api("POST", "/api/admin/articles/publish"); setStatus(`Опубликовано статей на сайт: ${r.published} (articles.json).`, "ok"); }
  catch (e) { setStatus("Ошибка: " + e.message, "err"); }
}

/* ---------- wire ---------- */

function init() {
  $("#adminList").addEventListener("click", e => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const card = e.target.closest(".a-item");
    itemAction(card.dataset.id, btn.dataset.act, card);
  });
  $("#statusTabs").addEventListener("click", e => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    state.status = chip.dataset.status;
    loadItems();
  });
  $("#btnRefresh").addEventListener("click", runPipeline);
  $("#btnPublish").addEventListener("click", publish);
  $("#btnBackup").addEventListener("click", async () => {
    try { const r = await api("POST", "/api/admin/backup"); setStatus(`💾 Бэкап создан: data/backups/${r.file}`, "ok"); }
    catch (e) { setStatus("Ошибка бэкапа: " + e.message, "err"); }
  });
  $("#btnAdd").addEventListener("click", () => $("#addForm").classList.toggle("hidden"));
  $("#f-cancel").addEventListener("click", () => $("#addForm").classList.add("hidden"));
  $("#f-save").addEventListener("click", addManual);

  // search
  $("#btnSearch").addEventListener("click", () => $("#searchPanel").classList.toggle("hidden"));
  $("#s-close").addEventListener("click", () => $("#searchPanel").classList.add("hidden"));
  $("#s-period").addEventListener("change", e => {
    const range = e.target.value === "range";
    $("#s-from-wrap").classList.toggle("hidden", !range);
    $("#s-to-wrap").classList.toggle("hidden", !range);
  });
  $("#s-run").addEventListener("click", runSearch);
  $("#s-add").addEventListener("click", addSearchSelected);

  // creators
  $("#btnCreators").addEventListener("click", () => {
    const p = $("#creatorsPanel");
    p.classList.toggle("hidden");
    if (!p.classList.contains("hidden")) loadCreators();
  });
  $("#cr-backfill").addEventListener("click", async () => {
    try { const r = await api("POST", "/api/admin/creators/backfill"); setStatus(`Привязано видео: ${r.linked}`, "ok"); loadCreators(); }
    catch (e) { setStatus("Ошибка: " + e.message, "err"); }
  });
  $("#creatorsList").addEventListener("click", e => {
    const btn = e.target.closest("[data-cr-act]");
    if (!btn) return;
    const row = e.target.closest(".cr-row");
    if (btn.dataset.crAct === "edit") row.querySelector(".cr-editor").classList.toggle("open");
    else if (btn.dataset.crAct === "save") saveCreator(row.dataset.id, row);
  });

  // articles
  $("#btnArticles").addEventListener("click", () => {
    const p = $("#articlesPanel");
    p.classList.toggle("hidden");
    if (!p.classList.contains("hidden")) loadArticles();
  });
  $("#ar-new").addEventListener("click", newArticle);
  $("#ar-publish").addEventListener("click", publishArticles);
  $("#articlesList").addEventListener("click", e => {
    const btn = e.target.closest("[data-ar-act]");
    if (!btn) return;
    const row = e.target.closest(".cr-row");
    if (btn.dataset.arAct === "edit") row.querySelector(".cr-editor").classList.toggle("open");
    else if (btn.dataset.arAct === "save") saveArticle(row.dataset.id, row);
    else if (btn.dataset.arAct === "del") deleteArticle(row.dataset.id);
  });

  loadItems();
}

document.addEventListener("DOMContentLoaded", init);
