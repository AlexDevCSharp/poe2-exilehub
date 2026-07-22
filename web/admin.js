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
    setStatus(`Готово · всего ${c.all} · новых ${c.new} · одобрено ${c.approved} · скрыто ${c.hidden} · лига ${data.meta.league}`, "ok");
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
  const meta = [it.channel || it.source, it.views != null ? fmtViews(it.views) + " просм." : null, it.duration, it.lang.toUpperCase(), it.manual ? "ручная" : null]
    .filter(Boolean).map(esc).join(" · ");
  const digestLine = d.tldr ? `<div class="a-digest">✨ ${esc(d.tldr)}</div>` : "";

  return `<article class="a-item ${it.pinned ? "pinned" : ""} ${it.status === "hidden" ? "hidden" : ""}" data-id="${esc(it.id)}">
    <div class="a-thumb">${thumb}</div>
    <div class="a-body">
      <div class="a-top">
        <div style="flex:1;min-width:0">
          <div class="a-title">${esc(it.title)}</div>
          <div class="a-meta"><span class="a-badge b-type">${esc(it.type)}</span>${statusBadge}${pinBadge}${tgBadge}<span>${meta}</span>${it.url ? `<a href="${esc(it.url)}" target="_blank" rel="noopener" style="color:var(--gold)">открыть ↗</a>` : ""}</div>
        </div>
      </div>
      ${digestLine}
      <div class="a-actions">
        <button class="a-btn on-approve" data-act="approve">✓ Одобрить</button>
        <button class="a-btn on-hide" data-act="hide">🚫 Скрыть</button>
        <button class="a-btn ${it.pinned ? "active" : ""}" data-act="pin">📌 ${it.pinned ? "Закреплено" : "Закрепить"}</button>
        <button class="a-btn" data-act="edit">✎ Правка</button>
        <button class="a-btn ${it.tg_posted ? "active" : ""}" data-act="tg">📤 ${it.tg_posted ? "В TG ✓" : "В Telegram"}</button>
        <button class="a-btn on-del" data-act="del">🗑 Удалить</button>
      </div>
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
      if (!confirm("Удалить запись безвозвратно?")) return;
      await api("DELETE", `/api/admin/item/${encodeURIComponent(id)}`);
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
  $("#btnAdd").addEventListener("click", () => $("#addForm").classList.toggle("hidden"));
  $("#f-cancel").addEventListener("click", () => $("#addForm").classList.add("hidden"));
  $("#f-save").addEventListener("click", addManual);
  loadItems();
}

document.addEventListener("DOMContentLoaded", init);
