(function () {
  var PRIO = { 1: "높음", 2: "중간", 3: "낮음" };
  var DEFAULT_TABS = [
    { key: "resume", label: "이력서", icon: 0, order: 0, hidden: false },
    { key: "career", label: "기술경력서", icon: 1, order: 1, hidden: false },
    { key: "portfolio", label: "포트폴리오", icon: 2, order: 2, hidden: false },
    { key: "prep", label: "취업", icon: 3, order: 3, hidden: false }
  ];
  var TABS = DEFAULT_TABS.slice();
  var catDocs = null, rawTodos = [];
  var ICONS = [
    '<path d="M6 3h5.5L15 6.5V16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M11 3v4h4"/>',
    '<path d="M7 5.5h10M7 10h10M7 14.5h10M3.5 5.5h.01M3.5 10h.01M3.5 14.5h.01"/>',
    '<rect x="3.5" y="3.5" width="5.5" height="5.5" rx="1.2"/><rect x="11" y="3.5" width="5.5" height="5.5" rx="1.2"/><rect x="3.5" y="11" width="5.5" height="5.5" rx="1.2"/><rect x="11" y="11" width="5.5" height="5.5" rx="1.2"/>',
    '<rect x="3" y="6.5" width="14" height="10" rx="2"/><path d="M7.5 6.5V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 12.5 5v1.5"/>',
    '<path d="M10 3l2.1 4.3 4.7.7-3.4 3.3.8 4.7L10 13.8 5.8 16l.8-4.7L3.2 8l4.7-.7z"/>',
    '<path d="M3 10V4.5A1.5 1.5 0 0 1 4.5 3H10l7 7-6 6z"/><circle cx="7" cy="7" r="1"/>',
    '<path d="M3 6a1.5 1.5 0 0 1 1.5-1.5h3L9 6h6.5A1.5 1.5 0 0 1 17 7.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14.5z"/>',
    '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H16v12H5.5A1.5 1.5 0 0 0 4 16.5z"/><path d="M4 16.5A1.5 1.5 0 0 0 5.5 18H16"/>',
    '<path d="M4 16V9M10 16V4M16 16v-5"/>',
    '<path d="M5 17V3.5M5 4h9l-1.8 3L14 10H5"/>',
    '<circle cx="10" cy="10" r="7"/><circle cx="10" cy="10" r="3.5"/>',
    '<path d="M7 13.5h6M8 16.5h4M10 3a5 5 0 0 0-3 9c.6.5 1 1.2 1 2h4c0-.8.4-1.5 1-2a5 5 0 0 0-3-9z"/>'
  ];
  function svgOf(inner, sz) { return '<svg viewBox="0 0 20 20" width="' + (sz || 20) + '" height="' + (sz || 20) + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>'; }
  function iconSvg(i) { return svgOf(ICONS[(Number(i) || 0) % ICONS.length]); }
  function rebuildTabs() {
    var cfg = catDocs && catDocs.filter(function (d) { return d.id === "cfg"; })[0];
    if (!cfg) { TABS = DEFAULT_TABS.slice(); return; }
    TABS = catDocs.filter(function (d) { return d.id !== "cfg" && d.label; })
      .map(function (d) { return { key: d.id, label: String(d.label), icon: Number(d.icon) || 0, order: Number(d.order) || 0, hidden: !!d.hidden }; })
      .sort(function (a, b) { return a.order - b.order; });
  }
  function tabHidden(k) { var f = TABS.filter(function (t) { return t.key === k; })[0]; return !!(f && f.hidden); }
  var LS = { lock: "cb.lock.v1", skip: "cb.lock.skip", theme: "cb.theme", side: "cb.side" };
  var SS = "cb.unlocked";
  function refilterItems() { items = rawTodos.filter(function (v) { return v.area && v.problem && PRIO[v.priority] && tabKeyOk(v.tab); }); }
  function tabKeyOk(k) { return TABS.some(function (t) { return t.key === k; }); }
  function tabLabel(k) { var f = TABS.filter(function (t) { return t.key === k; })[0]; return f ? f.label : ""; }
  var items = [], events = [];
  var ui = { view: "calendar", tab: "resume", status: "all", prio: 0, q: "", open: {}, confirm: null, drop: null, dropReason: "", dropOpen: false, adding: false, editId: null };
  var db = null, ready = false, loadError = "", started = false;
  var pendingRender = false;

  var $ = function (id) { return document.getElementById(id); };
  function qsa(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === "class") el.className = attrs[k];
      else if (k === "text") el.textContent = attrs[k];
      else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2), attrs[k]);
      else el.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c) el.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return el;
  }
  var toastTimer = null;
  function say(msg, isErr) {
    var t = $("toast");
    clearTimeout(toastTimer);
    if (!msg) { t.hidden = true; return; }
    t.textContent = msg; t.className = "toast" + (isErr ? " err" : ""); t.hidden = false;
    toastTimer = setTimeout(function () { t.hidden = true; }, isErr ? 6000 : 3200);
  }

  /* ---------- 브라우저 저장소 (잠금·테마) ---------- */
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }
  function ssDel(k) { try { sessionStorage.removeItem(k); } catch (e) {} }
  function storageOk() { try { localStorage.setItem("cb.t", "1"); localStorage.removeItem("cb.t"); return true; } catch (e) { return false; } }

  /* ---------- 라이트 / 다크 ---------- */
  function systemDark() { try { return window.matchMedia("(prefers-color-scheme: dark)").matches; } catch (e) { return false; } }
  function effTheme() {
    var a = document.documentElement.getAttribute("data-theme");
    return a === "dark" || a === "light" ? a : (systemDark() ? "dark" : "light");
  }
  function paintThemeBtns() {
    var dark = effTheme() === "dark";
    var label = dark ? "라이트 모드로 전환" : "다크 모드로 전환";
    qsa("[data-theme-btn]").forEach(function (b) {
      b.setAttribute("aria-label", label); b.title = label;
      var sun = b.querySelector(".ic-sun"), moon = b.querySelector(".ic-moon"), tl = b.querySelector(".tl");
      if (sun) sun.hidden = !dark;
      if (moon) moon.hidden = dark;
      if (tl) tl.textContent = dark ? "라이트 모드" : "다크 모드";
    });
  }
  function setTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    lsSet(LS.theme, t);
    paintThemeBtns();
  }
  (function () {
    var s = lsGet(LS.theme);
    if (s === "dark" || s === "light") document.documentElement.setAttribute("data-theme", s);
    paintThemeBtns();
    qsa("[data-theme-btn]").forEach(function (b) {
      b.addEventListener("click", function () { setTheme(effTheme() === "dark" ? "light" : "dark"); });
    });
  })();

  /* ---------- 날짜 도우미 ---------- */
  function p2(n) { return String(n).padStart(2, "0"); }
  function fmt(ts) { if (!ts) return ""; var d = new Date(ts); return d.getFullYear() + "." + p2(d.getMonth() + 1) + "." + p2(d.getDate()); }
  function fmtT(ts) { if (!ts) return ""; var d = new Date(ts); return fmt(ts) + " " + p2(d.getHours()) + ":" + p2(d.getMinutes()); }
  var CHECK = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 4.8"/></svg>';

  function write(fn, okMsg) {
    if (!db) { say("저장소에 연결되지 않아 변경할 수 없습니다.", true); return Promise.resolve(false); }
    return fn().then(function () { if (okMsg) say(okMsg); return true; }).catch(function (e) {
      say("저장하지 못했습니다. " + (e && e.code === "quota_exceeded" ? "저장 용량이 가득 찼습니다." : "잠시 후 다시 시도해 주세요."), true);
      return false;
    });
  }
  function ref(id) { return db.collection("todos").doc(id); }

  /* ---------- 계획 · 집중 계산 (오늘 계획 · 진행) ---------- */
  /* 일정(events)에는 종료 시각이 없어, 시간이 있는 일정을 시간표에 놓거나 겹침을 셀 때 이 길이(분)를 씁니다. */
  var EV_DEFAULT_MIN = 60;
  var DAY_MIN = 1440, MAX_END = 2880;  /* 계획 종료는 다음 날 24:00(=48:00)까지 */
  var rawPlans = [], plans = [];
  var TIME_RE = /^(?:([0-3]\d|4[0-7]):([0-5]\d)|(48):(00))$/;  /* 24:00 이후(25:30 등)는 자정을 넘는 계획의 종료 시각으로만 씁니다 */
  var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  function hmToMin(s) { var m = TIME_RE.exec(String(s || "")); return m ? (m[3] ? MAX_END : (+m[1]) * 60 + (+m[2])) : null; }
  function minToHm(m) { m = Math.max(0, Math.min(MAX_END, Math.round(m))); return p2(Math.floor(m / 60)) + ":" + p2(m % 60); }
  function dateKey(ts) { var d = new Date(ts); return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()); }
  function dayStartMs(key) { var a = String(key).split("-"); return new Date(+a[0], +a[1] - 1, +a[2]).getTime(); }
  function isNum(v) { return typeof v === "number" && isFinite(v); }
  var SHORT_REST_MS = 60000;   /* 1분 미만으로 쉰 구간은 기록하지 않고 집중에 포함 */
  function cleanFocus(f) {
    if (!f || typeof f !== "object" || !isNum(f.startedAt)) return null;
    var ps = (Array.isArray(f.pauses) ? f.pauses : []).filter(function (q) { return q && isNum(q.from) && (q.to == null || isNum(q.to)); })
      .map(function (q) { return { from: q.from, to: q.to == null ? null : q.to }; })
      .sort(function (a, b) { return a.from - b.from; });
    ps = ps.filter(function (q) { return q.to == null || q.to - q.from >= SHORT_REST_MS; });
    return { startedAt: f.startedAt, endedAt: isNum(f.endedAt) ? f.endedAt : null, pauses: ps };
  }
  function cleanPlan(d) {
    var s = hmToMin(d.start), e = hmToMin(d.end);
    if (!DATE_RE.test(String(d.date || "")) || !d.title || s == null || e == null || s >= DAY_MIN || e <= s || e - s > DAY_MIN) return null;
    var st = d.status === "doing" || d.status === "done" || d.status === "partial" ? d.status : "wait";
    return Object.assign({}, d, {
      title: String(d.title), startMin: s, endMin: e, eventId: d.eventId ? String(d.eventId) : "",
      todoIds: Array.isArray(d.todoIds) ? d.todoIds.filter(function (x) { return typeof x === "string" && x; }) : [],
      focus: cleanFocus(d.focus), status: st
    });
  }
  var exPlans = [], plLoaded = false, evLoaded = false;
  function refilterPlans() {
    var all = rawPlans.map(cleanPlan).filter(Boolean).sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); }), seen = {};
    exPlans = []; plans = [];
    all.forEach(function (p) {
      if (p.eventId) { var k = p.date + "|" + p.eventId; if (seen[k]) return; seen[k] = 1; }   /* 같은 일정에서 두 번 만들어진 계획은 하나만 */
      if (p.excluded === true) exPlans.push(p); else plans.push(p);
    });
    plans.sort(function (a, b) { return (a.date + minToHm(a.startMin) + minToHm(a.endMin)) < (b.date + minToHm(b.startMin) + minToHm(b.endMin)) ? -1 : 1; });
  }
  function plansOf(key) { return plans.filter(function (p) { return p.date === key; }); }
  function planLen(p) { return p.endMin - p.startMin; }
  /* 24시를 넘는 계획: 시작한 날과 다음 날 두 곳에 보입니다. 통계·완료 처리는 시작한 날 기준 하나로 셉니다. */
  function nextKey(key) { var d = parseDs(key); d.setDate(d.getDate() + 1); return ds(d.getFullYear(), d.getMonth(), d.getDate()); }
  function lastDateOf(p) { return p.endMin > DAY_MIN ? nextKey(p.date) : p.date; }
  function dispMin(m) { return m > DAY_MIN ? "익일 " + minToHm(m - DAY_MIN) : minToHm(m); }
  function spanFull(p) { return dispMin(p.startMin) + "–" + dispMin(p.endMin); }
  function dayPieces(key) {
    var out = [];
    plans.forEach(function (p) {
      if (p.date === key) out.push(Object.assign({}, p, { endMin: Math.min(p.endMin, DAY_MIN), cont: false, more: p.endMin > DAY_MIN, full: p }));
      else if (p.endMin > DAY_MIN && nextKey(p.date) === key) out.push(Object.assign({}, p, { startMin: 0, endMin: p.endMin - DAY_MIN, cont: true, more: false, full: p }));
    });
    return out.sort(function (a, b) { return a.startMin - b.startMin || a.endMin - b.endMin; });
  }
  function planStartMs(p) { return dayStartMs(p.date) + p.startMin * 60000; }
  function planEndMs(p) { return dayStartMs(p.date) + p.endMin * 60000; }

  /* 집중 상태: 대기(wait) / 집중 중(run) / 일시정지(paused) / 완료(done). 저장된 status가 아니라 focus 기록에서 구합니다. */
  function isLive(p) { return !!p.focus && p.focus.endedAt == null; }
  function isPaused(p) { var q = p.focus && p.focus.pauses; return isLive(p) && q.length > 0 && q[q.length - 1].to == null; }
  function isRunning(p) { return isLive(p) && !isPaused(p); }
  function isDoneFocus(p) { return !!p.focus && p.focus.endedAt != null; }
  function planState(p) { return isDoneFocus(p) ? "done" : (isLive(p) ? (isPaused(p) ? "paused" : "run") : "wait"); }
  function statusOfFocus(p) { return isDoneFocus(p) ? (p.status === "partial" ? "partial" : "done") : (isLive(p) ? "doing" : "wait"); }
  /* 화면에 보이는 상태 5가지 + 일시정지: wait(대기) / run(집중 중) / paused / done(완료) / partial(부분 완료 △) / fail(실패).
     실패는 저장하지 않고 계산합니다: 집중 기록 없이 마지막 날짜가 지나면 실패. */
  function planStatus(p) {
    var st = planState(p);
    if (st === "done") return p.status === "partial" ? "partial" : "done";
    if (st === "wait" && lastDateOf(p) < todayStr()) return "fail";
    return st;
  }
  function focusEnd(p, now) { return p.focus.endedAt != null ? p.focus.endedAt : now; }
  /* 쉰 시간(ms): 집중 구간 안으로 잘라서 더합니다. 진행 중인 쉰 구간은 현재(또는 종료)까지. */
  function restMs(p, now) {
    if (!p.focus) return 0;
    var a = p.focus.startedAt, b = focusEnd(p, now), t = 0;
    p.focus.pauses.forEach(function (q) {
      var from = Math.max(q.from, a), to = Math.min(q.to == null ? b : q.to, b);
      if (to > from) t += to - from;
    });
    return t;
  }
  /* 집중 시간(ms) = (종료 또는 현재) − 시작 − 쉰 시간. 일시정지 중에는 늘지 않습니다. */
  function focusMs(p, now) {
    if (!p.focus) return 0;
    return Math.max(0, focusEnd(p, now) - p.focus.startedAt - restMs(p, now));
  }
  function msToMin(ms) { return Math.round(ms / 60000); }
  /* 초과(분) = 집중한 시간 − 계획 길이. 계획 시간대와 상관없이 언제 시작해도 같은 기준. 1분 미만이면 null. */
  function overInfo(p, now) {
    if (!p.focus) return null;
    var m;
    m = msToMin(focusMs(p, now)) - planLen(p);
    return m >= 1 ? { kind: isLive(p) ? "live" : "done", min: m } : null;
  }
  /* 집중 기록 한 줄을 시간표의 막대 조각으로: 쉰 구간에서 끊고, 계획 길이 안/밖(in/over)으로 나눕니다. 단위는 계획 날짜 0시부터의 분(소수 가능, 24시를 넘을 수 있음). */
  function focusSegments(p, now) {
    if (!p.focus) return [];
    var base = dayStartMs(p.date), a = p.focus.startedAt, b = focusEnd(p, now), cuts = [], segs = [], cur = a;
    p.focus.pauses.forEach(function (q) {
      var from = Math.max(q.from, a), to = Math.min(q.to == null ? b : q.to, b);
      if (to > from) cuts.push([from, to]);
    });
    cuts.forEach(function (c) { if (c[0] > cur) segs.push([cur, c[0]]); cur = Math.max(cur, c[1]); });
    if (b > cur) segs.push([cur, b]);
    var lim = planLen(p) * 60000, acc = 0, out = [];
    segs.forEach(function (sg) {
      var len = sg[1] - sg[0], inPart = Math.max(0, Math.min(len, lim - acc));
      if (inPart > 0) out.push({ from: (sg[0] - base) / 60000, to: (sg[0] + inPart - base) / 60000, over: false });
      if (len > inPart) out.push({ from: (sg[0] + inPart - base) / 60000, to: (sg[1] - base) / 60000, over: true });
      acc += len;
    });
    return out;
  }
  /* 지금 집중 중(일시정지가 아닌)인 계획은 최대 1개. 일시정지 상태의 계획은 여러 개 남을 수 있습니다. */
  function runningPlan(list) { return list.filter(isRunning)[0] || null; }
  function livePlans(list) { return list.filter(isLive); }

  /* 겹침: 그날 계획(전날에서 이어진 조각 포함)끼리 시간이 겹치는 쌍을 찾습니다. 저장하지 않고 화면에서 계산합니다. */
  /* 시간이 있는 일정의 원래 시간대(길이 EV_DEFAULT_MIN분). 겹침 계산에 계획과 함께 넣는다.
     그 일정에서 만든 계획이 같은 시간대 그대로면 계획이 대신하므로 뺀다. 계획은 자기 원본 일정과는 겹침으로 세지 않는다(own). */
  function evSlots(key) {
    var out = [];
    events.forEach(function (e) {
      if (e.date !== key || !tpEvTimed(e)) return;
      var s = hmToMin(e.time), en = s + EV_DEFAULT_MIN;
      var own = plans.filter(function (p) { return p.eventId === e.id && p.date === key; })[0] || null;
      if (own && own.startMin === s && own.endMin === en) return;
      out.push({ id: e.id, title: String(e.title), startMin: s, endMin: en, own: own ? own.id : "" });
    });
    return out;
  }
  function overlapsOf(pieces, key) {
    var a = pieces.map(function (d) { return { t: "p", id: d.full.id, d: d.full, startMin: d.startMin, endMin: d.endMin }; });
    if (key) evSlots(key).forEach(function (v) { a.push({ t: "e", id: v.id, d: { title: v.title + " (일정)" }, startMin: v.startMin, endMin: v.endMin, own: v.own }); });
    a.sort(function (x, y) { return x.startMin - y.startMin || x.endMin - y.endMin; });
    var map = {}, pairs = [];
    for (var i = 0; i < a.length; i++) for (var j = i + 1; j < a.length; j++) {
      var x = a[i], y = a[j];
      if (x.t === "e" && y.t === "e") continue;   /* 일정끼리는 세지 않음(계획이 있으면 계획끼리로 이미 셈) */
      if (!(x.startMin < y.endMin && y.startMin < x.endMin)) continue;
      if ((x.t === "e" && x.own === y.id) || (y.t === "e" && y.own === x.id)) continue;
      map[x.t + ":" + x.id] = 1; map[y.t + ":" + y.id] = 1; pairs.push([x, y]);
    }
    return { map: map, pairs: pairs };
  }
  /* 오늘 전체 계획 카드: 완료 계획/전체 계획, 오늘 집중 합계 / 계획 합계(분) */
  function dayStats(list, now) {
    var n = list.length, score = 0, nd = 0, np = 0, nf = 0, f = 0, pl = 0;
    list.forEach(function (p) {
      var st = planStatus(p);
      if (st === "done") { score += 1; nd++; } else if (st === "partial") { score += 0.5; np++; } else if (st === "fail") nf++;
      f += focusMs(p, now); pl += planLen(p);
    });
    return { n: n, done: score, doneN: nd, partialN: np, failN: nf, pct: n ? Math.round(score / n * 100) : 0, focusMin: msToMin(f), planMin: pl };
  }
  /* 할 일 연결 후보: 끝나지 않았고 포기하지 않았고 다른 어떤 계획에도 연결되지 않은 할 일 */
  function linkedIdSet() { var s = {}; plans.forEach(function (p) { p.todoIds.forEach(function (id) { s[id] = p.id; }); }); return s; }
  function linkableTodos() { var used = linkedIdSet(); return items.filter(function (t) { return !t.done && !isDropped(t) && !used[t.id]; }); }
  function linkedTodosOf(p) { return p.todoIds.map(function (id) { return items.filter(function (t) { return t.id === id; })[0]; }).filter(Boolean); }
  /* 시간 입력 보정: 15분 단위 */
  function snap15(m) { return Math.round(m / 15) * 15; }

  /* ---------- 할 일 ---------- */
  var XICON = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/></svg>';
  function isDropped(it) { return it.dropped === true; }
  function toggle(it) {
    var next = !it.done;
    var upd = { done: next, doneAt: next ? Date.now() : { __delete__: true } };
    if (isDropped(it) || it.droppedAt) { upd.dropped = false; upd.droppedAt = { __delete__: true }; }
    write(function () { return ref(it.id).update(upd); });
  }
  function dropIt(it, reason) {
    var r = String(reason || "").trim();
    var ta = $("note-" + it.id);
    var cur = ta ? ta.value : (it.note || "");
    var upd = { dropped: true, droppedAt: Date.now(), done: false, doneAt: { __delete__: true } };
    if (r) upd.note = (cur.replace(/\s+$/, "") ? cur.replace(/\s+$/, "") + "\n" : "") + "[포기 사유] " + r;
    else if (cur !== (it.note || "")) upd.note = cur;
    ui.drop = null; ui.dropReason = ""; ui.open[it.id] = false;
    write(function () { return ref(it.id).update(upd); }, "포기함으로 옮겼습니다.");
  }
  function revive(it) {
    write(function () { return ref(it.id).update({ dropped: false, droppedAt: { __delete__: true } }); }, "항목을 되살렸습니다.");
  }
  function saveNote(it, val) {
    if ((it.note || "") === val) return;
    write(function () { return ref(it.id).update({ note: val }); }, "메모를 저장했습니다.");
  }
  function remove(it) {
    ui.confirm = null;
    write(function () { return ref(it.id).delete(); }, "항목을 삭제했습니다.");
  }
  function matchBase(it) {
    if (it.tab !== ui.tab) return false;
    if (ui.prio && it.priority !== ui.prio) return false;
    if (ui.q) {
      var hay = [it.area, it.problem, it.fix, it.note].join(" ").toLowerCase();
      if (hay.indexOf(ui.q.toLowerCase()) < 0) return false;
    }
    return true;
  }
  function matches(it) {
    if (isDropped(it)) return false;
    if (ui.status === "open" && it.done) return false;
    if (ui.status === "done" && !it.done) return false;
    return matchBase(it);
  }
  function matchDropped(it) { return isDropped(it) && matchBase(it); }
  function rowEl(it) {
    var open = !!ui.open[it.id];
    var dropped = isDropped(it);
    var isDone = !!it.done && !dropped;
    var chk;
    if (dropped) {
      chk = h("button", { class: "check", type: "button", "aria-label": "되살리기: " + it.area, title: "되살리기", onclick: function () { revive(it); } });
      chk.innerHTML = XICON;
    } else {
      chk = h("button", { class: "check", type: "button", "aria-label": (it.done ? "완료 취소: " : "완료 처리: ") + it.area, "aria-pressed": it.done ? "true" : "false", onclick: function () { toggle(it); } });
      chk.innerHTML = CHECK;
    }
    var main = h("button", { class: "main-btn", type: "button", "aria-expanded": open ? "true" : "false", onclick: function () { ui.open[it.id] = !open; render(); } }, [
      h("span", { class: "area", text: it.area }),
      h("span", { class: "ttl", text: it.problem })
    ]);
    var side = h("div", { class: "side-info" }, [
      h("span", { class: "pill p" + it.priority, text: PRIO[it.priority] }),
      h("div", { class: "dates" }, [
        it.createdAt ? h("span", { class: "when sub", text: "등록 " + fmt(it.createdAt) }) : null,
        dropped ? h("span", { class: "when sub", text: "포기 " + (it.droppedAt ? fmt(it.droppedAt) : "날짜 없음") }) : null,
        isDone ? h("span", { class: "when", text: "완료 " + (it.doneAt ? fmt(it.doneAt) : "날짜 없음") }) : null
      ])
    ]);
    var row = h("div", { class: "row" + (isDone ? " done" : "") + (dropped ? " dropped" : "") }, [h("div", { class: "row-top" }, [chk, main, side])]);
    if (open) {
      var ta = h("textarea", { id: "note-" + it.id, "aria-label": "메모", placeholder: "진행 상황, 참고 링크, 수정한 문구를 적어 두세요." });
      ta.value = it.note || "";
      ta.addEventListener("blur", function () { saveNote(it, ta.value); if (pendingRender) { pendingRender = false; render(); } });
      var del;
      if (ui.confirm === it.id) {
        del = h("span", { class: "confirm" }, [
          h("span", { text: "이 항목을 삭제할까요?" }),
          h("button", { class: "btn sm danger", type: "button", onclick: function () { remove(it); } }, ["삭제"]),
          h("button", { class: "btn sm", type: "button", onclick: function () { ui.confirm = null; render(); } }, ["취소"])
        ]);
      } else {
        del = h("button", { class: "btn sm", type: "button", onclick: function () { ui.confirm = it.id; ui.drop = null; render(); } }, ["삭제"]);
      }
      var edit = h("button", { class: "btn sm", type: "button", "aria-label": "항목 수정: " + it.area, onclick: function () { setAdding(true, it); } }, ["수정"]);
      var dropForm = null, dropBtn = null;
      if (dropped) {
        dropBtn = h("button", { class: "btn sm", type: "button", "aria-label": "되살리기: " + it.area, onclick: function () { revive(it); } }, ["되살리기"]);
      } else if (ui.drop === it.id) {
        var rs = h("textarea", { class: "drop-reason", id: "drop-" + it.id, "aria-label": "포기 사유 (선택)", placeholder: "포기 사유를 적어 두세요. (선택)" });
        rs.value = ui.dropReason || "";
        rs.addEventListener("input", function () { ui.dropReason = rs.value; });
        dropForm = h("div", { class: "drop-form" }, [
          h("span", { text: "이 항목을 포기할까요? 포기함으로 옮겨지며 언제든 되살릴 수 있습니다." }),
          rs,
          h("div", { class: "detail-actions" }, [
            h("button", { class: "btn sm", type: "button", onclick: function () { ui.drop = null; ui.dropReason = ""; render(); } }, ["취소"]),
            h("button", { class: "btn sm primary", type: "button", onclick: function () { dropIt(it, rs.value); } }, ["포기"])
          ])
        ]);
      } else {
        dropBtn = h("button", { class: "btn sm", type: "button", "aria-label": "포기: " + it.area, onclick: function () { ui.drop = it.id; ui.dropReason = ""; ui.confirm = null; render(); } }, ["포기"]);
      }
      row.appendChild(h("div", { class: "detail" }, [
        h("dl", { style: "margin:0;display:grid;gap:12px" }, [
          h("div", null, [h("dt", { text: "자세한 메모" }), h("dd", { text: it.fix || "아직 적지 않았습니다." })]),
          h("div", null, [h("dt", { text: "일정" }), h("dd", { class: "stamps" }, [
            h("span", { text: "등록 " + (it.createdAt ? fmtT(it.createdAt) : "기록 없음") }),
            dropped
              ? h("span", { class: "drop-at", text: "포기 " + (it.droppedAt ? fmtT(it.droppedAt) : "기록 없음") })
              : h("span", { class: isDone ? "done-at" : "", text: isDone ? "완료 " + (it.doneAt ? fmtT(it.doneAt) : "기록 없음") : "아직 완료하지 않음" })
          ])]),
          h("div", null, [h("dt", { text: "진행 메모" }), ta])
        ]),
        dropForm,
        h("div", { class: "detail-actions" }, [edit, dropBtn, del])
      ]));
    }
    return row;
  }

  /* 한국 공휴일 (2025–2028, 월력요항·공휴일법 기준 / 이후 연도는 표시되지 않음) */
  var HOL_RAW = {
    2025: "01-01 신정|01-27 임시공휴일|01-28 설날 연휴|01-29 설날|01-30 설날 연휴|03-01 삼일절|03-03 대체공휴일(삼일절)|05-05 어린이날·부처님오신날|05-06 대체공휴일|06-03 대통령 선거일|06-06 현충일|08-15 광복절|10-03 개천절|10-05 추석 연휴|10-06 추석|10-07 추석 연휴|10-08 대체공휴일(추석)|10-09 한글날|12-25 성탄절",
    2026: "01-01 신정|02-16 설날 연휴|02-17 설날|02-18 설날 연휴|03-01 삼일절|03-02 대체공휴일(삼일절)|05-01 노동절|05-05 어린이날|05-24 부처님오신날|05-25 대체공휴일(부처님오신날)|06-03 지방선거일|06-06 현충일|07-17 제헌절|08-15 광복절|08-17 대체공휴일(광복절)|09-24 추석 연휴|09-25 추석|09-26 추석 연휴|10-03 개천절|10-05 대체공휴일(개천절)|10-09 한글날|12-25 성탄절",
    2027: "01-01 신정|02-06 설날 연휴|02-07 설날|02-08 설날 연휴|02-09 대체공휴일(설날)|03-01 삼일절|05-01 노동절|05-03 대체공휴일(노동절)|05-05 어린이날|05-13 부처님오신날|06-06 현충일|07-17 제헌절|07-19 대체공휴일(제헌절)|08-15 광복절|08-16 대체공휴일(광복절)|09-14 추석 연휴|09-15 추석|09-16 추석 연휴|10-03 개천절|10-04 대체공휴일(개천절)|10-09 한글날|10-11 대체공휴일(한글날)|12-25 성탄절|12-27 대체공휴일(성탄절)",
    2028: "01-01 신정|01-26 설날 연휴|01-27 설날|01-28 설날 연휴|03-01 삼일절|04-12 국회의원 선거일|05-01 노동절|05-02 부처님오신날|05-05 어린이날|06-06 현충일|07-17 제헌절|08-15 광복절|10-02 추석 연휴|10-03 추석·개천절|10-04 추석 연휴|10-05 대체공휴일(개천절)|10-09 한글날|12-25 성탄절"
  };
  var HOL = {};
  Object.keys(HOL_RAW).forEach(function (y) {
    HOL_RAW[y].split("|").forEach(function (t) { var i = t.indexOf(" "); HOL[y + "-" + t.slice(0, i)] = t.slice(i + 1); });
  });
  function holName(sd) { return HOL[sd] || ""; }

  /* ---------- 일정 ---------- */
  var DEFAULT_KINDS = [
    { key: "deadline", label: "서류 마감", color: "red", order: 0 },
    { key: "interview", label: "면접", color: "teal", order: 1 },
    { key: "ssafy", label: "SSAFY", color: "blue", order: 2 },
    { key: "cert", label: "자격증", color: "amber", order: 3 },
    { key: "etc", label: "기타", color: "slate", order: 4 }
  ];
  var PALETTE = [["blue", "파랑"], ["teal", "청록"], ["green", "초록"], ["amber", "노랑"], ["orange", "주황"], ["red", "빨강"], ["purple", "보라"], ["slate", "회색"]];
  function palOk(c) { return PALETTE.some(function (p) { return p[0] === c; }); }
  var KINDLIST = DEFAULT_KINDS.slice(), kindDocs = null, KINDS = {};
  function rebuildKinds() {
    var cfg = kindDocs && kindDocs.filter(function (d) { return d.id === "cfg"; })[0];
    if (!cfg) KINDLIST = DEFAULT_KINDS.slice();
    else KINDLIST = kindDocs.filter(function (d) { return d.id !== "cfg" && d.label; })
      .map(function (d) { return { key: d.id, label: String(d.label), color: palOk(d.color) ? d.color : "slate", order: Number(d.order) || 0 }; })
      .sort(function (a, b) { return a.order - b.order; });
    KINDS = {}; KINDLIST.forEach(function (k) { KINDS[k.key] = k.label; });
  }
  rebuildKinds();
  function kindInfo(k) { var f = KINDLIST.filter(function (x) { return x.key === k; })[0]; return f || { key: "", label: "기타", color: "slate" }; }
  function kcls(k) { return "kc kc-" + kindInfo(k).color; }
  var DOW = ["일", "월", "화", "수", "목", "금", "토"];
  function ds(y, m, d) { return y + "-" + p2(m + 1) + "-" + p2(d); }
  function todayStr() { var n = new Date(); return ds(n.getFullYear(), n.getMonth(), n.getDate()); }
  function parseDs(s) { var a = s.split("-"); return new Date(Number(a[0]), Number(a[1]) - 1, Number(a[2])); }
  function dayLabel(s) { var d = parseDs(s); return (d.getMonth() + 1) + "월 " + d.getDate() + "일 (" + DOW[d.getDay()] + ")"; }
  function dLabel(s) { var n = Math.round((parseDs(s) - parseDs(todayStr())) / 86400000); return n === 0 ? "D-day" : (n > 0 ? "D-" + n : "D+" + (-n)); }
  function monthLabel(m) { if (!m) return ""; var a = m.split("-"); return a[0] + "년 " + Number(a[1]) + "월"; }
  function rangeLabel(e) { return e.endDate && e.endDate > e.date ? dayLabel(e.date) + " ~ " + dayLabel(e.endDate) : ""; }
  function isMulti(e) { return !!e.date && !!e.endDate && e.endDate > e.date; }
  function onDay(e, s) { return !!e.date && e.date <= s && s <= (e.endDate || e.date); }
  function kindOf(e) { return KINDS[e.kind] !== undefined ? e.kind : ""; }
  function upcomingCount() { var t = todayStr(); return events.filter(function (e) { return e.date && (e.endDate || e.date) >= t; }).length; }
  (function () { var n = new Date(); ui.cy = n.getFullYear(); ui.cm = n.getMonth(); ui.sel = todayStr(); ui.confirmEv = null; ui.pDate = todayStr(); ui.pSel = null; ui.pStale = ""; ui.pOvOk = ""; ui.pSheet = false; ui.pDel = ""; })();

  function evRow(e, up) {
    var t = todayStr();
    var first = up && e.date ? (e.date < t ? "진행 중" : dLabel(e.date)) : (e.time || (e.date ? "종일" : "미정"));
    var second = null;
    if (!e.date) second = h("div", { class: "nt", text: monthLabel(e.month) + " 예정" });
    else if (up) second = h("div", { class: "nt", text: rangeLabel(e) || (dayLabel(e.date) + (e.time ? " " + e.time : "")) });
    else if (rangeLabel(e)) second = h("div", { class: "nt", text: "기간 " + rangeLabel(e) });
    var body = h("div", { class: "body" }, [
      h("div", null, [h("span", { class: "pill " + kcls(kindOf(e)), text: kindInfo(kindOf(e)).label }), " ", h("span", { class: "ttl2", text: e.title })]),
      second,
      e.note ? h("div", { class: "nt", text: e.note }) : null
    ]);
    return h("div", { class: "ev ev-open", role: "button", tabindex: "0", title: "눌러서 보기·수정",
      onclick: function () { openEv(null, e); },
      onkeydown: function (k) { if (k.key === "Enter" || k.key === " ") { k.preventDefault(); openEv(null, e); } } },
      [h("span", { class: up && e.date ? "dd" : "t", text: first }), body]);
  }

  function at(el, col, row) { el.style.gridColumn = col; el.style.gridRow = row; return el; }
  function weekEl(w, first, t, multi) {
    var dates = [];
    for (var i = 0; i < 7; i++) {
      var dt = new Date(ui.cy, ui.cm, 1 - first + w * 7 + i);
      dates.push({ s: ds(dt.getFullYear(), dt.getMonth(), dt.getDate()), d: dt.getDate(), inM: dt.getMonth() === ui.cm, dow: i });
    }
    var segs = [];
    multi.forEach(function (e) {
      var cs = -1, ce = -1;
      for (var i = 0; i < 7; i++) if (onDay(e, dates[i].s)) { if (cs < 0) cs = i; ce = i; }
      if (cs >= 0) segs.push({ e: e, cs: cs, ce: ce });
    });
    segs.sort(function (a, b) { return a.cs - b.cs || (b.ce - b.cs) - (a.ce - a.cs); });
    var laneEnd = [];
    segs.forEach(function (g) {
      var l = 0; while (laneEnd[l] !== undefined && laneEnd[l] >= g.cs) l++;
      laneEnd[l] = g.ce; g.lane = l;
    });
    var lanes = laneEnd.length;
    var hasEv = dates.some(function (x) { return events.some(function (e) { return onDay(e, x.s) && !isMulti(e); }); });
    var week = h("div", { class: "week" + (hasEv ? " has-ev" : "") });
    week.style.gridTemplateRows = "auto" + (lanes ? " repeat(" + lanes + ", auto)" : "") + " minmax(var(--chiprow), 1fr)";
    var lastRow = lanes + 2;

    dates.forEach(function (x, i) {
      var all = events.filter(function (e) { return onDay(e, x.s); });
      var day = h("button", {
        class: "day" + (x.inM ? "" : " out") + (x.s === ui.sel ? " sel" : ""), type: "button",
        "aria-pressed": x.s === ui.sel ? "true" : "false",
        "aria-label": dayLabel(x.s) + (all.length ? ", 일정 " + all.length + "개" : ""),
        onclick: function () {
          ui.sel = x.s; ui.confirmEv = null;
          if (!x.inM) { var d0 = parseDs(x.s); ui.cy = d0.getFullYear(); ui.cm = d0.getMonth(); }
          render();
        }
      });
      at(day, String(i + 1), "1 / -1");
      week.appendChild(day);
    });
    dates.forEach(function (x, i) {
      var hn = holName(x.s);
      var n = h("span", { class: "num" + (x.dow === 0 || hn ? " sun" : "") + (x.inM ? "" : " out") + (x.s === t ? " today" : ""), text: String(x.d) });
      week.appendChild(at(n, String(i + 1), "1"));
      if (hn) { var hl = h("span", { class: "holn" + (x.inM ? "" : " out"), text: hn.indexOf("대체공휴일(") === 0 ? "대체휴일" : hn, title: hn }); week.appendChild(at(hl, String(i + 1), "1")); }
    });
    segs.forEach(function (g) {
      var bs = g.e.date >= dates[g.cs].s, be = g.e.endDate <= dates[g.ce].s;
      var bar = h("div", { class: "sbar " + kcls(kindOf(g.e)) + (bs ? " sb-s" : " cl") + (be ? " sb-e" : " cr"), text: g.e.title, title: g.e.title });
      week.appendChild(at(bar, (g.cs + 1) + " / " + (g.ce + 2), String(g.lane + 2)));
    });
    dates.forEach(function (x, i) {
      var evs = events.filter(function (e) { return onDay(e, x.s) && !isMulti(e); });
      if (!evs.length) return;
      var occ = 0;
      segs.forEach(function (g) { if (i >= g.cs && i <= g.ce) occ = Math.max(occ, g.lane + 1); });
      var box = h("div", { class: "cellev" + (x.inM ? "" : " out") });
      if (occ) box.style.paddingTop = "calc(" + occ + " * (var(--bh) + 2px) + 1px)";
      var chips = h("div", { class: "chips" });
      evs.slice(0, 2).forEach(function (e) {
        chips.appendChild(h("span", { class: "chip " + kcls(kindOf(e)), title: e.title }, [e.time ? h("span", { class: "ct", text: e.time + " " }) : null, e.title]));
      });
      if (evs.length > 2) chips.appendChild(h("span", { class: "more", text: "+" + (evs.length - 2) + "개" }));
      box.appendChild(chips);
      week.appendChild(at(box, String(i + 1), "2 / -1"));
    });
    return week;
  }
  function renderGrid(t) {
    var grid = $("calGrid"); grid.textContent = "";
    var head = h("div", { class: "cal-head" });
    DOW.forEach(function (w, i) { head.appendChild(h("div", { class: "wk" + (i === 0 ? " sun" : ""), text: w })); });
    grid.appendChild(head);
    var first = new Date(ui.cy, ui.cm, 1).getDay();
    var days = new Date(ui.cy, ui.cm + 1, 0).getDate();
    var weeks = Math.ceil((first + days) / 7);
    var multi = events.filter(isMulti);
    for (var w = 0; w < weeks; w++) grid.appendChild(weekEl(w, first, t, multi));
  }
  function renderCalView() {
    var t = todayStr();
    $("calTitle").textContent = ui.cy + "년 " + (ui.cm + 1) + "월";
    renderGrid(t); renderLegend();

    $("dayTitle").textContent = dayLabel(ui.sel) + (ui.sel === t ? " · 오늘" : "");
    var hnm = holName(ui.sel); $("dayHol").hidden = !hnm; $("dayHol").textContent = hnm ? "공휴일 · " + hnm : "";
    var dl = $("dayList"); dl.textContent = "";
    var todays = events.filter(function (e) { return onDay(e, ui.sel); });
    if (!todays.length) dl.appendChild(h("div", { class: "none", text: "이 날 등록된 일정이 없습니다." }));
    todays.forEach(function (e) { dl.appendChild(evRow(e, false)); });

    var mon = monthStr();
    var tm = events.filter(function (e) { return !e.date && e.month === mon; });
    $("monCard").hidden = !tm.length;
    $("monTitle").textContent = (ui.cm + 1) + "월 · " + tm.length + "건";
    var ml = $("monList"); ml.textContent = "";
    tm.forEach(function (e) { ml.appendChild(evRow(e, false)); });

    var ul = $("upList"); ul.textContent = "";
    var upAll = events.filter(function (e) { return e.date && (e.endDate || e.date) >= t; });
    var up = upAll.slice(0, 6);
    if (!up.length) ul.appendChild(h("div", { class: "none", text: "다가오는 일정이 없습니다. 날짜를 눌러 일정을 추가해 보세요." }));
    up.forEach(function (e) {
      ul.appendChild(h("button", { class: "ev ev-btn", type: "button", onclick: function () {
        var jump = e.date < t ? t : e.date; var d0 = parseDs(jump); ui.cy = d0.getFullYear(); ui.cm = d0.getMonth(); ui.sel = jump; ui.confirmEv = null; render();
      } }, [
        h("span", { class: "dd", text: e.date < t ? "진행 중" : dLabel(e.date) }),
        h("div", { class: "body" }, [
          h("div", null, [h("span", { class: "pill " + kcls(kindOf(e)), text: kindInfo(kindOf(e)).label }), " ", h("span", { class: "ttl2", text: e.title })]),
          h("div", { class: "nt", text: rangeLabel(e) || (dayLabel(e.date) + (e.time ? " " + e.time : "")) })
        ])
      ]));
    });
    var more = upAll.length - up.length;
    var tbdAll = events.filter(function (e) { return !e.date; });
    var note = $("tbdNote");
    var parts = [];
    if (more > 0) parts.push("외 " + more + "개");
    if (tbdAll.length) parts.push("날짜 미정 " + tbdAll.length + "건");
    note.hidden = !parts.length;
    note.textContent = parts.length ? parts.join(" · ") + " 보기" : "";
  }
  function renderUpView() {
    var t = todayStr();
    var box = $("upBig"); box.textContent = "";
    var upAll = events.filter(function (e) { return e.date && (e.endDate || e.date) >= t; });
    if (!upAll.length) box.appendChild(h("div", { class: "none", text: "다가오는 일정이 없습니다. ‘+ 일정 등록’으로 추가해 보세요." }));
    var lastM = "";
    upAll.forEach(function (e) {
      var m = e.date.slice(0, 7);
      if (m !== lastM) { lastM = m; box.appendChild(h("div", { class: "mgrp", text: monthLabel(m) })); }
      box.appendChild(evRow(e, true));
    });
    var tbd = events.filter(function (e) { return !e.date; }).sort(function (a, b) { return (a.month || "") < (b.month || "") ? -1 : ((a.month || "") > (b.month || "") ? 1 : 0); });
    var tl = $("tbdList"); tl.textContent = "";
    if (!tbd.length) tl.appendChild(h("div", { class: "none", text: "날짜 미정인 일정이 없습니다." }));
    tbd.forEach(function (e) { tl.appendChild(evRow(e, true)); });
  }

  $("calPrev").addEventListener("click", function () { ui.cm--; if (ui.cm < 0) { ui.cm = 11; ui.cy--; } render(); });
  $("calNext").addEventListener("click", function () { ui.cm++; if (ui.cm > 11) { ui.cm = 0; ui.cy++; } render(); });
  $("calToday").addEventListener("click", function () { var n = new Date(); ui.cy = n.getFullYear(); ui.cm = n.getMonth(); ui.sel = todayStr(); render(); });
  $("tbdNote").addEventListener("click", function () { go("upcoming"); });
  ui.evKind = KINDLIST[0] ? KINDLIST[0].key : "";
  function renderKinds() {
    var box = $("evKinds"); box.textContent = "";
    KINDLIST.forEach(function (k) {
      box.appendChild(h("button", { class: "kindbtn pill " + kcls(k.key), type: "button", "aria-pressed": ui.evKind === k.key ? "true" : "false",
        onclick: function () { ui.evKind = k.key; renderKinds(); } }, [(ui.evKind === k.key ? "✓ " : "") + k.label]));
    });
  }
  var PENCIL = '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3.5l3 3L7 16H4v-3z"/></svg>';
  function renderLegend() {
    var lg = $("calLegend"); lg.textContent = "";
    KINDLIST.forEach(function (k) { lg.appendChild(h("span", { class: "lg" }, [h("span", { class: "dot kc kc-" + k.color }), k.label])); });
    lg.appendChild(h("span", { class: "lg" }, [h("span", { class: "dot d-hol" }), "공휴일"]));
  }
  ui.editId = null;
  function monthStr() { return ui.cy + "-" + p2(ui.cm + 1); }
  function syncTbd() {
    var t = $("evTbd").checked;
    $("dtMain").classList.toggle("off", t); $("dtMonthW").classList.toggle("off", !t);
    if (t) $("dtMain").setAttribute("inert", ""); else $("dtMain").removeAttribute("inert");
    if (t) $("dtMonthW").removeAttribute("inert"); else $("dtMonthW").setAttribute("inert", "");
    $("evDate").required = !t; $("evMonth").required = t;
  }
  function openEv(date, ev, tbd) {
    ui.editId = ev ? ev.id : null;
    $("evModalTitle").textContent = ev ? "일정 수정" : "새 일정 등록";
    ui.delArm = false; $("evDel").hidden = !ev; $("evDel").textContent = "삭제";
    $("evSubmit").textContent = ev ? "저장" : "등록";
    $("evMsg").textContent = "";
    $("evTbd").checked = ev ? !ev.date : !!tbd;
    $("evDate").value = ev ? (ev.date || "") : (date || ui.sel);
    $("evEnd").value = ev ? (ev.endDate || "") : "";
    $("evTime").value = ev ? (ev.time || "") : "";
    $("evMonth").value = ev ? (ev.month || (ev.date || "").slice(0, 7) || monthStr()) : monthStr();
    $("evTitle").value = ev ? ev.title : "";
    $("evNote").value = ev ? (ev.note || "") : "";
    ui.evKind = ev ? kindOf(ev) : (KINDLIST[0] ? KINDLIST[0].key : ""); renderKinds(); syncTbd(); syncPicks();
    $("evModal").hidden = false; growNote(); if (!ev) $("evTitle").focus();
  }
  function closeEv() { $("evModal").hidden = true; }
  $("calAdd").addEventListener("click", function () { openEv(ui.sel); });
  $("upAdd").addEventListener("click", function () { openEv(ui.sel); });
  function setSide(c) {
    $("app").classList.toggle("collapsed", c);
    var b = $("sideToggle"), t = c ? "사이드바 펴기" : "사이드바 접기";
    b.setAttribute("aria-expanded", c ? "false" : "true"); b.setAttribute("aria-label", t); b.title = t;
  }
  qsa(".side [data-go]").forEach(function (b) {
    var l = b.querySelector(".lb"); if (l) { b.title = l.textContent; b.setAttribute("aria-label", l.textContent); }
  });
  $("sideToggle").addEventListener("click", function () {
    var c = !$("app").classList.contains("collapsed");
    setSide(c); lsSet(LS.side, c ? "1" : "0");
  });
  setSide(lsGet(LS.side) === "1");
  $("evTbd").addEventListener("change", function () {
    if (!$("evTbd").checked && !$("evDate").value) $("evDate").value = $("evMonth").value ? $("evMonth").value + "-01" : ui.sel;
    syncTbd(); syncPicks();
  });
  $("evCancel").addEventListener("click", closeEv);
  $("evDel").addEventListener("click", function () {
    if (!ui.editId) return;
    if (!ui.delArm) { ui.delArm = true; $("evDel").textContent = "정말 삭제"; return; }
    var id = ui.editId; closeEv();
    write(function () { return db.collection("events").doc(id).delete(); }, "일정을 삭제했습니다.");
  });
  $("evModal").addEventListener("click", function (e) { if (e.target === $("evModal")) closeEv(); });
  $("evForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var tbd = $("evTbd").checked;
    var title = $("evTitle").value.trim();
    var date = tbd ? "" : $("evDate").value, month = tbd ? $("evMonth").value : "", end = tbd ? "" : $("evEnd").value;
    if (!title || (tbd ? !month : !date)) { $("evMsg").textContent = tbd ? "예정 월과 제목을 입력해 주세요." : "날짜와 제목을 입력해 주세요."; return; }
    if (end && end < date) { $("evMsg").textContent = "종료일은 시작일과 같거나 늦어야 합니다."; return; }
    $("evMsg").textContent = "";
    var editing = ui.editId, old = editing ? events.filter(function (v) { return v.id === editing; })[0] : null;
    var payload = { date: date, month: month, endDate: end && end > date ? end : "", time: tbd ? "" : ($("evTime").value || ""),
      title: title, kind: ui.evKind, note: $("evNote").value.trim(), createdAt: old && old.createdAt ? old.createdAt : Date.now() };
    if (editing) payload.updatedAt = Date.now();
    write(function () {
      return editing ? db.collection("events").doc(editing).set(payload) : db.collection("events").add(payload);
    }).then(function (ok) {
      if (!ok) { $("evMsg").textContent = "저장하지 못했습니다. 잠시 후 다시 시도해 주세요."; return; }
      var d0 = parseDs(date || (month + "-01")); ui.cy = d0.getFullYear(); ui.cm = d0.getMonth();
      if (date) ui.sel = date;
      ui.confirmEv = null; closeEv(); render();
      say((editing ? "수정했습니다: " : "등록했습니다: ") + (date ? dayLabel(date) : (d0.getMonth() + 1) + "월 날짜 미정") + " " + title);
    });
  });

  /* ---------- 오늘 계획 · 진행 화면 ---------- */
  var TP = { T0: 360, T1: 1440, LW: 52, tick: 0 };
  /* 기본은 06:00부터. 그날 6시 이전에 시작하는 계획·일정·집중 기록이 있으면 그 시각의 정시부터 보여 줍니다. */
  function tpRange(pieces) {
    var m = 360;
    pieces.forEach(function (p) { m = Math.min(m, p.startMin); if (p.focus && !p.cont) m = Math.min(m, Math.floor((p.focus.startedAt - dayStartMs(p.date)) / 60000)); });
    return Math.max(0, Math.floor(m / 60) * 60);
  }
  var TPI = {
    left: svgOf('<path d="M12.5 4.5L7 10l5.5 5.5"/>', 18), right: svgOf('<path d="M7.5 4.5L13 10l-5.5 5.5"/>', 18),
    plus: svgOf('<path d="M10 4v12M4 10h12"/>', 18), alert: svgOf('<path d="M10 3.5l7 12.5H3zM10 8.5v3.5M10 14.3v.1"/>'),
    clock: svgOf('<circle cx="10" cy="10" r="7"/><path d="M10 6v4.5l3 1.5"/>'), play: svgOf('<path d="M7 4.5l8.5 5.5L7 15.5z"/>'),
    pause: svgOf('<path d="M7 4.5v11M13 4.5v11"/>'), stop: svgOf('<rect x="5" y="5" width="10" height="10" rx="2"/>'),
    edit: svgOf('<path d="M4 16l.8-3.6L13.2 4a1.8 1.8 0 0 1 2.6 2.6L7.4 15.2z"/>'), timer: svgOf('<circle cx="10" cy="11" r="6"/><path d="M10 8v3.2l2 1.2M8 2.5h4"/>'),
    trash: svgOf('<path d="M4 6h12M8 6V4h4v2M6 6l.7 10h6.6L14 6M8.5 9v4.5M11.5 9v4.5"/>', 18), x: svgOf('<path d="M5 5l10 10M15 5L5 15"/>', 18)
  };
  function tpH() { return window.innerWidth >= 900 ? 60 : 64; }
  function durText(m) { m = Math.max(0, Math.round(m)); var hh = Math.floor(m / 60), r = m % 60; return hh ? (r ? hh + "시간 " + r + "분" : hh + "시간") : r + "분"; }
  function hmsText(ms) { var s = Math.max(0, Math.floor(ms / 1000)); return p2(Math.floor(s / 3600)) + ":" + p2(Math.floor(s % 3600 / 60)) + ":" + p2(s % 60); }
  function tmText(ts) { var d = new Date(ts); return p2(d.getHours()) + ":" + p2(d.getMinutes()); }
  function span2(a, b) { return dispMin(a) + "–" + dispMin(b); }
  function iconEl(tag, svg, attrs, kids) { var el = h(tag, attrs, kids); var t = document.createElement("template"); t.innerHTML = svg; el.insertBefore(t.content.firstChild, el.firstChild); return el; }

  /* ---------- 집중 기록: 시작 · 일시정지 · 이어서 · 종료 ---------- */
  /* 하루 안에서는 계획 시간대와 상관없이 언제든 시작할 수 있다. 자정을 넘는 계획은 다음 날에도 시작할 수 있다. */
  function tpCanStart(p) { var t = todayStr(); return p.date === t || (p.endMin > DAY_MIN && nextKey(p.date) === t); }
  function tpPlan(id) { return plans.filter(function (x) { return x.id === id; })[0] || null; }
  function tpFocusCopy(f) { return { startedAt: f.startedAt, endedAt: f.endedAt, pauses: f.pauses.map(function (q) { return { from: q.from, to: q.to }; }) }; }
  function tpSaveFocus(p, f, extra) {
    var upd = Object.assign({ focus: f, status: statusOfFocus({ focus: f, status: p.status }), updatedAt: Date.now() }, tpFocusFields(f), extra || {});
    return db.collection("plans").doc(p.id).update(upd);
  }
  /* 지금 집중 중인(일시정지가 아닌) 다른 계획은 일시정지로 돌립니다. 한 번에 하나만 집중 중이 되도록. */
  function tpPauseOthers(exceptId, now) {
    return plans.filter(function (x) { return x.id !== exceptId && isRunning(x); }).map(function (x) {
      var f = tpFocusCopy(x.focus); f.pauses.push({ from: now, to: null }); return { p: x, f: f };
    });
  }
  /* 열려 있는 쉰 구간을 닫는다. 1분 미만이면 기록하지 않고 없앤다. */
  function tpCloseRest(f, now) {
    var q = f.pauses[f.pauses.length - 1];
    if (now - q.from < SHORT_REST_MS) f.pauses.pop(); else q.to = now;
  }
  function tpStart(id) {
    var p = tpPlan(id); if (!p) return;
    var st = planState(p), now = Date.now();
    if (st === "run" || st === "done") return;
    if (st === "wait" && !tpCanStart(p)) { say("그날이 되면 집중을 시작할 수 있어요. (지난 날짜의 계획은 시작할 수 없어요)", true); return; }
    var others = tpPauseOthers(p.id, now), f;
    if (st === "paused") { f = tpFocusCopy(p.focus); tpCloseRest(f, now); }
    else f = { startedAt: now, endedAt: null, pauses: [] };
    var msg = others.length ? "‘" + others[0].p.title + "’ 집중을 일시정지하고 ‘" + p.title + "’(으)로 바꿨어요." : (st === "paused" ? "이어서 집중합니다." : "집중을 시작했어요.");
    ui.pSel = p.id; ui.pStale = "";
    write(function () { return Promise.all(others.map(function (o) { return tpSaveFocus(o.p, o.f); }).concat([tpSaveFocus(p, f)])); }, msg);
  }
  function tpPause(id) {
    var p = tpPlan(id); if (!p || !isRunning(p)) return;
    var f = tpFocusCopy(p.focus); f.pauses.push({ from: Date.now(), to: null });
    write(function () { return tpSaveFocus(p, f); }, "일시정지했어요.");
  }
  /* 계획 완료 = 집중 종료. 일시정지 중이면 쉰 구간을 지금 닫고 끝냅니다. */
  function tpEnd(id) {
    var p = tpPlan(id); if (!p || !isLive(p)) return;
    var now = Date.now(), f = tpFocusCopy(p.focus);
    if (isPaused(p)) tpCloseRest(f, now);
    f.endedAt = now; ui.pStale = "";
    write(function () { return tpSaveFocus(p, f, { doneAt: now }); }, "집중을 마쳤어요. 계획을 완료로 표시했어요.");
  }

  function tpLanes(list) {
    var res = [], cl = [], cEnd = -1;
    function flush() {
      var ends = [];
      cl.forEach(function (it) {
        var l = -1;
        for (var k = 0; k < ends.length; k++) if (ends[k] <= it.startMin) { l = k; break; }
        if (l < 0) { ends.push(it.endMin); l = ends.length - 1; } else ends[l] = it.endMin;
        it.lane = l;
      });
      cl.forEach(function (it) { it.lanes = ends.length; });
      res = res.concat(cl); cl = [];
    }
    list.forEach(function (it) { if (cl.length && it.startMin >= cEnd) { flush(); cEnd = -1; } cl.push(it); cEnd = Math.max(cEnd, it.endMin); });
    flush(); return res;
  }
  function tpSelected(list, now) {
    var s = list.filter(function (p) { return p.id === ui.pSel; })[0];
    if (s) return s;
    return runningPlan(list) || livePlans(list)[0] || list.filter(function (p) { return planState(p) === "wait"; })[0] || null;
  }
  function tpEvDday(e) { return e.kind === "deadline" || e.kind === "interview" ? dLabel(e.date) : ""; }
  function tpTagPills(p, now) {
    var a = [], rs = msToMin(restMs(p, now)), ov = overInfo(p, now);
    if (isPaused(p)) a.push(h("span", { class: "pill p3", text: "쉬는 중" + (rs > 0 ? " · " + durText(rs) : "") }));
    else if (p.focus && rs > 0) a.push(h("span", { class: "pill p3", text: "쉰 시간 " + durText(rs) }));
    if (ov) a.push(h("span", { class: "pill st-over", text: ov.kind === "live" ? "계획 +" + durText(ov.min) : "+" + durText(ov.min) + " 초과" }));
    return a.length ? h("div", { class: "tp-pills" }, a) : null;
  }

  var TPMQ = window.matchMedia("(max-width: 899px)");
  function tpMobile() { return TPMQ.matches; }
  /* 모바일에서는 ‘선택한 계획’ 시트를 스크롤하는 화면(.main) 밖으로 옮긴다. 스크롤 영역 안의 고정 요소는 일부 휴대폰에서 버튼 터치가 먹히지 않는다. */
  function tpPlaceDetail() {
    var d = $("tpDetail"), want = tpMobile() ? $("app") : document.querySelector("#vPlan .tp-two .r");
    if (d && want && d.parentNode !== want) want.appendChild(d);
  }
  if (TPMQ.addEventListener) TPMQ.addEventListener("change", function () { tpPlaceDetail(); if (ui.view === "plan") renderPlanView(); });
  function tpOpenDatePick() { openPick("date", "tpDateIn", { onSet: function (v) { if (v) tpGoDate(v); } }); }
  function tpDateRow(isToday) {
    var box = $("tpDate"); box.textContent = "";
    var din = h("input", { type: "hidden", id: "tpDateIn" }); din.value = ui.pDate;
    var title = h("h2", { class: "cal-title", role: "button", tabindex: "0", title: "날짜 선택", "aria-label": dayLabel(ui.pDate) + " (눌러서 날짜 선택)",
      onclick: tpOpenDatePick, onkeydown: function (k) { if (k.key === "Enter" || k.key === " ") { k.preventDefault(); tpOpenDatePick(); } } },
      [dayLabel(ui.pDate)]);
    var tag = h("span", { class: "today-tag", text: "오늘", style: isToday ? "" : "visibility:hidden", "aria-hidden": isToday ? "false" : "true" });
    var prev = iconEl("button", TPI.left, { class: "icon-btn", type: "button", "aria-label": "어제", title: "이전 날", onclick: function () { tpGoDate(tpShiftDate(-1)); } });
    var next = iconEl("button", TPI.right, { class: "icon-btn", type: "button", "aria-label": "내일", title: "다음 날", onclick: function () { tpGoDate(tpShiftDate(1)); } });
    var addD = iconEl("button", TPI.plus.replace('width="18" height="18"', 'width="16" height="16"'), { class: "btn primary only-d", type: "button", onclick: function () { tpOpenAdd(); } });
    addD.appendChild(document.createTextNode("계획 추가"));
    var addM = iconEl("button", TPI.plus, { class: "icon-btn hadd only-m", type: "button", "aria-label": "계획 추가", onclick: function () { tpOpenAdd(); } });
    [din, prev, title, next, tag, h("span", { class: "sp" }), addM, addD].forEach(function (n) { box.appendChild(n); });
  }
  function tpShiftDate(n) { var d = parseDs(ui.pDate); d.setDate(d.getDate() + n); return ds(d.getFullYear(), d.getMonth(), d.getDate()); }
  function tpGoDate(s) { ui.pDate = s; ui.pSel = null; ui.pSheet = false; ui.pDel = ""; renderPlanView(); var sc = $("tpScroll"); if (sc) tpScrollToNow(true); }

  function tpSumCard(list, st, isToday) {
    var box = $("tpSum"); box.textContent = "";
    box.setAttribute("aria-label", isToday ? "오늘 전체 계획" : "전체 계획");
    box.appendChild(h("div", { class: "lbl", text: isToday ? "오늘 전체 계획" : (parseDs(ui.pDate).getMonth() + 1) + "월 " + parseDs(ui.pDate).getDate() + "일 전체 계획" }));
    var pct = h("div", { class: "pct" }, [st.pct + "%", h("small", { text: fmtScore(st.done) + "/" + st.n + " 완료" })]);
    var tr = h("div", { class: "track", "aria-hidden": "true" }, [h("span", { style: "width:" + st.pct + "%" })]);
    box.appendChild(h("div", { class: "r1" }, [pct, tr]));
    var sl = h("div", { class: "tp-sline" }, [(isToday ? "오늘 " : "") + "집중 ", h("b", { text: durText(st.focusMin) }), " / 계획 " + durText(st.planMin)]);
    box.appendChild(sl);
    var rest = st.n - st.doneN - st.partialN - st.failN;
    box.appendChild(h("div", { class: "tp-sline tp-scount" }, [h("span", { text: "완료 " + st.doneN }), h("span", { text: "절반 " + st.partialN }), h("span", { text: "실패 " + st.failN }), h("span", { text: "남음 " + rest })]));
  }
  function fmtScore(v) { return v % 1 ? String(v) : String(Math.round(v)); }

  /* 계획 시간을 넘겨 집중 중이면 화면 위쪽에 잠깐 떴다가 사라지는 알림으로 알린다(레이아웃을 밀지 않고, 한 번만). */
  var stalePop = null, staleTimer = 0;
  function tpStaleClose() { if (staleTimer) { clearTimeout(staleTimer); staleTimer = 0; } if (stalePop && stalePop.parentNode) stalePop.parentNode.removeChild(stalePop); stalePop = null; }
  function tpStalePop(run, over) {
    tpStaleClose();
    var pop = h("div", { id: "tpStalePop", class: "tp-stale", role: "status", "aria-live": "polite" }, []);
    pop.appendChild(h("div", { class: "tp-st-t" }, [h("b", { text: "계획 시간을 " + durText(over.min) + " 넘겨 집중 중이에요" }),
      h("div", { class: "txt", text: "‘" + run.title + "’ · 계획 " + durText(planLen(run)) + ". 더 이어서 해도 괜찮아요." })]));
    var b2 = h("button", { class: "btn sm", type: "button", text: "지금 종료", onclick: function () { tpStaleClose(); tpEnd(run.id); } });
    var b3 = h("button", { class: "btn sm", type: "button", text: "종료 시각 고치기", onclick: function () { tpStaleClose(); tpOpenSess(run.id); } });
    var b1 = h("button", { class: "btn sm primary", type: "button", text: "닫기", onclick: tpStaleClose });
    pop.appendChild(h("div", { class: "btns" }, [b2, b3, b1]));
    document.body.appendChild(pop); stalePop = pop;
    staleTimer = setTimeout(tpStaleClose, 12000);
  }
  function tpNotes(list, ov, now, isToday) {
    var box = $("tpNotes"); box.textContent = "";
    var key = ui.pDate + "|" + ov.pairs.map(function (p) { return p[0].t + p[0].id + p[1].t + p[1].id; }).join(",");
    /* 계획 시간을 넘겨 집중 중 */
    var run = runningPlan(plans), over = run && overInfo(run, now);
    if (run && over && ui.pStale !== run.id + ":" + planEndMs(run)) { ui.pStale = run.id + ":" + planEndMs(run); tpStalePop(run, over); }
    else if (!run) tpStaleClose();
    /* 겹침 경고 */
    if (ov.pairs.length && ui.pOvOk !== key) {
      var w = h("div", { class: "tp-warnbox", role: "alert" }, []);
      w.innerHTML = TPI.alert;
      var lines = ov.pairs.map(function (pr) { return pr[0].d.title + " " + span2(pr[0].startMin, pr[0].endMin) + " ↔ " + pr[1].d.title + " " + span2(pr[1].startMin, pr[1].endMin); });
      var txt = h("div", { class: "txt" }, []);
      lines.forEach(function (ln, i) { if (i) txt.appendChild(document.createElement("br")); txt.appendChild(document.createTextNode(ln)); });
      w.appendChild(h("div", null, [h("b", { text: "시간이 겹치는 곳이 " + ov.pairs.length + "군데 있어요" }), txt]));
      var a1 = iconEl("button", TPI.edit, { class: "btn sm", type: "button", onclick: function () { tpFocusOverlap(ov); } }); a1.appendChild(document.createTextNode("시간 조정"));
      var a2 = h("button", { class: "btn sm", type: "button", text: "그대로 두기", onclick: function () { ui.pOvOk = key; renderPlanView(); } });
      w.appendChild(h("div", { class: "btns" }, [a1, a2]));
      box.appendChild(w);
    }
    if (!list.length) {
      var em = h("div", { class: "empty tp-empty" }, []);
      em.innerHTML = svgOf('<circle cx="10" cy="11" r="6"/><path d="M10 8v3.2l2 1.2M8 2.5h4"/>').replace("<svg ", '<svg class="big" ');
      em.appendChild(h("div", null, [h("b", { text: isToday ? "아직 오늘 세운 계획이 없어요" : "이 날은 아직 계획이 없어요" }), ui.pDate >= todayStr() ? "시간대를 정해서 계획을 추가해 보세요." : "지난 날짜에는 계획을 추가할 수 없어요."]));
      if (ui.pDate >= todayStr()) {
        var ac = [iconEl("button", TPI.plus.replace('width="18" height="18"', 'width="16" height="16"'), { class: "btn primary", type: "button", onclick: function () { tpOpenAdd(); } }),
          h("button", { class: "btn", type: "button", text: "어제 이월분 불러오기", onclick: function () { tpCarryOver(); } })];
        ac[0].appendChild(document.createTextNode("직접 추가"));
        em.appendChild(h("div", { class: "acts" }, ac));
      }
      box.appendChild(em);
    }
  }
  function tpFocusOverlap(ov) {
    var first = ov.pairs[0], pl = first[0].t === "p" ? first[0] : (first[1].t === "p" ? first[1] : null);
    if (pl) { ui.pSel = pl.id; renderPlanView(); tpOpenTime(pl.id); }
  }

  function tpSi(cls, inner) { var e = h("span", { class: "si " + cls, "aria-hidden": "true" }); e.innerHTML = '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>'; return e; }
  function tpGrid(pieces, ov, now, isToday, selId) {
    var H = tpH(), T0 = TP.T0, T1 = TP.T1, LW = TP.LW, grid = $("tpGrid");
    grid.textContent = ""; grid.style.height = (T1 - T0) / 60 * H + "px"; grid.setAttribute("data-pph", String(H));
    for (var m = T0; m <= T1; m += 60) {
      var hr = h("div", { class: "tp-hr", style: "top:" + (m - T0) / 60 * H + "px" }, [h("span", { text: m === T1 ? "24:00" : minToHm(m) })]);
      grid.appendChild(hr);
    }
    var items = pieces.filter(function (d) { return d.endMin > T0; }).map(function (d) { return { d: d, startMin: d.startMin, endMin: d.endMin }; })
      .sort(function (a, b) { return a.startMin - b.startMin || a.endMin - b.endMin; });
    tpLanes(items).forEach(function (i) {
      var d = i.d, P = d.full, s0 = Math.max(i.startMin, T0), top = (s0 - T0) / 60 * H, ht = Math.max(22, (i.endMin - s0) / 60 * H - 3);
      var left = "calc(" + LW + "px + " + (i.lane / i.lanes) + " * (100% - " + LW + "px))", wd = "calc((100% - " + LW + "px) / " + i.lanes + " - 6px)";
      var cls = "tp-b", st = "top:" + top + "px;height:" + ht + "px;left:" + left + ";width:" + wd + ";";
      var warn = !!ov.map["p:" + P.id], ps = planStatus(P), stt = planState(P);
      if (ht > 70) cls += " tall"; if (ht < 44) cls += " short";
      if (i.lanes > 2) cls += " nar";
      if (warn) cls += " warn";
      cls += ps === "done" ? " done" : ps === "partial" ? " partial" : ps === "fail" ? " fail" : (ps === "wait" ? "" : " doing");
      if (d.cont) cls += " cont"; if (d.more) cls += " more"; if (P.eventId) cls += " evp";
      if (selId === P.id) cls += " sel";
      var ev = P.eventId ? events.filter(function (x) { return x.id === P.eventId; })[0] : null, evTxt = "";
      if (ev) { var dd = tpEvDday(ev); evTxt = " · " + kindInfo(kindOf(ev)).label + (dd ? " · " + dd : ""); }
      var icon = ps === "done" ? tpSi("done", '<path d="M4.5 10.5l3.6 3.6 7.4-8.2"/>') : ps === "partial" ? tpSi("part", '<path d="M10 4.2l6 11H4z"/>') : ps === "fail" ? tpSi("fail", '<path d="M5.5 5.5l9 9M14.5 5.5l-9 9"/>') : null;
      var kids = [h("b", null, [icon, P.title]), h("span", { class: "tm", text: (d.cont ? "이어짐 · " : "") + spanFull(P) + evTxt })];
      var el = h("button", { class: cls, style: st, type: "button", title: P.title + " (" + ({ done: "완료", partial: "절반", fail: "실패", wait: "대기", run: "집중 중", paused: "일시정지" }[ps]) + ")", "data-pid": P.id, "aria-pressed": selId === P.id ? "true" : "false",
        onclick: function () {
          if (TP.noClick) return;
          /* 데스크톱: 같은 계획을 0.4초 안에 두 번 누르면(더블클릭) 수정 팝업. 첫 클릭에서 화면이 다시 그려지므로 직접 센다. */
          var tnow = Date.now(); if (!tpMobile() && TP.lc && TP.lc.id === P.id && tnow - TP.lc.t < 400) { TP.lc = null; tpOpenTime(P.id); return; } TP.lc = { id: P.id, t: tnow };
          ui.pSel = P.id; ui.pDel = ""; if (tpMobile()) ui.pSheet = true; renderPlanView();
        } }, kids);
      if (!d.cont && !d.more && P.date === ui.pDate && ui.pDate >= todayStr() && stt !== "done") { el.classList.add("mv"); el.appendChild(h("span", { class: "rz", "aria-hidden": "true" })); tpDragInit(el, d, H); }
      if (warn) { var wi = h("span", { class: "wi", title: "시간 겹침" }); wi.innerHTML = TPI.alert; el.appendChild(wi); }
      grid.appendChild(el);
      if (P.focus) {
        var off = d.cont ? DAY_MIN : 0;
        var ax = "calc(" + LW + "px + " + ((i.lane + 1) / i.lanes) + " * (100% - " + LW + "px) - 20px)";
        var segs = focusSegments(P, now).map(function (g) { return { from: Math.max(g.from - off, T0), to: Math.min(g.to - off, T1), over: g.over }; }).filter(function (g) { return g.to > g.from; });
        if (P.focus.pauses.length && segs.length) {
          var a = segs[0].from, b = segs[segs.length - 1].to;
          grid.appendChild(h("i", { class: "tp-act span", style: "top:" + (a - T0) / 60 * H + "px;height:" + Math.max(4, (b - a) / 60 * H) + "px;left:" + ax, title: "쉰 시간 포함" }));
        }
        segs.forEach(function (g) {
          grid.appendChild(h("i", { class: "tp-act" + (g.over ? " over" : ""), style: "top:" + (g.from - T0) / 60 * H + "px;height:" + Math.max(4, (g.to - g.from) / 60 * H) + "px;left:" + ax,
            title: "집중 " + minToHm(g.from) + "–" + (isLive(P) && g === segs[segs.length - 1] ? "측정 중" : minToHm(g.to)) }));
        });
      }
    });
    if (isToday) {
      var nm = (now - dayStartMs(ui.pDate)) / 60000;
      if (nm >= T0 && nm <= T1) grid.appendChild(h("div", { class: "tp-nowline", style: "top:" + (nm - T0) / 60 * H + "px" }, [h("i"), h("span", { text: tmText(now) })]));
    }
  }

  /* ---------- 마우스 드래그: 계획 시간 이동 · 아래쪽 끝을 끌어 길이 조절 (15분 단위) ---------- */
  function tpDragInit(el, d, H) {
    el.addEventListener("touchstart", function (ev) {
      if (!tpMobile() || TP.drag || TP.lp || ev.touches.length !== 1) return;
      var t = ev.touches[0], lp = { el: el, d: d, H: H, x: t.clientX, y: t.clientY, active: false };
      lp.timer = setTimeout(function () { tpLpStart(lp); }, 450); TP.lp = lp;
    }, { passive: true });
    el.addEventListener("contextmenu", function (ev) { if (tpMobile()) ev.preventDefault(); });
    el.addEventListener("pointerdown", function (ev) {
      if (ev.pointerType !== "mouse" || ev.button !== 0 || TP.drag || tpMobile()) return;
      var sc = $("tpScroll"), rz = !!(ev.target.closest && ev.target.closest(".rz"));
      TP.drag = { id: d.id, el: el, mode: rz ? "resize" : "move", y0: ev.clientY, cx: ev.clientX, cy: ev.clientY, sc0: sc.scrollTop, s0: d.startMin, e0: d.endMin, s: d.startMin, e: d.endMin, moved: false, H: H, t0: TP.T0, tip: null, timer: setInterval(tpDragAuto, 40) };
      ev.preventDefault();
      window.addEventListener("pointermove", tpDragMove); window.addEventListener("pointerup", tpDragEnd); window.addEventListener("pointercancel", tpDragCancel);
    });
  }
  function tpScroller() { return tpMobile() ? $("main") : $("tpScroll"); }
  /* 모바일: 계획을 0.45초 꾹 누르면 끌어 옮길 수 있다(길이는 그대로, 시작 시각만 이동). 다른 계획과 겹치면 이동을 취소한다. */
  function tpLpStart(lp) {
    if (TP.lp !== lp || TP.drag) return;
    var sc = $("main"); lp.active = true;
    TP.drag = { id: lp.d.id, el: lp.el, mode: "move", touch: true, y0: lp.y, cx: lp.x, cy: lp.y, sc0: sc.scrollTop, s0: lp.d.startMin, e0: lp.d.endMin, s: lp.d.startMin, e: lp.d.endMin, moved: true, H: lp.H, t0: TP.T0, tip: null, timer: setInterval(tpDragAuto, 40) };
    lp.el.classList.add("ing"); document.body.classList.add("tp-dragging");
    try { if (navigator.vibrate) navigator.vibrate(15); } catch (e) {}
    tpDragCalc();
  }
  document.addEventListener("touchmove", function (ev) {
    var lp = TP.lp; if (!lp) return; var t = ev.touches[0]; if (!t) return;
    if (!lp.active) { if (Math.abs(t.clientX - lp.x) > 10 || Math.abs(t.clientY - lp.y) > 10) { clearTimeout(lp.timer); TP.lp = null; } return; }
    if (ev.cancelable) ev.preventDefault();
    var g = TP.drag; if (!g) return; g.cx = t.clientX; g.cy = t.clientY; tpDragCalc();
  }, { passive: false });
  function tpLpEnd(cancelled) {
    var lp = TP.lp; if (!lp) return; clearTimeout(lp.timer); TP.lp = null; if (!lp.active) return;
    var g = tpDragStop(); if (!g) return;
    TP.noClick = true; setTimeout(function () { TP.noClick = false; }, 450); TP.dragDirty = false;
    var p = tpPlan(g.id);
    if (cancelled === true || !p || g.s === g.s0) { renderPlanView(); return; }
    if (tpClash(p.date, g.s, g.e, p.id).length) { say("다른 계획과 시간이 겹쳐서 이동을 취소했어요.", true); renderPlanView(); return; }
    write(function () { return db.collection("plans").doc(p.id).update({ start: minToHm(g.s), end: minToHm(g.e), planMin: g.e - g.s, updatedAt: Date.now() }); }, "시작 시간을 " + minToHm(g.s) + "(으)로 옮겼어요.").then(function (ok) { if (!ok) renderPlanView(); });
  }
  document.addEventListener("touchend", function () { tpLpEnd(false); });
  document.addEventListener("touchcancel", function () { tpLpEnd(true); });
  function tpDragCalc() {
    var g = TP.drag, sc = tpScroller(), dy = (g.cy - g.y0) + (sc.scrollTop - g.sc0), dm = snap15(dy / g.H * 60), len = g.e0 - g.s0, s, e;
    if (!g.moved) { if (Math.abs(dy) < 4) return; g.moved = true; g.el.classList.add("ing"); document.body.classList.add("tp-dragging"); if (g.mode === "resize") document.body.classList.add("rs"); }
    if (g.mode === "move") { s = Math.min(Math.max(g.s0 + dm, g.t0), DAY_MIN - len); e = s + len; }
    else { s = g.s0; e = Math.min(Math.max(g.e0 + dm, g.s0 + 15), DAY_MIN); }
    g.s = s; g.e = e;
    var top = (Math.max(s, g.t0) - g.t0) / 60 * g.H, ht = Math.max(22, (e - Math.max(s, g.t0)) / 60 * g.H - 3);
    g.el.style.top = top + "px"; g.el.style.height = ht + "px";
    var tm = g.el.querySelector(".tm"); if (tm) tm.textContent = span2(s, e);
    if (!g.tip) { g.tip = h("div", { class: "tp-tip", role: "status" }); document.body.appendChild(g.tip); }
    g.tip.textContent = span2(s, e) + " · " + durText(e - s);
    if (g.touch) { g.tip.style.left = Math.max(8, Math.min(g.cx - 60, window.innerWidth - 168)) + "px"; g.tip.style.top = Math.max(4, g.cy - 78) + "px"; }
    else { g.tip.style.left = Math.min(g.cx + 14, window.innerWidth - 150) + "px"; g.tip.style.top = Math.max(4, g.cy - 32) + "px"; }
  }
  function tpDragMove(ev) { var g = TP.drag; if (!g) return; g.cx = ev.clientX; g.cy = ev.clientY; tpDragCalc(); }
  function tpDragAuto() {
    var g = TP.drag, sc = tpScroller(); if (!g || !g.moved || !sc) return;
    if (g.touch) { var vv = 0; if (g.cy > window.innerHeight - 120) vv = Math.min(16, (g.cy - (window.innerHeight - 120)) / 3 + 3); else if (g.cy < 110) vv = -Math.min(16, (110 - g.cy) / 3 + 3); if (vv) { sc.scrollTop += vv; tpDragCalc(); } return; }
    var r = sc.getBoundingClientRect(), v = 0;
    if (g.cy > r.bottom - 28) v = Math.min(18, (g.cy - (r.bottom - 28)) / 2 + 4); else if (g.cy < r.top + 28) v = -Math.min(18, ((r.top + 28) - g.cy) / 2 + 4);
    if (v) { sc.scrollTop += v; tpDragCalc(); }
  }
  function tpDragStop() {
    var g = TP.drag; if (!g) return null;
    clearInterval(g.timer); if (g.tip && g.tip.parentNode) g.tip.parentNode.removeChild(g.tip);
    window.removeEventListener("pointermove", tpDragMove); window.removeEventListener("pointerup", tpDragEnd); window.removeEventListener("pointercancel", tpDragCancel);
    document.body.classList.remove("tp-dragging"); document.body.classList.remove("rs"); g.el.classList.remove("ing");
    TP.drag = null; return g;
  }
  function tpDragCancel() { var g = tpDragStop(); if (g && g.moved) renderPlanView(); }
  function tpDragEnd() {
    var g = tpDragStop(); if (!g) return;
    if (g.moved) { TP.noClick = true; setTimeout(function () { TP.noClick = false; }, 60); }
    var p = tpPlan(g.id);
    if (!g.moved || !p || (g.s === g.s0 && g.e === g.e0)) { if (g.moved || TP.dragDirty) { TP.dragDirty = false; renderPlanView(); } return; }
    TP.dragDirty = false;
    write(function () { return db.collection("plans").doc(p.id).update({ start: minToHm(g.s), end: minToHm(g.e), planMin: g.e - g.s, updatedAt: Date.now() }); }, "계획 시간을 " + span2(g.s, g.e) + "(으)로 바꿨어요.").then(function (ok) { if (!ok) renderPlanView(); });
  }
  function tpScrollToNow(force) {
    var sc = $("tpScroll"); if (!sc) return;
    if (!force && sc.getAttribute("data-init") === ui.pDate) return;
    sc.setAttribute("data-init", ui.pDate);
    var H = tpH(), nm = ui.pDate === todayStr() ? (Date.now() - dayStartMs(ui.pDate)) / 60000 : 540;
    if (ui.pDate !== todayStr()) { var pcs = dayPieces(ui.pDate); if (pcs.length) nm = Math.max(0, Math.min.apply(null, pcs.map(function (x) { return x.startMin; })) - 30); }
    var y = (Math.min(Math.max(nm, TP.T0), TP.T1) - TP.T0) / 60 * H;
    if (tpMobile()) { var mn = $("main"), gb = $("tpGrid"); if (mn && gb) mn.scrollTop = Math.max(0, gb.getBoundingClientRect().top - mn.getBoundingClientRect().top + mn.scrollTop + y - 190); return; }
    sc.scrollTop = Math.max(0, y - 150);
  }

  function tpTodoList(p, canLink) {
    var linked = linkedTodosOf(p), n = linked.length, d = linked.filter(function (t) { return t.done; }).length;
    var tl = h("div", { class: "tl" }, []);
    if (!n) tl.appendChild(h("div", { class: "td none" }, [h("span", { class: "vsub", text: canLink ? "아직 연결한 할 일이 없어요. 아래 버튼으로 할 일을 골라 연결해요." : "연결한 할 일이 없어요." })]));
    linked.forEach(function (t) {
      var chk = h("button", { class: "check", type: "button", "aria-label": t.problem + (t.done ? " 완료됨" : " 완료로 표시"), "aria-pressed": t.done ? "true" : "false", onclick: function () { toggle(t); } });
      chk.innerHTML = CHECK;
      tl.appendChild(h("div", { class: "td" + (t.done ? " on" : "") }, [chk,
        h("span", { class: "tt" }, [h("span", { class: "a", text: tabLabel(t.tab) + (t.done && t.doneAt ? " · " + tmText(t.doneAt) + " 완료" : "") }), t.problem]),
        h("span", { class: "pill p" + t.priority, text: PRIO[t.priority] })]));
    });
    var thKids = [h("b", { text: "연결한 할 일" }), h("span", { text: n ? d + "/" + n + " 완료" : "0개" })];
    if (canLink) {
      var hb = iconEl("button", TPI.plus.replace('width="18" height="18"', 'width="16" height="16"'), { class: "btn sm only-m tp-linkbtn", type: "button", onclick: function () { tpOpenLink(p.id); } });
      hb.appendChild(document.createTextNode("할 일 연결"));
      thKids.push(hb);
    }
    var box = h("div", { class: "tp-todos", role: "group", "aria-label": "연결한 할 일" }, [h("div", { class: "th" }, thKids), tl]);
    if (canLink) {
      var btn = iconEl("button", TPI.plus.replace('width="18" height="18"', 'width="16" height="16"'), { class: "btn sm only-d", type: "button", onclick: function () { tpOpenLink(p.id); } });
      btn.appendChild(document.createTextNode("할 일 선택해서 연결"));
      box.appendChild(h("div", { class: "ta" }, [btn, n ? h("span", { class: "vsub", text: "체크하면 할 일 목록에도 완료로 반영돼요" }) : null]));
    }
    return box;
  }
  /* 완료 ↔ 절반 전환 칩. 두 상태의 글자 수·크기를 같게 해서 눌러도 레이아웃이 움직이지 않는다. */
  var SWAP_SVG = '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h11l-3-3M16 13H5l3 3"/></svg>';
  function tpResultPill(p, ps) {
    var b = h("button", { class: "pill tpst tp-pillbtn " + (ps === "done" ? "st-doing" : "st-part"), type: "button", title: "눌러서 ‘완료’와 ‘절반’을 바꿔요", "aria-label": (ps === "done" ? "완료" : "절반") + " (눌러서 전환)", onclick: function () { tpToggleResult(p); } }, [h("span", { class: "rt", text: ps === "done" ? "완료 ✓" : "절반 △" })]);
    var sw = h("span", { class: "sw" }); sw.innerHTML = SWAP_SVG; b.appendChild(sw);
    return b;
  }
  function tpPill(ps) {
    return ps === "paused" ? h("span", { class: "pill tpst st-warn", text: "일시정지" }) : ps === "run" ? h("span", { class: "pill tpst st-run", text: "집중 중" })
      : ps === "fail" ? h("span", { class: "pill tpst st-fail", text: "실패" }) : h("span", { class: "pill tpst p3", text: "대기" });
  }
  /* 완료 ↔ 부분 완료(△: 시작은 했지만 목표만큼 하지 못함) 전환. 둘 다 같은 ‘집중을 마친’ 계획이고 status 값만 다르다. */
  function tpToggleResult(p) {
    var to = p.status === "partial" ? "done" : "partial";
    write(function () { return db.collection("plans").doc(p.id).update({ status: to, updatedAt: Date.now() }); }, to === "partial" ? "절반(△)으로 바꿨어요. 달성도에 0.5로 계산돼요." : "완료로 바꿨어요.");
  }
  /* 모바일 하단 시트: 제목 → 상태·시간 → 수정/삭제 → 집중 패널(가장 큰 버튼) → 연결한 할 일 순서. 닫기는 바깥 영역을 누르거나 손잡이를 아래로 내려서. */
  function tpDetailM(p, now) {
    var box = $("tpDetail"); box.textContent = "";
    var stt = planState(p), ps = planStatus(p), canMove = p.date === ui.pDate && p.date >= todayStr() && stt !== "done" && p.endMin <= DAY_MIN;
    if (ui.pDel && ui.pDel !== p.id) ui.pDel = "";
    function btn(svg, label, cls, fn) { var b = iconEl("button", svg, { class: "btn" + (cls ? " " + cls : ""), type: "button", onclick: fn }); b.appendChild(document.createTextNode(label)); return b; }
    box.appendChild(h("button", { class: "grab", type: "button", "aria-label": "선택한 계획 닫기", onclick: tpCloseSheet }));
    box.appendChild(h("div", { class: "tp-mhead" }, [h("h3", { text: p.title })]));
    var ev = p.eventId ? events.filter(function (x) { return x.id === p.eventId; })[0] : null, chips = [];
    if (ps === "done" || ps === "partial") chips.push(tpResultPill(p, ps));
    else chips.push(tpPill(ps));
    if (ev) { var ki = kindInfo(kindOf(ev)), dd = tpEvDday(ev); chips.push(h("span", { class: "pill " + kcls(kindOf(ev)), text: ki.label + (dd ? " · " + dd : "") })); }
    chips.push(h("span", { class: "tp-tchip", text: spanFull(p) + " · " + durText(planLen(p)) }));
    box.appendChild(h("div", { class: "tp-mchips" }, chips));
    if (p.date !== ui.pDate) box.appendChild(h("div", { class: "vsub", text: dayLabel(p.date) + "에서 이어진 계획이에요. 완료·집중 기록은 시작한 날에 계산돼요." }));
    else if (p.endMin > DAY_MIN) box.appendChild(h("div", { class: "vsub", text: "자정을 넘어 " + dayLabel(nextKey(p.date)) + "까지 이어져요." }));
    var acts = [btn(TPI.edit, ev ? "시간 수정" : "수정", "", function () { tpOpenTime(p.id); })];
    if (p.date >= todayStr()) acts.push(btn(TPI.trash, "삭제", "dng", function () { ui.pDel = ui.pDel === p.id ? "" : p.id; renderPlanView(); }));
    box.appendChild(h("div", { class: "tp-mact" }, acts));
    if (ui.pDel === p.id) {
      var fm = p.focus ? msToMin(focusMs(p, now)) : 0;
      var dw = h("div", { class: "tp-warnbox", role: "alertdialog", "aria-label": "계획 삭제 확인" }, []);
      dw.innerHTML = TPI.alert;
      dw.appendChild(h("div", null, [h("b", { text: "정말 삭제할까요?" }), h("div", { class: "txt", text: p.focus ? "집중 기록(" + durText(fm) + ")도 함께 사라져요. 연결한 할 일은 그대로 남아요." : "연결한 할 일은 그대로 남아요." })]));
      dw.appendChild(h("div", { class: "btns" }, [h("button", { class: "btn sm danger", type: "button", text: "삭제", onclick: function () { tpDelete(p.id); } }), h("button", { class: "btn sm", type: "button", text: "취소", onclick: function () { ui.pDel = ""; renderPlanView(); } })]));
      box.appendChild(dw);
    }
    var panel = h("div", { class: "tp-mpanel" }, []);
    if (stt === "run" || stt === "paused") {
      panel.appendChild(h("div", { class: "tp-mtimer" }, [h("div", { class: "tp-big", style: stt === "paused" ? "color:var(--muted)" : "" }, [h("span", { "data-tpt": p.id, text: hmsText(focusMs(p, now)) })]), h("small", { text: (stt === "paused" ? "일시정지 중 · " : "집중 중 · ") + tmText(p.focus.startedAt) + " 시작" })]));
      if (stt === "paused") panel.appendChild(h("div", { class: "tp-mrow2" }, [btn(TPI.play, "이어서 집중", "primary", function () { tpStart(p.id); }), btn(TPI.stop, "집중 종료", "", function () { tpEnd(p.id); })]));
      else { panel.appendChild(h("div", { class: "tp-mrow2" }, [btn(TPI.pause, "일시정지", "primary", function () { tpPause(p.id); })])); panel.appendChild(h("div", { class: "vsub tp-mhint", text: "끝내려면 먼저 일시정지를 눌러 주세요." })); }
    } else if (stt === "done") {
      panel.appendChild(h("div", { class: "tp-mtimer" }, [h("div", { class: "tp-big", text: durText(msToMin(focusMs(p, now))) }), h("small", { text: tmText(p.focus.startedAt) + "–" + tmText(p.focus.endedAt) + " 집중" })]));
      panel.appendChild(h("div", { class: "vsub tp-mhint", text: "위의 상태 칩을 누르면 완료 ↔ 절반으로 바뀌어요. 절반은 달성도에 0.5로 계산돼요." }));
      panel.appendChild(h("div", { class: "tp-mrow2" }, [btn(TPI.edit, "집중 시간 수정", "", function () { tpOpenSess(p.id); })]));
    } else if (tpCanStart(p)) {
      panel.appendChild(h("div", { class: "tp-mrow2" }, [btn(TPI.play, "집중 시작", "primary", function () { tpStart(p.id); })]));
    } else if (ps === "fail") panel.appendChild(h("div", { class: "vsub", text: "집중 기록 없이 날짜가 지나 ‘실패’로 표시돼요." }));
    else panel.appendChild(h("div", { class: "vsub", text: "집중은 그날이 되면 시작할 수 있어요." }));
    if (canMove) panel.appendChild(h("div", { class: "vsub tp-mhint", text: "타임테이블에서 이 계획을 꾹 눌러 끌면 시작 시간을 옮겨요." }));
    box.appendChild(panel);
    var pills = tpTagPills(p, now); if (pills) box.appendChild(pills);
    if (stt === "done") { if (p.todoIds.length) box.appendChild(tpTodoList(p, false)); }
    else box.appendChild(tpTodoList(p, p.date >= todayStr()));
  }
  function tpDetail(p, now) {
    if (p && tpMobile()) { tpDetailM(p, now); return; }
    var box = $("tpDetail"); box.textContent = "";
    if (!p) { box.appendChild(h("div", { class: "lbl", text: "선택한 계획" })); box.appendChild(h("div", { class: "vsub", text: "타임테이블에서 계획을 누르면 여기에 나와요." })); return; }
    var stt = planState(p), ps = planStatus(p);
    if (ui.pDel && ui.pDel !== p.id) ui.pDel = "";
    var pill;
    if (ps === "done" || ps === "partial") {
      pill = tpResultPill(p, ps);
    } else pill = tpPill(ps);
    var right = [pill];
    if (p.date >= todayStr()) {
      var tr = h("button", { class: "icon-btn sm dng", type: "button", "aria-label": "계획 삭제", title: "계획 삭제", "aria-pressed": ui.pDel === p.id ? "true" : "false", onclick: function () { ui.pDel = ui.pDel === p.id ? "" : p.id; renderPlanView(); } });
      tr.innerHTML = TPI.trash; right.push(tr);
    }
    box.appendChild(h("button", { class: "grab", type: "button", "aria-label": "선택한 계획 닫기", onclick: tpCloseSheet }));
    box.appendChild(h("div", { class: "card-h" }, [h("div", null, [h("div", { class: "lbl", text: "선택한 계획" }), h("h3", { text: p.title })]), h("div", { class: "tp-hr2" }, right)]));
    var tline = [h("span", { class: "vsub", style: "font-family:var(--font-num);font-variant-numeric:tabular-nums", text: "계획 " + spanFull(p) + " · " + durText(planLen(p)) })];
    var te = iconEl("button", TPI.edit, { class: "btn sm only-m", type: "button", onclick: function () { tpOpenTime(p.id); } }); te.appendChild(document.createTextNode("수정")); tline.push(te);
    tline.push(h("span", { class: "vsub only-d", style: "font-size:12px", text: "계획을 더블클릭하면 고쳐요" }));
    box.appendChild(h("div", { class: "tp-tline" }, tline));
    if (p.date !== ui.pDate) box.appendChild(h("div", { class: "vsub", text: dayLabel(p.date) + "에서 이어진 계획이에요. 완료·집중 기록은 시작한 날에 계산돼요." }));
    else if (p.endMin > DAY_MIN) box.appendChild(h("div", { class: "vsub", text: "자정을 넘어 " + dayLabel(nextKey(p.date)) + "까지 이어져요. 다음 날에도 보여요." }));
    var ev = p.eventId ? events.filter(function (x) { return x.id === p.eventId; })[0] : null;
    if (ev) { var dd = tpEvDday(ev), ki = kindInfo(kindOf(ev)); box.appendChild(h("div", { class: "tp-pills" }, [h("span", { class: "pill " + kcls(kindOf(ev)), text: ki.label }), h("span", { class: "vsub", text: "일정에서 온 계획(점선)" + (dd ? " · " + dd : "") + " · 시간만 고칠 수 있어요" })])); }
    if (ui.pDel === p.id) {
      var fm = p.focus ? msToMin(focusMs(p, now)) : 0;
      var dw = h("div", { class: "tp-warnbox", role: "alertdialog", "aria-label": "계획 삭제 확인" }, []);
      dw.innerHTML = TPI.alert;
      dw.appendChild(h("div", null, [h("b", { text: "정말 삭제할까요?" }), h("div", { class: "txt", text: p.focus
        ? "‘" + p.title + "’의 집중 기록(" + durText(fm) + ")도 함께 사라져서 나중에 통계에 반영되지 않아요. 연결한 할 일은 그대로 남아요."
        : "‘" + p.title + "’ 계획을 삭제해요. 연결한 할 일은 그대로 남아요." })]));
      dw.appendChild(h("div", { class: "btns" }, [h("button", { class: "btn sm danger", type: "button", text: "삭제", onclick: function () { tpDelete(p.id); } }),
        h("button", { class: "btn sm", type: "button", text: "취소", onclick: function () { ui.pDel = ""; renderPlanView(); } })]));
      box.appendChild(dw);
    }
    function btn(svg, label, cls, fn) { var b = iconEl("button", svg, { class: "btn" + (cls ? " " + cls : ""), type: "button", onclick: fn }); b.appendChild(document.createTextNode(label)); return b; }
    if (stt === "run" || stt === "paused") {
      box.appendChild(h("div", { class: "tp-timer" }, [h("div", { class: "tp-big", style: stt === "paused" ? "color:var(--muted)" : "" }, [h("span", { "data-tpt": p.id, text: hmsText(focusMs(p, now)) }), h("small", { text: tmText(p.focus.startedAt) + " 시작" })])]));
      box.appendChild(h("div", { class: "tp-acts" }, stt === "paused"
        ? [btn(TPI.play, "이어서 집중", "primary", function () { tpStart(p.id); }), btn(TPI.stop, "집중 종료", "", function () { tpEnd(p.id); })]
        : [btn(TPI.pause, "일시정지", "primary", function () { tpPause(p.id); })]));
      if (stt === "run") box.appendChild(h("div", { class: "vsub", text: "집중을 끝내려면 먼저 일시정지를 눌러 주세요." }));
    } else if (stt === "done") {
      box.appendChild(h("div", { class: "tp-timer" }, [h("div", { class: "tp-big", style: "font-size:24px" }, [durText(msToMin(focusMs(p, now))), h("small", { text: tmText(p.focus.startedAt) + "–" + tmText(p.focus.endedAt) + " 집중" })])]));
      box.appendChild(h("div", { class: "vsub", text: "상태(완료/절반)를 눌러 바꿀 수 있어요. 절반은 달성도에 0.5로 계산돼요." }));
    } else if (tpCanStart(p)) {
      box.appendChild(h("div", { class: "tp-acts" }, [btn(TPI.play, "집중 시작", "primary", function () { tpStart(p.id); })]));
    } else if (ps === "fail") {
      box.appendChild(h("div", { class: "vsub", text: "집중 기록 없이 날짜가 지나 ‘실패’로 표시돼요." }));
    } else box.appendChild(h("div", { class: "vsub", text: "집중은 그날이 되면 시작할 수 있어요." }));
    var pills = tpTagPills(p, now); if (pills) box.appendChild(pills);
    if (stt === "done") box.appendChild(h("div", { class: "tp-acts" }, [btn(TPI.edit, "집중 시간 수정", "sm", function () { tpOpenSess(p.id); })]));
    if (stt === "done") { if (p.todoIds.length) box.appendChild(tpTodoList(p, false)); }
    else box.appendChild(tpTodoList(p, p.date >= todayStr()));
  }

  /* ---------- 팝업 4: 계획 이름·시간 수정 (0시~다음 날 24시, 자정을 넘는 계획도 가능) ---------- */
  var tpT = null;
  function tpOpenTime(id) {
    var p = tpPlan(id); if (!p) return;
    var editable = p.date >= todayStr() && planState(p) !== "done";
    tpT = { id: id, title: p.title, fromEv: !!p.eventId, editable: editable, start: minToHm(p.startMin), end: minToHm(p.endMin > DAY_MIN ? p.endMin - DAY_MIN : p.endMin), msg: "", warned: false };
    tpRenderTime(); $("tpTimeModal").hidden = false;
  }
  function tpCloseTime() { $("tpTimeModal").hidden = true; tpT = null; }
  function tpRenderTime() {
    var t = tpT, p = tpPlan(t.id), s = $("tpTimeSheet"); s.textContent = "";
    if (!p) { tpCloseTime(); return; }
    s.appendChild(h("div", { class: "sh full" }, [h("h3", { id: "tpTimeTitle", text: t.fromEv ? "계획 시간 수정" : (t.editable ? "계획 이름·시간 수정" : "계획 이름 수정") }), tpCloseBtn(tpCloseTime)]));
    s.appendChild(h("div", { class: "full vsub", text: dayLabel(p.date) }));
    if (t.fromEv) {
      var ev0 = events.filter(function (x) { return x.id === p.eventId; })[0], ki = ev0 ? kindInfo(kindOf(ev0)) : null;
      s.appendChild(h("div", { class: "full tp-evname" }, [h("span", { class: "a", text: "일정에서 온 계획 · 이름은 일정에서 바꿔요" }), h("b", { text: p.title }), ki ? h("span", { class: "pill " + kcls(kindOf(ev0)), text: ki.label }) : ""]));
    } else {
      var f = h("div", { class: "field full" }, [h("label", { for: "tpTTitle", text: "계획 이름" })]);
      var ti = h("input", { id: "tpTTitle", type: "text", maxlength: "80", autocomplete: "off" }); ti.value = t.title;
      ti.addEventListener("input", function () { t.title = ti.value; t.msg = ""; });
      ti.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); tpTimeSave(); } });
      f.appendChild(ti); s.appendChild(f);
    }
    if (t.editable) tpTimeFields(s, t, "tpT", tpRenderTime);
    else s.appendChild(h("div", { class: "full vsub", text: "계획 " + spanFull(p) + " · " + durText(planLen(p)) + " — 집중을 마쳤거나 지난 계획은 시간을 고칠 수 없어요. (집중 시간은 ‘집중 시간 수정’에서)" }));
    s.appendChild(h("div", { class: "msg full", role: "alert", text: t.msg || "" }));
    s.appendChild(h("div", { class: "actions full" }, [h("button", { class: "btn", type: "button", text: "취소", onclick: tpCloseTime }), h("button", { class: "btn primary", type: "button", text: t.warned ? "그래도 저장" : "저장", onclick: tpTimeSave })]));
  }
  function tpTimeSave() {
    var t = tpT; if (!t) return; var p = tpPlan(t.id); if (!p) { tpCloseTime(); return; }
    var title = t.fromEv ? p.title : String(t.title || "").trim();
    if (!title) { t.msg = "계획 이름을 입력해 주세요."; tpRenderTime(); return; }
    if (!t.fromEv && tpSecretCheck(title)) { t.msg = SECRET_MSG; tpRenderTime(); return; }
    var upd = {}, parts = [];
    if (title !== p.title) { upd.title = title; parts.push("이름"); }
    if (t.editable) {
      var s0 = hmToMin(t.start), e0 = tpEndOf(t);
      if (s0 == null || e0 == null) { t.msg = "시작과 종료 시간을 정해 주세요."; tpRenderTime(); return; }
      if (s0 !== p.startMin || e0 !== p.endMin) {
        var clash = tpClash(p.date, s0, e0, p.id);
        if (clash.length && !t.warned) {
          t.warned = true;
          t.msg = "겹치는 시간이 있어요: " + clash.slice(0, 3).map(function (o) { return o.t + " " + span2(o.s, o.e); }).join(", ") + (clash.length > 3 ? " 외 " + (clash.length - 3) + "개" : "") + ". 그래도 저장하려면 한 번 더 눌러 주세요.";
          tpRenderTime(); return;
        }
        upd.start = minToHm(s0); upd.end = minToHm(e0); upd.planMin = e0 - s0; parts.push("시간");
      }
    }
    if (!parts.length) { tpCloseTime(); return; }
    upd.updatedAt = Date.now();
    write(function () { return db.collection("plans").doc(p.id).update(upd); }, "계획 " + parts.join("·") + "을(를) 바꿨어요.").then(function (ok) {
      if (!ok) { t.msg = "저장하지 못했어요. 잠시 후 다시 시도해 주세요."; tpRenderTime(); return; }
      ui.pSel = p.id; tpCloseTime(); renderPlanView();
    });
  }

  /* ---------- 계획 삭제 · 모바일 시트와 하단 바 ---------- */
  function tpDelete(id) {
    var p = tpPlan(id); if (!p) return;
    if (p.date < todayStr()) { say("지난 날짜의 계획은 삭제할 수 없어요.", true); ui.pDel = ""; renderPlanView(); return; }
    var t = p.title; ui.pDel = ""; ui.pSel = null; ui.pSheet = false;
    write(function () { return db.collection("plans").doc(p.id).delete(); }, "계획을 삭제했어요: " + t).then(function () { renderPlanView(); });
  }
  function tpOpenSheet() { ui.pSheet = true; renderPlanView(); }
  function tpCloseSheet() { ui.pSheet = false; renderPlanView(); }
  $("tpMScrim").addEventListener("click", tpCloseSheet);
  (function () {
    var box = $("tpDetail"), sw = null;
    box.addEventListener("touchstart", function (e) {
      if (!tpMobile() || e.touches.length !== 1 || !e.target.closest || !e.target.closest(".grab, .tp-mhead")) return;
      sw = { y: e.touches[0].clientY, dy: 0 }; box.style.transition = "none";
    }, { passive: true });
    box.addEventListener("touchmove", function (e) {
      if (!sw) return; sw.dy = Math.max(0, e.touches[0].clientY - sw.y); box.style.transform = "translateY(" + sw.dy + "px)";
    }, { passive: true });
    function fin() {
      if (!sw) return; var dy = sw.dy; sw = null; box.style.transition = ""; box.style.transform = "";
      if (dy > 70) tpCloseSheet();
    }
    box.addEventListener("touchend", fin); box.addEventListener("touchcancel", fin);
  })();
  function tpDock(sel, now) {
    var d = $("tpDock"); d.textContent = "";
    var show = !!sel && !ui.pSheet && ui.view === "plan";
    $("tpMScrim").hidden = !(ui.pSheet && ui.view === "plan");
    $("tpDetail").classList.toggle("m-open", !!ui.pSheet && ui.view === "plan");
    d.hidden = !show; if (!show) return;
    var stt = planState(sel), ps = planStatus(sel), lab = { run: "지금 집중", paused: "일시정지", done: "완료", partial: "절반", fail: "실패", wait: "선택한 계획" }[ps];
    function ib(svg, label, cls, fn) { var b = h("button", { class: "icon-btn" + (cls ? " " + cls : ""), type: "button", "aria-label": label, title: label, onclick: fn }); b.innerHTML = svg; return b; }
    d.appendChild(h("button", { class: "grab", type: "button", "aria-label": "선택한 계획 열기", onclick: tpOpenSheet }));
    d.appendChild(h("button", { class: "dk-i", type: "button", "aria-label": lab + ": " + sel.title + " (눌러서 자세히 보기)", onclick: tpOpenSheet }, [h("small", { text: lab }), h("b", { text: sel.title })]));
    if (stt === "run" || stt === "paused") {
      d.appendChild(h("span", { class: "dk-t", "data-tpt": sel.id, style: stt === "paused" ? "color:var(--muted)" : "", text: hmsText(focusMs(sel, now)) }));
      if (stt === "paused") { d.appendChild(ib(TPI.play, "이어서 집중", "primary", function () { tpStart(sel.id); })); d.appendChild(ib(TPI.stop, "집중 종료", "", function () { tpEnd(sel.id); })); }
      else d.appendChild(ib(TPI.pause, "일시정지", "primary", function () { tpPause(sel.id); }));
    } else if (stt === "done") {
      d.appendChild(h("span", { class: "dk-t sm", text: durText(msToMin(focusMs(sel, now))) }));
    } else if (tpCanStart(sel)) {
      var sb = iconEl("button", TPI.play, { class: "btn primary dk-b", type: "button", onclick: function () { tpStart(sel.id); } }); sb.appendChild(document.createTextNode("집중 시작")); d.appendChild(sb);
    }
  }

  /* 이 날(오늘·앞으로)의 시간이 정해진 일정은 기본으로 계획이 되어 타임테이블에 나온다. 사용자가 ‘제외’한 일정은 다시 만들지 않는다. */
  var autoBusy = {};
  function tpAutoEvents() {
    if (!db || !plLoaded || !evLoaded || ui.pDate < todayStr()) return;
    var key = ui.pDate;
    events.forEach(function (e) {
      if (e.date !== key || !tpEvTimed(e)) return;
      var bk = key + "|" + e.id;
      if (autoBusy[bk] || plans.some(function (p) { return p.eventId === e.id && p.date === key; }) || exPlans.some(function (p) { return p.eventId === e.id && p.date === key; })) return;
      autoBusy[bk] = 1;
      var s0 = hmToMin(e.time), now = Date.now();
      Promise.resolve().then(function () {
        return db.collection("plans").add({ date: key, title: String(e.title), start: minToHm(s0), end: minToHm(s0 + EV_DEFAULT_MIN), planMin: EV_DEFAULT_MIN, eventId: e.id, todoIds: [], tabs: [], carriedFrom: "", focus: null, status: "wait", createdAt: now, updatedAt: now });
      }).catch(function () {}).then(function () { setTimeout(function () { delete autoBusy[bk]; }, 3000); });
    });
  }
  function renderPlanView() {
    if (TP.drag) { TP.dragDirty = true; return; }
    tpAutoEvents();
    tpPlaceDetail();
    if (!$("tpGrid")) return;
    var now = Date.now(), isToday = ui.pDate === todayStr();
    var list = plansOf(ui.pDate), pieces = dayPieces(ui.pDate), ov = overlapsOf(pieces, ui.pDate);
    var sel = tpSelected(pieces.map(function (x) { return x.full; }), now);
    TP.T0 = tpRange(pieces);
    $("tpRange").textContent = minToHm(TP.T0) + " – 24:00";
    tpDateRow(isToday);
    tpSumCard(list, dayStats(list, now), isToday);
    tpNotes(pieces, ov, now, isToday);
    tpGrid(pieces, ov, now, isToday, sel ? sel.id : null);
    tpDetail(sel, now);
    tpDock(sel, now);
    tpScrollToNow(false);
  }
  /* 1초마다 집중 타이머 글자만 바꾸고, 30초마다 화면 전체를 다시 그려 현재 시각선과 집중 막대를 갱신 */
  setInterval(function () {
    if (!ready || ui.view !== "plan") return;
    TP.tick++;
    if (TP.tick % 30 === 0) { renderPlanView(); return; }
    var now = Date.now();
    qsa("[data-tpt]").forEach(function (el) {
      var p = plans.filter(function (x) { return x.id === el.getAttribute("data-tpt"); })[0];
      if (p) el.textContent = hmsText(focusMs(p, now));
    });
  }, 1000);

  /* ---------- 계획 · 집중 저장 도우미 ---------- */
  /* 통계용으로 최상위 필드에 합계를 함께 저장한다: planMin(계획 길이), focusMin·restMin(집중이 끝난 뒤의 집중·쉰 시간), tabs(연결한 할 일의 문서 탭 key) */
  function tpFocusFields(f) {
    if (f && f.endedAt != null) { var q = { focus: f }; return { focusMin: msToMin(focusMs(q, f.endedAt)), restMin: msToMin(restMs(q, f.endedAt)) }; }
    return { focusMin: { __delete__: true }, restMin: { __delete__: true } };
  }
  function tpTabsOf(ids) {
    var out = [];
    ids.forEach(function (id) { var t = items.filter(function (x) { return x.id === id; })[0]; if (t && t.tab && out.indexOf(t.tab) < 0) out.push(t.tab); });
    return out;
  }
  function tpCloseBtn(fn) { var b = h("button", { type: "button", class: "icon-btn sm", "aria-label": "닫기", onclick: fn }); b.innerHTML = '<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15"/></svg>'; return b; }
  function tpPickField(label, inputId, hm, opts, onSet) {
    var inp = h("input", { type: "hidden", id: inputId }); inp.value = hm || "";
    var btn = iconEl("button", TPI.clock, { type: "button", class: "pick" + (opts && opts.cls ? " " + opts.cls : ""), "aria-label": label + " 선택",
      onclick: function () { openPick("time", inputId, Object.assign({ onSet: onSet }, opts || {})); } });
    btn.appendChild(h("span", { class: "pv" + (hm ? "" : " ph"), text: hm ? (opts && opts.show ? opts.show(hm) : hm) : ((opts && opts.empty) || "시간 선택") }));
    return h("div", { class: "field" + (opts && opts.full ? " full" : "") }, [h("label", { text: label }), inp, btn]);
  }
  /* 비밀번호·키·주민등록번호·계좌번호는 저장하지 않는다 (입력하면 경고하고 막는다) */
  function tpSecretCheck(text) {
    var t = String(text || "");
    return /\d{6}[- ]?[1-4]\d{6}/.test(t) || /(비밀번호|패스워드|password|passwd|\bpw\b)\s*[:=]?\s*\S{3,}/i.test(t) ||
      /(api[_ -]?key|secret|token|토큰|시크릿)\s*[:=]\s*\S+/i.test(t) || /[A-Za-z0-9_\-]{32,}/.test(t) || /(계좌|account)\D{0,8}\d[\d\- ]{8,}/i.test(t);
  }
  var SECRET_MSG = "비밀번호·키·주민등록번호·계좌번호는 저장하지 않아요. 지우고 다시 입력해 주세요.";
  /* 같은 날 조각(전날에서 이어진 것 포함) + 자정을 넘는 경우 다음 날 조각(+24시간)을 모두 모은다 */
  function tpOccupied(key, exceptId, skipEv) {
    var out = [];
    evSlots(key).forEach(function (v) { if ((v.own && v.own === exceptId) || (skipEv && skipEv[v.id])) return; out.push({ s: v.startMin, e: v.endMin, t: v.title + " (일정)" }); });
    dayPieces(key).forEach(function (d) { if (d.full.id !== exceptId) out.push({ s: d.startMin, e: d.endMin, t: d.full.title }); });
    dayPieces(nextKey(key)).forEach(function (d) { if (d.full.id !== exceptId && !d.cont) out.push({ s: d.startMin + DAY_MIN, e: d.endMin + DAY_MIN, t: d.full.title }); });
    return out;
  }
  function tpClash(key, s, e, exceptId, skipEv) { return tpOccupied(key, exceptId, skipEv).filter(function (o) { return s < o.e && o.s < e; }); }
  function tpFreeSlot(key, len, from, exceptId) {
    var occ = tpOccupied(key, exceptId);
    for (var s = Math.ceil(from / 15) * 15; s < DAY_MIN && s + len <= MAX_END; s += 15) {
      if (!occ.some(function (o) { return s < o.e && o.s < s + len; })) return s;
    }
    return null;
  }
  /* 종료 시각은 ‘시각’만 고른다. 시작보다 이르거나 같으면 다음 날 그 시각에 끝나는 것으로 본다. */
  function tpEndOf(o) {
    var s0 = hmToMin(o.start), e0 = hmToMin(o.end);
    if (s0 == null || e0 == null || s0 >= DAY_MIN) return null;
    if (e0 <= s0) e0 += DAY_MIN;
    return e0 <= MAX_END ? e0 : null;
  }
  function tpEndShow(startHm) { return function (hm) { var e0 = hmToMin(hm), s0 = hmToMin(startHm); return (s0 != null && e0 != null && e0 <= s0 ? "다음 날 " : "") + (hm === "24:00" ? "24:00" : hm); }; }
  function tpModHm(m) { if (m === DAY_MIN) return "24:00"; return minToHm(m % DAY_MIN); }
  /* 시작·종료 선택 칸 두 개와 합계 문구 (계획 추가·수정 팝업이 함께 쓴다) */
  function tpTimeFields(host, o, pre, rerender) {
    host.appendChild(tpPickField("시작", pre + "Start", o.start, { step: 15, required: true }, function (v) {
      var oldS = hmToMin(o.start), e0 = hmToMin(o.end), wasOver = oldS != null && e0 != null && e0 <= oldS, ns = hmToMin(v);
      o.start = v; o.warned = false; o.msg = "";
      if (e0 == null || (!wasOver && ns != null && e0 <= ns)) o.end = tpModHm((ns == null ? 540 : ns) + 60);
      rerender();
    }));
    host.appendChild(tpPickField("종료", pre + "End", o.end, { step: 15, required: true, allow24: true, show: tpEndShow(o.start) }, function (v) { o.end = v; o.warned = false; o.msg = ""; rerender(); }));
    var e1 = tpEndOf(o), s1 = hmToMin(o.start);
    host.appendChild(h("div", { class: "full vsub tp-tsum", text: e1 != null && s1 != null ? span2(s1, e1) + " · " + durText(e1 - s1) + (e1 > DAY_MIN ? " · 자정을 넘어 다음 날에도 보여요" : "") : "시작과 종료를 정해 주세요." }));
  }
  function tpStartFrom(key) { if (key === todayStr()) { var n = new Date(); return Math.max(360, n.getHours() * 60 + n.getMinutes()); } return 540; }
  function tpGuardEdit() { if (ui.pDate < todayStr()) { say("지난 날짜에는 계획을 추가할 수 없어요.", true); return false; } return true; }

  /* ---------- 팝업 1: 계획 추가 ---------- */
  var tpA = null;
  var QLEN = [[30, "30분"], [60, "1시간"], [90, "1시간 30분"], [120, "2시간"]];
  function tpOpenAdd() {
    if (!tpGuardEdit()) return;
    var from = tpStartFrom(ui.pDate), s = tpFreeSlot(ui.pDate, 60, from);
    if (s == null) s = Math.min(from, DAY_MIN - 60);
    tpA = { tab: "own", evSel: {}, title: "", start: minToHm(s), end: tpModHm(s + 60), msg: "", warned: false };
    tpDayEvents().forEach(function (e) { if (tpEvPlan(e)) tpA.evSel[e.id] = 1; });
    tpRenderAdd(); $("tpAddModal").hidden = false;
    setTimeout(function () { var i = $("tpATitle"); if (i) i.focus(); }, 30);
  }
  function tpCloseAdd() { $("tpAddModal").hidden = true; tpA = null; }
  function tpDayEvents() { return events.filter(function (e) { return e.date === ui.pDate; }).sort(function (a, b) { return (a.time || "99:99") < (b.time || "99:99") ? -1 : 1; }); }
  function tpEvTimed(e) { var m = hmToMin(e.time); return m != null && m < DAY_MIN; }
  function tpEvPlan(e) { return plansOf(ui.pDate).filter(function (p) { return p.eventId === e.id; })[0] || null; }
  function tpSetTab(tab) { tpA.tab = tab; tpA.msg = ""; tpA.warned = false; tpRenderAdd(); }
  function tpRenderAdd() {
    var a = tpA, s = $("tpAddSheet"); s.textContent = "";
    s.appendChild(h("div", { class: "sh full" }, [h("h3", { id: "tpAddTitle", text: "계획 추가" }), tpCloseBtn(tpCloseAdd)]));
    s.appendChild(h("div", { class: "full vsub", text: dayLabel(ui.pDate) }));
    s.appendChild(h("div", { class: "full" }, [h("div", { class: "seg", role: "group", "aria-label": "추가 방법" }, [
      h("button", { type: "button", "aria-pressed": a.tab === "own" ? "true" : "false", text: "직접 입력", onclick: function () { tpSetTab("own"); } }),
      h("button", { type: "button", "aria-pressed": a.tab === "ev" ? "true" : "false", text: ui.pDate === todayStr() ? "오늘 일정에서" : "이 날 일정에서", onclick: function () { tpSetTab("ev"); } })])]));
    var body = h("div", { class: "full tp-addbody" }, []);
    var note;
    if (a.tab === "ev") {
      var evs = tpDayEvents(), timed = evs.filter(tpEvTimed), nSel = timed.filter(function (e) { return a.evSel[e.id]; }).length;
      var free = timed.filter(function (e) { var pl = tpEvPlan(e); return !(pl && pl.focus); }), all = free.length && free.every(function (e) { return a.evSel[e.id]; });
      if (!evs.length) body.appendChild(h("div", { class: "vsub tp-evempty", text: "이 날 등록된 일정이 없어요." }));
      else {
        body.appendChild(h("div", { class: "tp-evhead full" }, [h("span", { class: "vsub", text: "타임테이블에 보일 일정 " + nSel + "/" + timed.length }),
          h("button", { type: "button", class: "btn sm", text: all ? "전체 해제" : "전체 선택", onclick: function () { free.forEach(function (e) { if (all) delete a.evSel[e.id]; else a.evSel[e.id] = 1; }); a.warned = false; a.msg = ""; tpRenderAdd(); } })]));
        var list = h("div", { class: "tp-list full" }, []);
        evs.forEach(function (e) {
          var ki = kindInfo(kindOf(e)), has = tpEvTimed(e), pl = tpEvPlan(e), locked = !!(pl && pl.focus), off = !has || locked, sel = has && !!a.evSel[e.id];
          var rd = h("span", { class: "rd" }); rd.innerHTML = CHECK;
          var dd = (e.kind === "deadline" || e.kind === "interview") ? " · " + dLabel(e.date) : "";
          var when = has ? span2(hmToMin(e.time), hmToMin(e.time) + EV_DEFAULT_MIN) : "시간 미정";
          var attrs = { type: "button", class: "tp-pickrow" + (sel ? " sel" : "") + (locked ? " added" : (off ? " off" : "")), "aria-pressed": sel ? "true" : "false", onclick: function () {
            if (off) return; if (a.evSel[e.id]) delete a.evSel[e.id]; else a.evSel[e.id] = 1; a.warned = false; a.msg = ""; tpRenderAdd(); } };
          if (off) attrs.disabled = "disabled";
          list.appendChild(h("button", attrs, [rd,
            h("span", null, [h("span", { class: "a", text: when + dd + (locked ? " · 집중 기록이 있어 유지돼요" : (!has ? " · 시간을 먼저 정해 주세요" : "")) }), h("span", { class: "tt", text: e.title })]),
            h("span", { class: "pill " + kcls(kindOf(e)), text: ki.label })]));
        });
        body.appendChild(list);
      }
      note = "체크한 일정은 타임테이블에 점선 계획으로 보여요. 해제하면 타임테이블에서 빠지고, 적용을 눌러야 반영돼요.";
    } else {
      var f = h("div", { class: "field full" }, [h("label", { for: "tpATitle", text: "제목" })]);
      var ti = h("input", { id: "tpATitle", type: "text", maxlength: "80", placeholder: "무엇을 할 계획인가요?", autocomplete: "off" }); ti.value = a.title;
      ti.addEventListener("input", function () { a.title = ti.value; a.warned = false; });
      ti.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); tpSubmitAdd(); } });
      f.appendChild(ti); body.appendChild(f);
      var e1 = tpEndOf(a), s1 = hmToMin(a.start), len = e1 != null && s1 != null ? e1 - s1 : 0;
      var chips = h("div", { class: "qchips full", "aria-label": "길이 빠른 선택" }, QLEN.map(function (q) {
        var b = h("button", { type: "button", class: "qc", text: q[1], onclick: function () {
          var s0 = hmToMin(a.start); if (s0 == null) { s0 = tpFreeSlot(ui.pDate, q[0], tpStartFrom(ui.pDate)); if (s0 == null) s0 = 360; }
          a.start = minToHm(s0); a.end = tpModHm(s0 + q[0]); a.warned = false; a.msg = ""; tpRenderAdd(); } });
        if (len === q[0]) b.setAttribute("style", "background:var(--accent-soft);color:var(--accent-ink);border-color:transparent");
        return b;
      }));
      chips.appendChild(h("button", { type: "button", class: "qc ghost", text: "빈 시간 맞추기", onclick: function () {
        var l = len > 0 ? len : 60, from = hmToMin(a.start) != null ? hmToMin(a.start) : tpStartFrom(ui.pDate), s0 = tpFreeSlot(ui.pDate, l, from);
        if (s0 == null) s0 = tpFreeSlot(ui.pDate, l, 0);
        if (s0 == null) { a.msg = "들어갈 빈 시간이 없어요."; tpRenderAdd(); return; }
        a.start = minToHm(s0); a.end = tpModHm(s0 + l); a.warned = false; a.msg = ""; tpRenderAdd(); } }));
      body.appendChild(chips);
      tpTimeFields(body, a, "tpA", tpRenderAdd);
      note = "종료가 시작보다 이르면 다음 날 그 시각에 끝나요. 할 일은 계획을 만든 뒤 언제든 연결해요.";
    }
    s.appendChild(body);
    s.appendChild(h("div", { class: "full vsub tpa-note", text: note }));
    s.appendChild(h("div", { class: "msg full keep", role: "alert", text: a.msg || "" }));
    var go = a.tab === "ev" ? h("button", { class: "btn primary", type: "button", text: a.warned ? "그래도 적용" : "적용", onclick: tpApplyEvents }) : h("button", { class: "btn primary", type: "button", text: a.warned ? "그래도 담기" : "계획 추가", onclick: tpSubmitAdd });
    s.appendChild(h("div", { class: "actions full" }, [h("button", { class: "btn", type: "button", text: "취소", onclick: tpCloseAdd }), go]));
  }
  /* 일정에서: 체크한 일정만 타임테이블에 둔다. 새로 체크한 것은 계획으로 만들고(제외했던 것은 되살리고), 체크를 푼 것은 타임테이블에서 뺀다. */
  function tpApplyEvents() {
    var a = tpA; if (!a) return;
    var timed = tpDayEvents().filter(tpEvTimed), adds = [], rems = [];
    timed.forEach(function (e) {
      var pl = tpEvPlan(e), want = !!a.evSel[e.id];
      if (want && !pl) adds.push(e); else if (!want && pl && !pl.focus) rems.push(pl);
    });
    if (!adds.length && !rems.length) { tpCloseAdd(); return; }
    var clash = [], skipEv = {};
    adds.forEach(function (e) { skipEv[e.id] = 1; });
    adds.forEach(function (e, i) {
      var s0 = hmToMin(e.time), en = s0 + EV_DEFAULT_MIN;
      tpClash(ui.pDate, s0, en, "", skipEv).forEach(function (o) { if (!rems.some(function (r) { return r.title === o.t && r.startMin === o.s; })) clash.push(e.title + " ↔ " + o.t + " " + span2(o.s, o.e)); });
      adds.slice(i + 1).forEach(function (o) { var s2 = hmToMin(o.time); if (s0 < s2 + EV_DEFAULT_MIN && s2 < en) clash.push(e.title + " ↔ " + o.title); });
    });
    if (clash.length && !a.warned) {
      a.warned = true;
      a.msg = "겹치는 시간이 있어요: " + clash.slice(0, 2).join(", ") + (clash.length > 2 ? " 외 " + (clash.length - 2) + "개" : "") + ". 그래도 적용하려면 한 번 더 눌러 주세요.";
      tpRenderAdd(); return;
    }
    var now = Date.now(), firstId = "";
    write(function () {
      return Promise.all(adds.map(function (e, i) {
        var ex = exPlans.filter(function (x) { return x.eventId === e.id && x.date === ui.pDate; })[0];
        if (ex) return db.collection("plans").doc(ex.id).update({ excluded: { __delete__: true }, updatedAt: now });
        var s0 = hmToMin(e.time);
        return db.collection("plans").add({ date: ui.pDate, title: String(e.title), start: minToHm(s0), end: minToHm(s0 + EV_DEFAULT_MIN), planMin: EV_DEFAULT_MIN, eventId: e.id, todoIds: [], tabs: [], carriedFrom: "", focus: null, status: "wait", createdAt: now + i, updatedAt: now + i }).then(function (r) { if (!firstId && r && r.id) firstId = r.id; });
      }).concat(rems.map(function (pl) { return db.collection("plans").doc(pl.id).update({ excluded: true, todoIds: [], tabs: [], updatedAt: now }); })));
    }, "일정 " + (adds.length ? adds.length + "개를 타임테이블에 넣었어요" : "") + (adds.length && rems.length ? ", " : "") + (rems.length ? rems.length + "개를 뺐어요" : "") + ".").then(function (ok) {
      if (!ok) { a.msg = "저장하지 못했어요. 잠시 후 다시 시도해 주세요."; tpRenderAdd(); return; }
      if (rems.some(function (r) { return r.id === ui.pSel; })) { ui.pSel = null; ui.pSheet = false; }
      tpCloseAdd(); renderPlanView();
    });
  }
  function tpSubmitAdd() {
    var a = tpA; if (!a) return;
    if (a.tab === "ev") { tpApplyEvents(); return; }
    var title = String(a.title || "").trim(), s = hmToMin(a.start), e = 0;
    if (!title) { a.msg = "제목을 입력해 주세요."; tpRenderAdd(); return; }
    if (tpSecretCheck(title)) { a.msg = SECRET_MSG; tpRenderAdd(); return; }
    if (s == null || hmToMin(a.end) == null) { a.msg = "시작과 종료 시간을 정해 주세요."; tpRenderAdd(); return; }
    e = tpEndOf(a); if (e == null) { a.msg = "시작과 종료 시간을 확인해 주세요."; tpRenderAdd(); return; }
    var clash = tpClash(ui.pDate, s, e, "");
    if (clash.length && !a.warned) {
      a.warned = true;
      a.msg = "겹치는 시간이 있어요: " + clash.slice(0, 3).map(function (o) { return o.t + " " + span2(o.s, o.e); }).join(", ") + (clash.length > 3 ? " 외 " + (clash.length - 3) + "개" : "") + ". 그래도 담으려면 한 번 더 눌러 주세요.";
      tpRenderAdd(); return;
    }
    var now = Date.now(), newId = "";
    var doc = { date: ui.pDate, title: title, start: minToHm(s), end: minToHm(e), planMin: e - s, eventId: "", todoIds: [], tabs: [], carriedFrom: "", focus: null, status: "wait", createdAt: now, updatedAt: now };
    write(function () { return db.collection("plans").add(doc).then(function (r) { newId = r && r.id ? r.id : ""; }); }, "계획을 추가했어요: " + title).then(function (ok) {
      if (!ok) { a.msg = "저장하지 못했어요. 잠시 후 다시 시도해 주세요."; tpRenderAdd(); return; }
      if (newId) ui.pSel = newId;
      tpCloseAdd(); renderPlanView();
    });
  }
  /* 어제 계획 전체를 이 날로 복사한다 (집중 기록·연결한 할 일은 비우고, 같은 제목·시작이 이미 있으면 건너뜀) */
  function tpCarryOver() {
    if (!tpGuardEdit()) return;
    var src = tpShiftDate(-1), from = plansOf(src), cur = plansOf(ui.pDate);
    if (!from.length) { say("어제 계획이 없어요."); return; }
    var add = from.filter(function (p) { return !p.eventId && !cur.some(function (c) { return c.title === p.title && c.startMin === p.startMin; }); });
    if (!add.length) { say("이미 모두 가져왔어요."); return; }
    var now = Date.now();
    write(function () {
      return Promise.all(add.map(function (p) {
        return db.collection("plans").add({ date: ui.pDate, title: p.title, start: minToHm(p.startMin), end: minToHm(p.endMin), planMin: planLen(p), eventId: "", todoIds: [], tabs: [], carriedFrom: p.id, focus: null, status: "wait", createdAt: now, updatedAt: now });
      }));
    }, "어제 계획 " + add.length + "개를 가져왔어요.");
  }

  /* ---------- 팝업 2: 할 일 연결 ---------- */
  var tpL = null;
  function tpOpenLink(planId) {
    var p = tpPlan(planId); if (!p) return;
    tpL = { planId: planId, cat: "all", sel: {}, mode: "list", area: String(p.title || "").slice(0, 40), prio: 2, problem: "", msg: "" };
    tpRenderLink(); $("tpLinkModal").hidden = false;
  }
  function tpCloseLink() { $("tpLinkModal").hidden = true; tpL = null; }
  /* 새 할 일을 만들 문서 탭: 고른 카테고리, ‘전체’면 지금 보던 탭(없으면 첫 탭) */
  function tpNewTab() {
    var vis = TABS.filter(function (t) { return !t.hidden; });
    if (tpL.cat !== "all") return tpL.cat;
    if (vis.some(function (t) { return t.key === ui.tab; })) return ui.tab;
    return vis.length ? vis[0].key : "";
  }
  function tpRenderLink() {
    var l = tpL, p = tpPlan(l.planId), s = $("tpLinkSheet"); s.textContent = "";
    if (!p) { tpCloseLink(); return; }
    var mine = {}; p.todoIds.forEach(function (id) { mine[id] = 1; });
    s.appendChild(h("div", { class: "sh full" }, [h("h3", { text: l.mode === "new" ? "새 할 일 만들어 연결" : "할 일 선택해서 연결" }), tpCloseBtn(tpCloseLink)]));
    var st = planState(p);
    s.appendChild(h("div", { class: "full" }, [h("div", { class: "area", style: "font-size:12.5px;color:var(--muted);font-weight:600", text: st === "run" ? "지금 집중 중 · " + hmsText(focusMs(p, Date.now())) : (st === "paused" ? "일시정지 중" : "계획 " + spanFull(p)) }), h("div", { style: "font-size:16px;font-weight:700", text: p.title })]));
    var vis = TABS.filter(function (t) { return !t.hidden; });
    var isNew = l.mode === "new", curCat = isNew ? tpNewTab() : l.cat;
    var chips = h("div", { class: "seg tp-chips", role: "group", "aria-label": isNew ? "새 할 일을 넣을 카테고리 (가로 스크롤)" : "할 일 카테고리 (가로 스크롤)" }, (isNew ? [] : [h("button", { type: "button", "aria-pressed": l.cat === "all" ? "true" : "false", text: "전체", onclick: function () { l.cat = "all"; tpRenderLink(); } })])
      .concat(vis.map(function (t) { return h("button", { type: "button", "aria-pressed": curCat === t.key ? "true" : "false", text: t.label, onclick: function () { l.cat = t.key; tpRenderLink(); } }); })));
    s.appendChild(h("div", { class: "full" }, [chips]));
    if (l.mode === "new") { tpRenderNewTodo(s, p); return; }
    var visKeys = vis.map(function (t) { return t.key; });
    var cand = linkableTodos().filter(function (t) { return visKeys.indexOf(t.tab) >= 0; });
    var linked = linkedTodosOf(p);
    var rows = linked.concat(cand).filter(function (t) { return l.cat === "all" || t.tab === l.cat; });
    rows.sort(function (a, b) { return (mine[b.id] ? 1 : 0) - (mine[a.id] ? 1 : 0) || a.priority - b.priority || visKeys.indexOf(a.tab) - visKeys.indexOf(b.tab); });
    var list = h("div", { class: "full tp-list" }, []);
    if (!rows.length) list.appendChild(h("div", { class: "vsub", text: "연결할 수 있는 할 일이 없어요. 아래 ‘새 할 일’로 만들 수 있어요." }));
    rows.forEach(function (t) {
      var isMine = !!mine[t.id], on = isMine || !!l.sel[t.id], rd = h("span", { class: "rd" }); rd.innerHTML = CHECK;
      var attrs = { type: "button", class: "tp-pickrow" + (on ? " sel" : ""), "aria-pressed": on ? "true" : "false", onclick: function () { if (isMine) return; if (l.sel[t.id]) delete l.sel[t.id]; else l.sel[t.id] = 1; tpRenderLink(); } };
      if (isMine) attrs.disabled = "disabled";
      var row = h("button", attrs, [rd, h("span", null, [h("span", { class: "a", text: (t.area || tabLabel(t.tab)) + (isMine ? " · 이 계획에 연결됨" : "") }), h("span", { class: "tt", text: t.problem })]), h("span", { class: "pill p" + t.priority, text: PRIO[t.priority] })]);
      if (isMine) {
        var un = h("button", { type: "button", class: "btn sm tp-unlink", text: "해제", "aria-label": "연결 해제: " + t.problem, onclick: function () { tpUnlink(p.id, t.id); } });
        list.appendChild(h("div", { class: "tp-rowwrap" }, [row, un]));
      } else list.appendChild(row);
    });
    s.appendChild(list);
    var n = Object.keys(l.sel).length;
    s.appendChild(h("div", { class: "full vsub tpa-note", text: "아직 끝나지 않은 할 일만 보여요. 다른 계획에 연결된 할 일은 겹쳐 연결하지 않아요. 연결한 할 일을 체크하면 할 일 목록에도 완료로 반영돼요." }));
    var ok = h("button", { class: "btn primary", type: "button", text: n ? "선택한 " + n + "개 연결" : "연결", onclick: function () { tpLinkSave(); } }); if (!n) ok.setAttribute("disabled", "disabled");
    var nb = iconEl("button", TPI.plus.replace('width="18" height="18"', 'width="16" height="16"'), { class: "btn", type: "button", onclick: function () { l.mode = "new"; l.msg = ""; l.cat = tpNewTab(); tpRenderLink(); if (!tpMobile()) setTimeout(function () { var i = $("tpNArea"); if (i) i.focus(); }, 30); } }); nb.appendChild(document.createTextNode("새 할 일"));
    s.appendChild(h("div", { class: "actions full" }, [h("button", { class: "btn", type: "button", text: "닫기", onclick: tpCloseLink }), nb, ok]));
  }
  /* 새 할 일: 구분·우선순위·작업 내용만 입력한다. 같은 todos 컬렉션에 저장돼 TODO 목록에도 그대로 나온다. */
  function tpRenderNewTodo(s, p) {
    var l = tpL, tab = tpNewTab(), box = h("div", { class: "full tp-list tp-newform" }, []);
    var areas = []; items.forEach(function (t) { if (t.tab === tab && t.area && areas.indexOf(t.area) < 0) areas.push(t.area); });
    var f1 = h("div", { class: "field" }, [h("label", { for: "tpNArea", text: "구분" })]);
    var ai = h("input", { id: "tpNArea", type: "text", maxlength: "40", placeholder: "예: 포트폴리오", autocomplete: "off", role: "combobox", "aria-autocomplete": "list", "aria-expanded": "false", "aria-controls": "tpNAreaMenu" }); ai.value = l.area;
    ai.addEventListener("input", function () { l.area = ai.value; l.msg = ""; });
    f1.appendChild(ai); tpCombo(ai, areas.slice(0, 30)); box.appendChild(f1);
    var f2 = h("div", { class: "field" }, [h("label", { text: "우선순위" })]);
    f2.appendChild(h("div", { class: "seg", role: "group", "aria-label": "우선순위" }, [1, 2, 3].map(function (n) {
      return h("button", { type: "button", "aria-pressed": l.prio === n ? "true" : "false", text: PRIO[n], onclick: function () { l.prio = n; tpRenderLink(); } });
    })));
    box.appendChild(f2);
    var f3 = h("div", { class: "field" }, [h("label", { for: "tpNProb", text: "작업 내용" })]);
    var pi = h("input", { id: "tpNProb", type: "text", maxlength: "200", placeholder: "해야 할 일", autocomplete: "off" }); pi.value = l.problem;
    pi.addEventListener("input", function () { l.problem = pi.value; l.msg = ""; });
    pi.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); tpNewTodoSave(); } });
    f3.appendChild(pi); box.appendChild(f3);
    s.appendChild(box);
    s.appendChild(h("div", { class: "full vsub tpa-note", text: tab ? "위에서 고른 ‘" + tabLabel(tab) + "’ 탭의 할 일 목록에 함께 추가돼요." : "추가할 문서 탭이 없어요." }));
    s.appendChild(h("div", { class: "msg full", role: "alert", text: l.msg || "" }));
    var ok = h("button", { class: "btn primary", type: "button", text: "만들고 연결", onclick: tpNewTodoSave }); if (!tab) ok.setAttribute("disabled", "disabled");
    s.appendChild(h("div", { class: "actions full" }, [h("button", { class: "btn", type: "button", text: "목록으로", onclick: function () { l.mode = "list"; l.msg = ""; tpRenderLink(); } }), ok]));
  }
  /* 입력칸에 붙는 추천 메뉴: 브라우저 기본 목록 대신 사이트 테마에 맞춘 메뉴. 위/아래/Enter/Esc와 터치를 지원한다. */
  function tpCombo(input, list) {
    var menu = h("div", { class: "combo-menu", id: "tpNAreaMenu", role: "listbox", hidden: "hidden" }), cur = -1, shown = [];
    document.body.appendChild(menu);
    function items() { var q = input.value.trim().toLowerCase(); return list.filter(function (a) { return !q || a.toLowerCase().indexOf(q) >= 0; }); }
    function hide() { menu.hidden = true; cur = -1; input.setAttribute("aria-expanded", "false"); }
    function place() {
      var r = input.getBoundingClientRect(), below = window.innerHeight - r.bottom, h0 = Math.min(menu.scrollHeight, 220), up = below < h0 + 12 && r.top > below;
      menu.style.left = r.left + "px"; menu.style.width = r.width + "px"; menu.style.maxHeight = Math.max(96, Math.min(220, (up ? r.top : below) - 12)) + "px";
      if (up) { menu.style.top = ""; menu.style.bottom = (window.innerHeight - r.top + 6) + "px"; } else { menu.style.bottom = ""; menu.style.top = (r.bottom + 6) + "px"; }
    }
    function pick(v) { input.value = v; if (tpL) { tpL.area = v; tpL.msg = ""; } hide(); }
    function mark() { [].forEach.call(menu.children, function (c, i) { c.setAttribute("aria-selected", i === cur ? "true" : "false"); if (i === cur) c.scrollIntoView({ block: "nearest" }); }); }
    function show() {
      shown = items(); menu.textContent = "";
      if (!shown.length) { hide(); return; }
      shown.forEach(function (a) {
        var o = h("div", { class: "combo-item", role: "option", "aria-selected": "false", text: a });
        o.addEventListener("mousedown", function (e) { e.preventDefault(); });
        o.addEventListener("click", function () { pick(a); });
        menu.appendChild(o);
      });
      menu.hidden = false; cur = -1; input.setAttribute("aria-expanded", "true"); place();
    }
    input.addEventListener("focus", show); input.addEventListener("click", function () { if (menu.hidden) show(); });
    input.addEventListener("input", show);
    input.addEventListener("blur", function () { setTimeout(function () { hide(); if (!input.isConnected) menu.remove(); }, 120); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !menu.hidden) { e.stopPropagation(); hide(); return; }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (menu.hidden) { show(); return; } cur = (cur + (e.key === "ArrowDown" ? 1 : -1) + shown.length) % shown.length; mark(); return; }
      if (e.key === "Enter" && !menu.hidden && cur >= 0) { e.preventDefault(); e.stopPropagation(); pick(shown[cur]); }
    });
    var obs = new MutationObserver(function () { if (!input.isConnected) { menu.remove(); obs.disconnect(); } });
    obs.observe(document.body, { childList: true, subtree: true });
  }
  function tpNewTodoSave() {
    var l = tpL; if (!l) return; var p = tpPlan(l.planId); if (!p) { tpCloseLink(); return; }
    var tab = tpNewTab(), area = String(l.area || "").trim(), problem = String(l.problem || "").trim();
    if (!tab) { l.msg = "추가할 문서 탭이 없어요."; tpRenderLink(); return; }
    if (!area) { l.msg = "구분을 입력해 주세요."; tpRenderLink(); return; }
    if (!problem) { l.msg = "작업 내용을 입력해 주세요."; tpRenderLink(); return; }
    if (tpSecretCheck(area) || tpSecretCheck(problem)) { l.msg = SECRET_MSG; tpRenderLink(); return; }
    var maxOrder = items.filter(function (i) { return i.tab === tab; }).reduce(function (m, i) { return Math.max(m, i.order || 0); }, 0), newId = "";
    write(function () {
      return db.collection("todos").add({ tab: tab, area: area, problem: problem, fix: "", priority: l.prio, done: false, dropped: false, note: "", order: maxOrder + 1, createdAt: Date.now() })
        .then(function (r) {
          newId = r && r.id ? r.id : ""; if (!newId) throw new Error("no id");
          var ids = p.todoIds.concat([newId]);
          return db.collection("plans").doc(p.id).update({ todoIds: ids, tabs: tpTabsOf(ids).concat(tpTabsOf(ids).indexOf(tab) < 0 ? [tab] : []), updatedAt: Date.now() });
        });
    }, "새 할 일을 만들어 연결했어요.").then(function (ok) {
      if (!ok) { l.msg = "저장하지 못했어요. 잠시 후 다시 시도해 주세요."; tpRenderLink(); return; }
      tpCloseLink(); renderPlanView();
    });
  }
  function tpLinkSave() {
    var l = tpL; if (!l) return; var p = tpPlan(l.planId); if (!p) { tpCloseLink(); return; }
    var add = Object.keys(l.sel), ids = p.todoIds.concat(add.filter(function (id) { return p.todoIds.indexOf(id) < 0; }));
    if (!add.length) return;
    write(function () { return db.collection("plans").doc(p.id).update({ todoIds: ids, tabs: tpTabsOf(ids), updatedAt: Date.now() }); }, "할 일 " + add.length + "개를 연결했어요.").then(function (ok) { if (ok) { tpCloseLink(); renderPlanView(); } });
  }
  function tpUnlink(planId, todoId) {
    var p = tpPlan(planId); if (!p) return;
    var ids = p.todoIds.filter(function (x) { return x !== todoId; });
    write(function () { return db.collection("plans").doc(p.id).update({ todoIds: ids, tabs: tpTabsOf(ids), updatedAt: Date.now() }); }, "연결을 해제했어요.").then(function () { if (tpL) tpRenderLink(); });
  }

  /* ---------- 팝업 3: 집중 시간 수정 ---------- */
  var tpS = null;
  function tpFld(ts) { return ts == null ? null : { hm: tmText(ts), orig: ts, origHm: tmText(ts), anchor: ts }; }
  function tpHmToTs(f, anchorFallback) {
    if (!f || !f.hm) return null;
    if (f.orig != null && f.hm === f.origHm) return f.orig;
    var d = new Date(f.anchor != null ? f.anchor : anchorFallback), m = hmToMin(f.hm);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, m).getTime();
  }
  function tpOpenSess(planId) {
    var p = tpPlan(planId); if (!p || !p.focus) return;
    var f = p.focus;
    tpS = { planId: planId, start: tpFld(f.startedAt), end: f.endedAt != null ? tpFld(f.endedAt) : { hm: "", orig: null, origHm: "", anchor: f.startedAt }, live: f.endedAt == null,
      pauses: f.pauses.map(function (q) { return { from: tpFld(q.from), to: q.to != null ? tpFld(q.to) : { hm: "", orig: null, origHm: "", anchor: q.from } }; }), msg: "", del: false };
    tpRenderSess(); $("tpSessModal").hidden = false;
  }
  function tpCloseSess() { $("tpSessModal").hidden = true; tpS = null; }
  function tpSessBuild() {
    var x = tpS, a = x.start.orig != null || x.start.hm ? tpHmToTs(x.start, Date.now()) : null;
    if (a == null) return { error: "집중 시작 시각을 정해 주세요." };
    var e = x.end.hm ? tpHmToTs(x.end, a) : null;
    if (!x.live && e == null) return { error: "집중 종료 시각을 정해 주세요." };
    if (e != null && e <= a) return { error: "집중 종료는 시작보다 늦어야 해요." };
    var ps = [], i;
    for (i = 0; i < x.pauses.length; i++) {
      var q = x.pauses[i], f = tpHmToTs(q.from, a), t = q.to.hm ? tpHmToTs(q.to, a) : null;
      if (f == null) return { error: "쉰 구간 " + (i + 1) + "의 시작을 정해 주세요." };
      if (t == null && !(e == null && i === x.pauses.length - 1)) return { error: "쉰 구간 " + (i + 1) + "의 종료를 정해 주세요. (쉬는 중으로 둘 수 있는 건 집중 중인 계획의 마지막 구간뿐이에요.)" };
      if (t != null && t <= f) return { error: "쉰 구간 " + (i + 1) + "의 종료는 시작보다 늦어야 해요." };
      if (f < a || (e != null && (t != null ? t : f) > e)) return { error: "쉰 구간 " + (i + 1) + "은 집중 시간 안에 있어야 해요." };
      ps.push({ from: f, to: t });
    }
    ps.sort(function (m, n) { return m.from - n.from; });
    for (i = 1; i < ps.length; i++) if (ps[i - 1].to == null || ps[i].from < ps[i - 1].to) return { error: "쉰 구간이 서로 겹쳐요." };
    return { focus: { startedAt: a, endedAt: e, pauses: ps } };
  }
  function tpRenderSess() {
    var x = tpS, p = tpPlan(x.planId), s = $("tpSessSheet"); s.textContent = "";
    if (!p) { tpCloseSess(); return; }
    var re = function () { x.msg = ""; tpRenderSess(); };
    s.appendChild(h("div", { class: "sh full" }, [h("h3", { text: "집중 시간 수정" }), tpCloseBtn(tpCloseSess)]));
    s.appendChild(h("div", { class: "full" }, [h("div", { style: "font-size:16px;font-weight:700", text: p.title }), h("div", { class: "vsub hp", text: "계획 " + span2(p.startMin, p.endMin) + " · " + durText(planLen(p)) })]));
    s.appendChild(tpPickField("집중 시작", "tpSStart", x.start.hm, { step: 5, required: true }, function (v) { x.start.hm = v; re(); }));
    s.appendChild(tpPickField("집중 종료", "tpSEnd", x.end.hm, x.live ? { step: 5, clearLabel: "집중 중으로 두기", empty: "집중 중", cls: x.end.hm ? "" : "run" } : { step: 5, required: true }, function (v) { x.end.hm = v; re(); }));
    var built = tpSessBuild(), restTxt = built.focus ? durText(msToMin(restMs({ focus: built.focus }, built.focus.endedAt != null ? built.focus.endedAt : Date.now()))) : "";
    var box = h("div", { class: "full" }, [h("div", { class: "vsub", style: "font-weight:600;margin-bottom:6px", text: "쉰 구간 " + (x.pauses.length ? x.pauses.length + "개" + (restTxt ? " · 합계 " + restTxt : "") : "없음") })]);
    var ed = h("div", { class: "sess-edit" }, []);
    x.pauses.forEach(function (q, i) {
      var last = x.live && !x.end.hm && i === x.pauses.length - 1;
      var fromF = tpPickField("", "tpSPF" + i, q.from.hm, { step: 5, required: true }, function (v) { q.from.hm = v; re(); });
      var toF = tpPickField("", "tpSPT" + i, q.to.hm, last ? { step: 5, clearLabel: "쉬는 중으로 두기", empty: "쉬는 중", cls: q.to.hm ? "" : "run" } : { step: 5, required: true }, function (v) { q.to.hm = v; re(); });
      [fromF, toF].forEach(function (f) { var lb = f.querySelector("label"); if (lb) lb.remove(); });
      var del = h("button", { type: "button", class: "icon-btn sm danger", "aria-label": "쉰 구간 삭제", onclick: function () { x.pauses.splice(i, 1); re(); } }); del.innerHTML = svgOf('<path d="M4.5 6h11M8 6V4h4v2M6 6l.7 10h6.6L14 6"/>', 18);
      ed.appendChild(h("div", { class: "se" }, [h("span", { class: "n", text: String(i + 1) }), fromF, toF, del]));
    });
    box.appendChild(ed);
    var addB = iconEl("button", TPI.plus.replace('width="18" height="18"', 'width="16" height="16"'), { type: "button", class: "btn sm", style: "margin-top:8px", onclick: function () {
      var a0 = x.start.hm ? hmToMin(x.start.hm) : 0; var mid = x.end.hm ? Math.floor((a0 + hmToMin(x.end.hm)) / 2) : a0 + 5;
      x.pauses.push({ from: { hm: minToHm(mid), orig: null, origHm: "", anchor: x.start.anchor }, to: { hm: minToHm(Math.min(mid + 5, DAY_MIN - 1)), orig: null, origHm: "", anchor: x.start.anchor } }); re(); } });
    addB.appendChild(document.createTextNode("쉰 구간 추가")); box.appendChild(addB); s.appendChild(box);
    s.appendChild(h("div", { class: "full vsub", text: "계획 시간과 달라도 괜찮아요. 실제로 집중한 시간을 적어요. 쉰 구간은 집중 시간에서 빠지고, 타임테이블에는 끊긴 막대로 보여요." }));
    s.appendChild(h("div", { class: "msg full", role: "alert", text: x.msg || "" }));
    var delBtn = h("button", { class: "btn danger", type: "button", style: "margin-right:auto", text: x.del ? "정말 삭제" : "집중 기록 삭제", onclick: function () {
      if (!x.del) { x.del = true; tpRenderSess(); return; }
      write(function () { return db.collection("plans").doc(p.id).update({ focus: null, status: "wait", doneAt: { __delete__: true }, focusMin: { __delete__: true }, restMin: { __delete__: true }, updatedAt: Date.now() }); }, "집중 기록을 삭제했어요.").then(function (ok) { if (ok) { tpCloseSess(); renderPlanView(); } }); } });
    s.appendChild(h("div", { class: "actions full" }, [delBtn, h("button", { class: "btn", type: "button", text: "취소", onclick: tpCloseSess }), h("button", { class: "btn primary", type: "button", text: "저장", onclick: tpSessSave })]));
  }
  function tpSessSave() {
    var x = tpS; if (!x) return; var p = tpPlan(x.planId); if (!p) { tpCloseSess(); return; }
    var r = tpSessBuild();
    if (r.error) { x.msg = r.error; tpRenderSess(); return; }
    var f = r.focus, extra = f.endedAt != null ? { doneAt: f.endedAt } : { doneAt: { __delete__: true } };
    ui.pStale = "";
    write(function () { return tpSaveFocus(p, f, extra); }, "집중 시간을 고쳤어요.").then(function (ok) { if (ok) { tpCloseSess(); renderPlanView(); } });
  }
  ["tpAddModal", "tpLinkModal", "tpSessModal"].forEach(function (id) {
    $(id).addEventListener("click", function (e) { if (e.target === $(id)) { if (id === "tpAddModal") tpCloseAdd(); else if (id === "tpLinkModal") tpCloseLink(); else tpCloseSess(); } });
  });

  /* ---------- 화면 전환 ---------- */
  function applyHash(s) {
    if (tabKeyOk(s)) { ui.view = "todo"; ui.tab = s; return true; }
    if (s === "calendar" || s === "upcoming" || s === "plan") { ui.view = s; return true; }
    return false;
  }
  try { applyHash((location.hash || "").slice(1)); } catch (e) {}
  function go(name) {
    setDrawer(false);
    applyHash(name);
    ui.confirm = null; ui.confirmEv = null; ui.drop = null;
    render();
    try { location.hash = name; } catch (e) {}
    try { $("main").scrollTop = 0; } catch (e) {}
  }
  window.addEventListener("hashchange", function () {
    var s = ""; try { s = (location.hash || "").slice(1); } catch (e) {}
    if (applyHash(s)) { ui.confirm = null; ui.confirmEv = null; ui.drop = null; if (started) render(); }
  });
  qsa("[data-go]").forEach(function (b) { b.addEventListener("click", function () { go(b.getAttribute("data-go")); }); });
  function setDrawer(o) {
    $("app").classList.toggle("drawer-open", o); $("scrim").hidden = !o;
    $("navBtn").setAttribute("aria-expanded", o ? "true" : "false");
  }
  $("navBtn").addEventListener("click", function () { setDrawer(true); });
  $("scrim").addEventListener("click", function () { setDrawer(false); });
  window.addEventListener("resize", function () { if (window.innerWidth >= 900) setDrawer(false); });

  function renderTabs() {
    var nav = $("tabs"); nav.textContent = "";
    TABS.filter(function (t) { return !t.hidden; }).forEach(function (t) {
      var mine = items.filter(function (i) { return i.tab === t.key && !isDropped(i); });
      var d = mine.filter(function (i) { return i.done; }).length;
      nav.appendChild(h("button", {
        class: "tab", type: "button", role: "tab", "aria-selected": t.key === ui.tab ? "true" : "false",
        onclick: function () { go(t.key); }
      }, [h("span", { text: t.label }), h("span", { class: "tc", text: d + "/" + mine.length })]));
    });
  }

  var sideSig = "";
  function renderSideTabs() {
    var vis = TABS.filter(function (t) { return !t.hidden; });
    var sig = vis.map(function (t) { return t.key + "|" + t.label + "|" + t.icon; }).join("~");
    if (sig === sideSig) return; sideSig = sig;
    var box = $("docList"); box.textContent = "";
    vis.forEach(function (t) {
      var b = h("button", { class: "nv nv-doc", type: "button", "data-go": t.key, title: t.label, "aria-label": t.label, onclick: function () { go(t.key); } }, []);
      b.innerHTML = '<span class="r1">' + iconSvg(t.icon) + '<span class="lb"></span><span class="cnt" id="cnt-' + t.key + '"></span></span><span class="mini"><span id="bar-' + t.key + '" style="width:0%"></span></span>';
      b.querySelector(".lb").textContent = t.label;
      box.appendChild(b);
    });
  }

  function renderChrome() {
    if (ui.view === "todo" && (tabHidden(ui.tab) || !tabKeyOk(ui.tab))) { ui.view = "calendar"; try { location.hash = "calendar"; } catch (e) {} }
    renderSideTabs();
    var up = upcomingCount();
    $("sUp").textContent = String(up); $("badgeUp").textContent = String(up);
    $("sLeft").textContent = String(items.filter(function (i) { return !i.done && !isDropped(i) && !tabHidden(i.tab); }).length);
    var cur = ui.view === "todo" ? ui.tab : ui.view;
    qsa("[data-go]").forEach(function (b) {
      if (b.getAttribute("data-go") === cur) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
    TABS.forEach(function (t) {
      var mine = items.filter(function (i) { return i.tab === t.key && !isDropped(i); });
      var d = mine.filter(function (i) { return i.done; }).length;
      if (!$("cnt-" + t.key)) return;
      $("cnt-" + t.key).textContent = d + "/" + mine.length;
      $("bar-" + t.key).style.width = (mine.length ? Math.round(d / mine.length * 100) : 0) + "%";
    });
    $("main").classList.toggle("fit", ui.view === "calendar");
    $("main").classList.toggle("fit-todo", ui.view === "todo");
    $("vCal").hidden = ui.view !== "calendar";
    $("vUp").hidden = ui.view !== "upcoming";
    $("vTodo").hidden = ui.view !== "todo";
    $("vPlan").hidden = ui.view !== "plan";
    $("main").classList.toggle("fit-plan", ui.view === "plan");
    $("fab").setAttribute("aria-label", ui.view === "todo" ? "항목 추가" : "일정 추가"); $("fab").title = ui.view === "todo" ? "항목 추가" : "일정 추가"; $("fab").classList.remove("hide"); if (ui.view === "plan") $("fab").classList.add("hide"); if (ui.view !== "plan") { ui.pSheet = false; $("tpDock").hidden = true; $("tpMScrim").hidden = true; $("tpDetail").classList.remove("m-open"); }
  }

  function renderTodoView() {
    $("todoTitle").textContent = tabLabel(ui.tab);
    renderTabs();
    var tabAll = items.filter(function (i) { return i.tab === ui.tab; });
    var tabItems = tabAll.filter(function (i) { return !isDropped(i); });
    var droppedN = tabAll.length - tabItems.length;
    var total = tabItems.length, done = tabItems.filter(function (i) { return i.done; }).length;
    var pct = total ? Math.round(done / total * 100) : 0;
    $("barFill").style.width = pct + "%";
    $("bar").setAttribute("aria-valuenow", String(pct));
    $("pct").firstChild.nodeValue = pct + "%";
    $("hpct").textContent = pct + "%  ·  " + done + "/" + total;
    $("count").textContent = done + " / " + total + " 완료" + (droppedN ? " · 포기 " + droppedN + " 제외" : "");

    var sum = $("prioSum"); sum.textContent = "";
    [1, 2, 3].forEach(function (p) {
      var all = tabItems.filter(function (i) { return i.priority === p; });
      var left = all.filter(function (i) { return !i.done; }).length;
      if (all.length) sum.appendChild(h("span", { class: "pill p" + p, text: PRIO[p] + " " + left + "/" + all.length }));
    });

    var list = $("list"); list.textContent = "";
    if (!ready) { list.appendChild(h("div", { class: "empty" }, [h("b", { text: "불러오는 중" }), "저장된 항목을 확인하고 있습니다."])); return; }
    if (loadError) { list.appendChild(h("div", { class: "empty" }, [h("b", { text: "저장소를 사용할 수 없습니다" }), loadError])); return; }
    if (!tabAll.length) { list.appendChild(h("div", { class: "empty" }, [h("b", { text: "아직 항목이 없습니다" }), "‘+ 항목 추가’로 이 탭에서 할 일을 적어 보세요."])); return; }

    var wrap = h("div", { class: "pane" });
    var shown = 0;
    [1, 2, 3].forEach(function (p) {
      var group = items.filter(function (i) { return i.priority === p && matches(i); })
        .sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
      if (!group.length) return;
      shown += group.length;
      wrap.appendChild(h("section", { class: "section" }, [
        h("div", { class: "section-h" }, [h("span", { class: "pill p" + p, text: PRIO[p] }), h("span", { class: "n", text: group.length + "개" })]),
        h("div", { class: "rows" }, group.map(rowEl))
      ]));
    });
    var dl = ui.status === "all"
      ? tabAll.filter(matchDropped).sort(function (a, b) { return (a.order || 0) - (b.order || 0); })
      : [];
    if (!shown && !dl.length) wrap.appendChild(h("div", { class: "empty" }, [h("b", { text: "조건에 맞는 항목이 없습니다" }), "필터나 검색어를 바꿔 보세요."]));
    if (dl.length) {
      var dOpen = !!ui.dropOpen;
      var kids = [h("button", { class: "drop-toggle", type: "button", "aria-expanded": dOpen ? "true" : "false", onclick: function () { ui.dropOpen = !ui.dropOpen; render(); } }, [
        h("span", { class: "chev", "aria-hidden": "true", text: "▸" }),
        h("span", { text: "포기함" }),
        h("span", { class: "n", text: dl.length + "개" })
      ])];
      if (dOpen) kids.push(h("div", { class: "rows" }, dl.map(rowEl)));
      wrap.appendChild(h("section", { class: "section drop-sec" }, kids));
    }
    list.appendChild(wrap);
  }

  function render() {
    renderChrome();
    if (ui.view === "calendar") renderCalView();
    else if (ui.view === "upcoming") renderUpView();
    else if (ui.view === "plan") renderPlanView();
    else renderTodoView();
  }
  function renderSafe() {
    var a = document.activeElement;
    if (a && a.tagName === "TEXTAREA" && $("list").contains(a)) { pendingRender = true; renderChrome(); return; }
    render();
  }

  function segBind(id, key, num) {
    $(id).addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      ui[key] = num ? Number(b.dataset.v) : b.dataset.v;
      Array.prototype.forEach.call($(id).children, function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      render();
    });
  }
  segBind("statusSeg", "status", false);
  segBind("prioSeg", "prio", true);
  $("q").addEventListener("input", function (e) { ui.q = e.target.value.trim(); render(); });

  /* 항목 수정: 추가 창을 재사용한다. it를 넘기면 수정 모드(ui.editId), 없으면 새 항목 추가 */
  function setAdding(v, it) {
    var wasOpen = ui.adding, wasEdit = !!ui.editId;
    ui.adding = v; $("addModal").hidden = !v;
    ui.editId = v && it ? it.id : null;
    if (v && !wasOpen) { ui.opener = document.activeElement; }
    if (!v && wasOpen && ui.opener && ui.opener.focus && document.contains(ui.opener)) { try { ui.opener.focus({ preventScroll: true }); } catch (e) {} ui.opener = null; }
    if (v) {
      if (it) {
        $("fArea").value = it.area || ""; $("fProblem").value = it.problem || ""; $("fFix").value = it.fix || "";
        setPrio(it.priority || 2);
        $("addTitle").textContent = tabLabel(ui.tab) + " · 할 일 수정";
        $("addSave").textContent = "수정 저장";
      } else {
        if (wasEdit) { $("addForm").reset(); setPrio(2); }
        else setPrio($("fPrio").value || 2);
        $("addTitle").textContent = tabLabel(ui.tab) + " · 새 할 일 추가";
        $("addSave").textContent = "저장";
      }
      $("fArea").focus();
    }
  }
  $("toggleAdd").addEventListener("click", function () { setAdding(true); });
  $("addModal").addEventListener("click", function (e) { if (e.target === $("addModal")) setAdding(false); });
  $("cancelAdd").addEventListener("click", function () { setAdding(false); });
  function setPrio(v) { $("fPrio").value = String(v); qsa("#fPrioBtns .po").forEach(function (b) { b.setAttribute("aria-checked", b.getAttribute("data-v") === String(v) ? "true" : "false"); }); }
  qsa("#fPrioBtns .po").forEach(function (b) { b.addEventListener("click", function () { setPrio(b.getAttribute("data-v")); }); });
  $("addX").addEventListener("click", function () { setAdding(false); });
  $("evX").addEventListener("click", closeEv);


  /* ---------- 카테고리 편집 (초안 → 완료 시 일괄 적용) ---------- */
  function catRef(k) { return db.collection("cats").doc(k); }
  function ensureCats() {
    if (catDocs && catDocs.some(function (d) { return d.id === "cfg"; })) return Promise.resolve(true);
    var base = TABS.slice();
    return Promise.all(base.map(function (t, i) { return catRef(t.key).set({ label: t.label, order: i, hidden: false, icon: t.icon }); }))
      .then(function () { return db.collection("cats").doc("cfg").set({ seeded: true, at: Date.now() }); })
      .then(function () { return true; });
  }
  var catDraft = [], catChanged = false, catIconOpen = null, catSeq = 0;
  function ibtn(inner, label, fn, opts) {
    opts = opts || {};
    var b = h("button", { type: "button", class: "icon-btn sm" + (opts.cls ? " " + opts.cls : ""), "aria-label": label, title: label, onclick: fn }, []);
    b.innerHTML = svgOf(inner, 18); if (opts.disabled) b.disabled = true;
    if (opts.pressed !== undefined) b.setAttribute("aria-pressed", opts.pressed ? "true" : "false");
    return b;
  }
  var EYE = '<path d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10z"/><circle cx="10" cy="10" r="2.5"/>';
  var EYE_OFF = EYE + '<path d="M3 3l14 14"/>';
  var GRIP = '<path d="M7 5.5h.01M13 5.5h.01M7 10h.01M13 10h.01M7 14.5h.01M13 14.5h.01" stroke-width="2.8"/>';
  function catCount(k) { return rawTodos.filter(function (x) { return x.tab === k; }).length; }
  function renderCatList() {
    var box = $("catList"); box.textContent = "";
    if (!catDraft.length) box.appendChild(h("div", { class: "cat-emp", text: "카테고리가 없습니다. 아래에서 추가해 주세요." }));
    catDraft.forEach(function (x, i) {
      var n = x.isNew ? 0 : catCount(x.key);
      var row = h("div", { class: "cat-row" + (x.hidden ? " dim" : "") + (x.deleted ? " gone" : ""), "data-i": String(i) }, []);
      if (x.deleted) {
        row.appendChild(h("div", { class: "cat-conf" }, [
          h("span", { text: "‘" + x.label + "’ 삭제 예정" + (n ? " · 항목 " + n + "개 함께 삭제" : "") }),
          h("button", { type: "button", class: "btn sm", onclick: function () { x.deleted = false; catChanged = true; renderCatList(); } }, ["되돌리기"])
        ]));
        box.appendChild(row); return;
      }
      var grip = h("button", { type: "button", class: "icon-btn sm cat-grip", "aria-label": "순서 이동 (끌어서 이동, 키보드는 위·아래 화살표)", title: "끌어서 순서 변경" }, []);
      grip.innerHTML = svgOf(GRIP, 18);
      bindGrip(grip, i);
      row.appendChild(grip);
      var ib = h("button", { type: "button", class: "icon-btn sm cat-ic", "aria-label": "아이콘 변경", title: "아이콘 변경", "aria-expanded": catIconOpen === x.key ? "true" : "false",
        onclick: function () { catIconOpen = catIconOpen === x.key ? null : x.key; renderCatList(); } }, []);
      ib.innerHTML = iconSvg(x.icon);
      row.appendChild(ib);
      var inp = h("input", { class: "cat-in", maxlength: "20", "aria-label": "카테고리 이름" });
      inp.value = x.label;
      inp.addEventListener("input", function () { x.label = inp.value; catChanged = true; });
      inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); inp.blur(); } });
      row.appendChild(inp);
      row.appendChild(h("span", { class: "cat-n", text: n + "개" }));
      row.appendChild(ibtn(x.hidden ? EYE_OFF : EYE, x.hidden ? "다시 보이기" : "사이드바에서 숨기기", function () { x.hidden = !x.hidden; catChanged = true; renderCatList(); }, { pressed: x.hidden }));
      row.appendChild(ibtn('<path d="M4 6h12M8 6V4h4v2M6 6l.7 10h6.6L14 6"/>', "삭제", function () {
        catChanged = true; if (x.isNew) catDraft.splice(i, 1); else x.deleted = true; renderCatList();
      }, { cls: "danger" }));
      box.appendChild(row);
      if (catIconOpen === x.key) {
        var pn = h("div", { class: "cat-icons", role: "group", "aria-label": "아이콘 선택" }, []);
        ICONS.forEach(function (_, k) {
          var b = h("button", { type: "button", class: "ico" + (Number(x.icon) === k ? " sel" : ""), "aria-label": "아이콘 " + (k + 1), "aria-pressed": Number(x.icon) === k ? "true" : "false",
            onclick: function () { x.icon = k; catChanged = true; catIconOpen = null; renderCatList(); } }, []);
          b.innerHTML = iconSvg(k); pn.appendChild(b);
        });
        box.appendChild(pn);
      }
    });
  }
  function moveDraft(i, to) {
    if (to < 0 || to >= catDraft.length || to === i) return;
    var m = catDraft.splice(i, 1)[0]; catDraft.splice(to, 0, m); catChanged = true;
  }
  var CAT_CTX = { rows: "#catList .cat-row", grips: "#catList .cat-grip", len: function () { return catDraft.length; }, move: function (i, to) { moveDraft(i, to); }, render: function () { renderCatList(); } };
  function bindGrip(grip, i, ctx) {
    ctx = ctx || CAT_CTX;
    grip.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      e.preventDefault(); var to = i + (e.key === "ArrowUp" ? -1 : 1);
      if (to < 0 || to >= ctx.len()) return;
      ctx.move(i, to); ctx.render();
      var g = qsa(ctx.grips)[to]; if (g) g.focus();
    });
    grip.addEventListener("pointerdown", function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      var rows = qsa(ctx.rows), el = rows[i]; if (!el) return;
      var rects = rows.map(function (r) { return r.getBoundingClientRect(); });
      var h0 = rects[i].height, y0 = e.clientY, to = i;
      el.classList.add("dragging");
      rows.forEach(function (r) { if (r !== el) r.style.transition = "transform .15s ease"; });
      try { grip.setPointerCapture(e.pointerId); } catch (x) {}
      function mv(ev) {
        var dy = ev.clientY - y0; el.style.transform = "translateY(" + dy + "px)";
        var c = rects[i].top + h0 / 2 + dy; to = i;
        for (var j = 0; j < rects.length; j++) { if (c >= rects[j].top && c < rects[j].bottom) { to = j; break; } }
        if (c < rects[0].top) to = 0;
        if (c >= rects[rects.length - 1].bottom) to = rects.length - 1;
        rows.forEach(function (r, j) {
          if (j === i) return;
          var sh = 0; if (i < to && j > i && j <= to) sh = -h0; if (i > to && j < i && j >= to) sh = h0;
          r.style.transform = sh ? "translateY(" + sh + "px)" : "";
        });
      }
      function up() {
        grip.removeEventListener("pointermove", mv); grip.removeEventListener("pointerup", up); grip.removeEventListener("pointercancel", up);
        ctx.move(i, to); ctx.render();
      }
      grip.addEventListener("pointermove", mv); grip.addEventListener("pointerup", up); grip.addEventListener("pointercancel", up);
    });
  }
  function openCats() {
    setDrawer(false);
    catDraft = TABS.map(function (t) { return { key: t.key, label: t.label, icon: t.icon, hidden: !!t.hidden, deleted: false, isNew: false }; });
    catChanged = false; catIconOpen = null; $("catNew").value = "";
    renderCatList(); $("catModal").hidden = false;
  }
  function closeCats(force) { if (!force && catChanged) return false; $("catModal").hidden = true; catChanged = false; return true; }
  function applyCats() {
    var pend = $("catNew").value.trim();
    if (pend) addDraft(pend);
    var live = catDraft.filter(function (x) { return !x.deleted; });
    if (live.some(function (x) { return !x.label.trim(); })) { say("이름이 비어 있는 카테고리가 있습니다.", true); return; }
    if (!catChanged) { closeCats(true); return; }
    var orig = {}; TABS.forEach(function (t) { orig[t.key] = t; });
    var draft = catDraft.slice(), delKeys = draft.filter(function (x) { return x.deleted && !x.isNew; }).map(function (x) { return x.key; });
    var hereGone = ui.view === "todo" && delKeys.indexOf(ui.tab) >= 0;
    write(function () {
      return ensureCats().then(function () {
        var ops = [];
        live.forEach(function (x, i) {
          var label = x.label.trim();
          if (x.isNew) { ops.push(db.collection("cats").add({ label: label, order: i, hidden: !!x.hidden, icon: x.icon })); return; }
          var o = orig[x.key]; if (!o) return; var ch = {};
          if (o.label !== label) ch.label = label;
          if (Number(o.icon) !== Number(x.icon)) ch.icon = x.icon;
          if (!!o.hidden !== !!x.hidden) ch.hidden = !!x.hidden;
          if (o.order !== i) ch.order = i;
          if (Object.keys(ch).length) ops.push(catRef(x.key).update(ch));
        });
        delKeys.forEach(function (k) {
          ops.push(catRef(k).delete());
          rawTodos.filter(function (t) { return t.tab === k; }).forEach(function (t) { ops.push(ref(t.id).delete()); });
        });
        return Promise.all(ops);
      });
    }, "카테고리를 저장했습니다.").then(function (ok) {
      if (!ok) return;
      closeCats(true);
      if (hereGone) go("calendar");
    });
  }
  function addDraft(v) {
    var used = {}; catDraft.forEach(function (x) { used[x.icon] = true; });
    var ic = 0; for (var k = 0; k < ICONS.length; k++) { if (!used[k]) { ic = k; break; } }
    catDraft.push({ key: "new" + (++catSeq), label: v, icon: ic, hidden: false, deleted: false, isNew: true }); catChanged = true;
  }
  $("catEdit").addEventListener("click", openCats);
  $("catX").addEventListener("click", function () { closeCats(true); });
  $("catCancel").addEventListener("click", function () { closeCats(true); });
  $("catDone").addEventListener("click", applyCats);
  $("catModal").addEventListener("click", function (e) { if (e.target === $("catModal")) closeCats(false); });
  $("catAdd").addEventListener("submit", function (e) {
    e.preventDefault();
    var v = $("catNew").value.trim(); if (!v) return;
    addDraft(v); $("catNew").value = ""; renderCatList();
    var l = $("catList"); l.scrollTop = l.scrollHeight;
  });
  $("catAdd").querySelector("button[type=submit]").textContent = "추가";


  /* ---------- 일정 종류 편집 (초안 → 완료 시 일괄 적용) ---------- */
  function kindRef(k) { return db.collection("kinds").doc(k); }
  function ensureKinds() {
    if (kindDocs && kindDocs.some(function (d) { return d.id === "cfg"; })) return Promise.resolve(true);
    var base = KINDLIST.slice();
    return Promise.all(base.map(function (k, i) { return kindRef(k.key).set({ label: k.label, color: k.color, order: i }); }))
      .then(function () { return db.collection("kinds").doc("cfg").set({ seeded: true, at: Date.now() }); })
      .then(function () { return true; });
  }
  var kindDraft = [], kindChanged = false, kindPalOpen = null, kindSeq = 0;
  var KIND_CTX = { rows: "#kindList .cat-row", grips: "#kindList .cat-grip", len: function () { return kindDraft.length; },
    move: function (i, to) { var m = kindDraft.splice(i, 1)[0]; kindDraft.splice(to, 0, m); kindChanged = true; }, render: function () { renderKindList(); } };
  function kindCount(k) { return events.filter(function (e) { return e.kind === k; }).length; }
  function renderKindList() {
    var box = $("kindList"); box.textContent = "";
    if (!kindDraft.length) box.appendChild(h("div", { class: "cat-emp", text: "종류가 없습니다. 아래에서 추가해 주세요." }));
    kindDraft.forEach(function (x, i) {
      var n = x.isNew ? 0 : kindCount(x.key);
      var row = h("div", { class: "cat-row kind-row" + (x.deleted ? " gone" : ""), "data-i": String(i) }, []);
      if (x.deleted) {
        row.appendChild(h("div", { class: "cat-conf" }, [
          h("span", { text: "‘" + x.label + "’ 삭제 예정" + (n ? " · 일정 " + n + "건은 ‘기타’로 표시" : "") }),
          h("button", { type: "button", class: "btn sm", onclick: function () { x.deleted = false; kindChanged = true; renderKindList(); } }, ["되돌리기"])
        ]));
        box.appendChild(row); return;
      }
      var grip = h("button", { type: "button", class: "icon-btn sm cat-grip", "aria-label": "순서 이동 (끌어서 이동, 키보드는 위·아래 화살표)", title: "끌어서 순서 변경" }, []);
      grip.innerHTML = svgOf(GRIP, 18); bindGrip(grip, i, KIND_CTX); row.appendChild(grip);
      var cb = h("button", { type: "button", class: "icon-btn sm cat-ic sw-btn", "aria-label": "색상 변경", title: "색상 변경", "aria-expanded": kindPalOpen === x.key ? "true" : "false",
        onclick: function () { kindPalOpen = kindPalOpen === x.key ? null : x.key; renderKindList(); } }, [h("span", { class: "sw kc kc-" + x.color })]);
      row.appendChild(cb);
      var inp = h("input", { class: "cat-in", maxlength: "12", "aria-label": "종류 이름" });
      inp.value = x.label;
      inp.addEventListener("input", function () { x.label = inp.value; kindChanged = true; });
      inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); inp.blur(); } });
      row.appendChild(inp);
      row.appendChild(h("span", { class: "cat-n", text: n + "건" }));
      row.appendChild(ibtn('<path d="M4 6h12M8 6V4h4v2M6 6l.7 10h6.6L14 6"/>', "삭제", function () {
        kindChanged = true; if (x.isNew) kindDraft.splice(i, 1); else x.deleted = true; renderKindList();
      }, { cls: "danger" }));
      box.appendChild(row);
      if (kindPalOpen === x.key) {
        var pn = h("div", { class: "pal", role: "group", "aria-label": "색상 선택" }, []);
        PALETTE.forEach(function (p) {
          var b = h("button", { type: "button", class: x.color === p[0] ? "sel" : "", "aria-label": p[1], title: p[1], "aria-pressed": x.color === p[0] ? "true" : "false",
            onclick: function () { x.color = p[0]; kindChanged = true; kindPalOpen = null; renderKindList(); } }, [h("span", { class: "sw kc kc-" + p[0] })]);
          pn.appendChild(b);
        });
        box.appendChild(pn);
      }
    });
  }
  function addKindDraft(v) {
    var used = {}; kindDraft.forEach(function (x) { used[x.color] = true; });
    var c = "blue"; for (var k = 0; k < PALETTE.length; k++) { if (!used[PALETTE[k][0]]) { c = PALETTE[k][0]; break; } }
    kindDraft.push({ key: "new" + (++kindSeq), label: v, color: c, deleted: false, isNew: true }); kindChanged = true;
  }
  function openKinds() {
    kindDraft = KINDLIST.map(function (k) { return { key: k.key, label: k.label, color: k.color, deleted: false, isNew: false }; });
    kindChanged = false; kindPalOpen = null; $("kindNew").value = "";
    renderKindList(); $("kindModal").hidden = false;
  }
  function closeKinds(force) { if (!force && kindChanged) return false; $("kindModal").hidden = true; kindChanged = false; return true; }
  function applyKinds() {
    var pend = $("kindNew").value.trim(); if (pend) addKindDraft(pend);
    var live = kindDraft.filter(function (x) { return !x.deleted; });
    if (live.some(function (x) { return !x.label.trim(); })) { say("이름이 비어 있는 종류가 있습니다.", true); return; }
    if (!kindChanged) { closeKinds(true); return; }
    var orig = {}; KINDLIST.forEach(function (k, i) { orig[k.key] = { label: k.label, color: k.color, order: i }; });
    var draft = kindDraft.slice();
    write(function () {
      return ensureKinds().then(function () {
        var ops = [];
        live.forEach(function (x, i) {
          var label = x.label.trim();
          if (x.isNew) { ops.push(db.collection("kinds").add({ label: label, color: x.color, order: i })); return; }
          var o = orig[x.key]; if (!o) return; var ch = {};
          if (o.label !== label) ch.label = label;
          if (o.color !== x.color) ch.color = x.color;
          if (o.order !== i) ch.order = i;
          if (Object.keys(ch).length) ops.push(kindRef(x.key).update(ch));
        });
        draft.filter(function (x) { return x.deleted && !x.isNew; }).forEach(function (x) { ops.push(kindRef(x.key).delete()); });
        return Promise.all(ops);
      });
    }, "일정 종류를 저장했습니다.").then(function (ok) { if (ok) { closeKinds(true); renderKinds(); } });
  }
  $("evKindEdit").addEventListener("click", openKinds);
  $("kindX").addEventListener("click", function () { closeKinds(true); });
  $("kindCancel").addEventListener("click", function () { closeKinds(true); });
  $("kindDone").addEventListener("click", applyKinds);
  $("kindModal").addEventListener("click", function (e) { if (e.target === $("kindModal")) closeKinds(false); });
  $("kindAdd").addEventListener("submit", function (e) {
    e.preventDefault();
    var v = $("kindNew").value.trim(); if (!v) return;
    addKindDraft(v); $("kindNew").value = ""; renderKindList();
    var l = $("kindList"); l.scrollTop = l.scrollHeight;
  });

  /* ---------- 날짜·시간 선택기 (자체 제작) ---------- */
  var pk = null;
  var PK_ICON_L = '<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.5 4.5L7 10l5.5 5.5"/></svg>';
  var PK_ICON_R = '<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.5 4.5L13 10l-5.5 5.5"/></svg>';
  function fmtPickDate(v) { if (!v) return ""; var d = parseDs(v); return d.getFullYear() + "." + p2(d.getMonth() + 1) + "." + p2(d.getDate()) + " (" + DOW[d.getDay()] + ")"; }
  function fmtPickTime(v) { if (!v) return ""; var a = v.split(":"), hh = Number(a[0]); return (hh < 12 ? "오전 " : "오후 ") + (hh % 12 === 0 ? 12 : hh % 12) + ":" + a[1]; }
  function fmtPickMonth(v) { return v ? monthLabel(v) : ""; }
  function syncPicks() {
    [["pkDate", "evDate", fmtPickDate, "날짜 선택"], ["pkEnd", "evEnd", fmtPickDate, "종료일 없음 (하루 일정)"],
     ["pkTime", "evTime", fmtPickTime, "시간 없음 (종일)"], ["pkMonth", "evMonth", fmtPickMonth, "월 선택"]].forEach(function (c) {
      var v = $(c[1]).value, pv = $(c[0]).querySelector(".pv");
      pv.textContent = v ? c[2](v) : c[3]; pv.className = "pv" + (v ? "" : " ph");
    });
  }
  function closePick() { $("pickModal").hidden = true; pk = null; }
  function setPickValue(v) { var cb = pk.onSet; $(pk.target).value = v; syncPicks(); closePick(); if (cb) cb(v); }
  function pkBtn(cls, txt, fn, extra) { var b = h("button", Object.assign({ type: "button", class: cls, onclick: fn }, extra || {}), []); if (txt.charAt(0) === "<") b.innerHTML = txt; else b.textContent = txt; return b; }
  function renderPick() {
    var c = $("pkCard"); c.textContent = "";
    if (pk.sub === "y") {
      c.appendChild(h("div", { class: "pk-h" }, [
        pkBtn("pk-nav", PK_ICON_L, function () { pk.yb -= 12; renderPick(); }, { "aria-label": "이전 12년" }),
        h("div", { class: "pk-t", text: pk.yb + " – " + (pk.yb + 11) }),
        pkBtn("pk-nav", PK_ICON_R, function () { pk.yb += 12; renderPick(); }, { "aria-label": "다음 12년" })
      ]));
      var yg = h("div", { class: "pk-g m" });
      for (var yy = pk.yb; yy < pk.yb + 12; yy++) (function (yy) {
        yg.appendChild(pkBtn("pk-c" + (yy === pk.y ? " sel" : ""), yy + "년", function () { pk.y = yy; pk.sub = pk.mode === "month" ? "" : "ym"; renderPick(); }));
      })(yy);
      c.appendChild(yg);
      c.appendChild(h("div", { class: "pk-f" }, [pkBtn("btn", "뒤로", function () { pk.sub = pk.mode === "month" ? "" : "ym"; renderPick(); })]));
      return;
    }
    if (pk.sub === "ym") {
      c.appendChild(h("div", { class: "pk-h" }, [
        pkBtn("pk-nav", PK_ICON_L, function () { pk.y--; renderPick(); }, { "aria-label": "이전 해" }),
        pkBtn("pk-t pk-tb", pk.y + "년 ▾", function () { pk.sub = "y"; pk.yb = pk.y - 5; renderPick(); }, { "aria-label": "연도 선택" }),
        pkBtn("pk-nav", PK_ICON_R, function () { pk.y++; renderPick(); }, { "aria-label": "다음 해" })
      ]));
      var ymg = h("div", { class: "pk-g m" });
      for (var q = 0; q < 12; q++) (function (q) {
        ymg.appendChild(pkBtn("pk-c" + (q === pk.m ? " sel" : ""), (q + 1) + "월", function () {
          if (pk.mode === "jump") { ui.cy = pk.y; ui.cm = q; closePick(); render(); return; }
          pk.m = q; pk.sub = ""; renderPick();
        }));
      })(q);
      c.appendChild(ymg);
      c.appendChild(h("div", { class: "pk-f" }, pk.mode === "jump"
        ? [pkBtn("btn", "이번 달", function () { var n = new Date(); ui.cy = n.getFullYear(); ui.cm = n.getMonth(); ui.sel = todayStr(); closePick(); render(); }), h("span", { class: "sp" }), pkBtn("btn", "닫기", closePick)]
        : [pkBtn("btn", "뒤로", function () { pk.sub = ""; renderPick(); })]));
      return;
    }
    if (pk.mode === "date") {
      var min = pk.min || "", cur = $(pk.target).value, t = todayStr();
      c.appendChild(h("div", { class: "pk-h" }, [
        pkBtn("pk-nav", PK_ICON_L, function () { pk.m--; if (pk.m < 0) { pk.m = 11; pk.y--; } renderPick(); }, { "aria-label": "이전 달" }),
        pkBtn("pk-t pk-tb", pk.y + "년 " + (pk.m + 1) + "월 ▾", function () { pk.sub = "ym"; renderPick(); }, { "aria-label": "연도·월 선택" }),
        pkBtn("pk-nav", PK_ICON_R, function () { pk.m++; if (pk.m > 11) { pk.m = 0; pk.y++; } renderPick(); }, { "aria-label": "다음 달" })
      ]));
      c.appendChild(h("div", { class: "pk-dow" }, DOW.map(function (d) { return h("span", { text: d }); })));
      var first = new Date(pk.y, pk.m, 1).getDay(), grid = h("div", { class: "pk-grid" });
      for (var i = 0; i < 42; i++) {
        (function (i) {
          var dt = new Date(pk.y, pk.m, 1 - first + i), s2 = ds(dt.getFullYear(), dt.getMonth(), dt.getDate());
          var cls = "pk-d" + (dt.getMonth() !== pk.m ? " out" : "") + (dt.getDay() === 0 ? " sun" : "") + (s2 === t ? " today" : "") + (s2 === cur ? " sel" : "");
          var b = pkBtn(cls, String(dt.getDate()), function () { setPickValue(s2); }, { "aria-label": dayLabel(s2) });
          if (min && s2 < min) b.disabled = true;
          grid.appendChild(b);
        })(i);
      }
      c.appendChild(grid);
      var f = h("div", { class: "pk-f" }, [pkBtn("btn", "오늘", function () { if (!min || t >= min) setPickValue(t); })]);
      if (pk.clear) f.appendChild(pkBtn("btn", "지우기", function () { setPickValue(""); }));
      f.appendChild(h("span", { class: "sp" })); f.appendChild(pkBtn("btn", "닫기", closePick));
      c.appendChild(f);
    } else if (pk.mode === "month") {
      var cm = $(pk.target).value;
      c.appendChild(h("div", { class: "pk-h" }, [
        pkBtn("pk-nav", PK_ICON_L, function () { pk.y--; renderPick(); }, { "aria-label": "이전 해" }),
        pkBtn("pk-t pk-tb", pk.y + "년 ▾", function () { pk.sub = "y"; pk.yb = pk.y - 5; renderPick(); }, { "aria-label": "연도 선택" }),
        pkBtn("pk-nav", PK_ICON_R, function () { pk.y++; renderPick(); }, { "aria-label": "다음 해" })
      ]));
      var mg = h("div", { class: "pk-g m" });
      for (var k = 0; k < 12; k++) (function (k) {
        var v = pk.y + "-" + p2(k + 1);
        mg.appendChild(pkBtn("pk-c" + (v === cm ? " sel" : ""), (k + 1) + "월", function () { setPickValue(v); }));
      })(k);
      c.appendChild(mg);
      c.appendChild(h("div", { class: "pk-f" }, [h("span", { class: "sp" }), pkBtn("btn", "닫기", closePick)]));
    } else {
      c.appendChild(h("div", { class: "pk-t", text: "시간 선택" }));
      c.appendChild(h("div", { class: "pk-sub", text: "시" }));
      var hg = h("div", { class: "pk-g" });
      for (var hh = 0; hh < 24; hh++) (function (hh) { hg.appendChild(pkBtn("pk-c" + (pk.hh === hh ? " sel" : ""), p2(hh), function () { pk.hh = hh; renderPick(); })); })(hh);
      c.appendChild(hg);
      c.appendChild(h("div", { class: "pk-sub", text: "분" }));
      var mgm = h("div", { class: "pk-g" });
      for (var mm = 0; mm < 60; mm += pk.step) (function (mm) { mgm.appendChild(pkBtn("pk-c" + (pk.mi === mm ? " sel" : ""), p2(mm), function () { pk.mi = mm; renderPick(); })); })(mm);
      c.appendChild(mgm);
      c.appendChild(h("div", { class: "pk-f" }, [
        pk.required ? null : pkBtn("btn", pk.clearLabel || "시간 없음", function () { setPickValue(""); }), pk.allow24 ? pkBtn("btn", "24:00", function () { setPickValue("24:00"); }) : null, h("span", { class: "sp" }),
        pkBtn("btn", "취소", closePick), pkBtn("btn primary", "선택 " + p2(pk.hh) + ":" + p2(pk.mi), function () { setPickValue(p2(pk.hh) + ":" + p2(pk.mi)); })
      ]));
    }
  }
  function openJump() { pk = { sub: "ym", mode: "jump", target: "", clear: false, min: "", y: ui.cy, m: ui.cm }; renderPick(); $("pickModal").hidden = false; }
  $("calTitle").addEventListener("click", openJump);
  $("calTitle").addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openJump(); } });
  function openPick(mode, target, opts) {
    opts = opts || {};
    var cur = $(target).value;
    pk = { sub: "", mode: mode, target: target, clear: !!opts.clear, min: opts.min || "", step: opts.step || 5, required: !!opts.required, allow24: !!opts.allow24, clearLabel: opts.clearLabel || "", onSet: opts.onSet || null };
    if (mode === "time") { var a = (cur || "09:00").split(":"); pk.hh = Math.min(23, Number(a[0])); pk.mi = Math.round(Number(a[1]) / pk.step) * pk.step % 60; }
    else {
      var base = cur ? (mode === "month" ? new Date(Number(cur.slice(0, 4)), Number(cur.slice(5, 7)) - 1, 1) : parseDs(cur))
        : (opts.min ? parseDs(opts.min) : new Date());
      pk.y = base.getFullYear(); pk.m = base.getMonth();
    }
    renderPick(); $("pickModal").hidden = false;
  }
  $("pkDate").addEventListener("click", function () { openPick("date", "evDate"); });
  $("pkEnd").addEventListener("click", function () { openPick("date", "evEnd", { clear: true, min: $("evDate").value }); });
  $("pkTime").addEventListener("click", function () { openPick("time", "evTime"); });
  $("pkMonth").addEventListener("click", function () { openPick("month", "evMonth"); });
  $("pickModal").addEventListener("click", function (e) { if (e.target === $("pickModal")) closePick(); });
  function growNote() { var n = $("evNote"); n.style.height = "auto"; n.style.height = Math.min(n.scrollHeight + 2, 160) + "px"; n.style.overflowY = n.scrollHeight > 160 ? "auto" : "hidden"; }
  $("evNote").addEventListener("input", growNote);
  $("fab").addEventListener("click", function () { if (ui.view === "todo") setAdding(true); else openEv(ui.sel); });
  (function () {
    var last = new WeakMap();
    document.addEventListener("scroll", function (e) {
      var t = e.target; if (!t || t === document || !t.scrollTop && t.scrollTop !== 0) return;
      if (t.id !== "main" && t.id !== "list" && t.id !== "upList") return;
      var y = t.scrollTop, p = last.has(t) ? last.get(t) : 0; last.set(t, y);
      var f = $("fab");
      if (y <= 24 || y < p - 4) f.classList.remove("hide"); else if (y > p + 4) f.classList.add("hide");
    }, true);
  })();
  $("addForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var area = $("fArea").value.trim(), problem = $("fProblem").value.trim();
    if (!area || !problem) return;
    if (ui.editId) {
      var editId = ui.editId;
      write(function () {
        return ref(editId).update({ area: area, problem: problem, fix: $("fFix").value.trim(), priority: Number($("fPrio").value) });
      }, "항목을 수정했습니다.").then(function (ok) { if (ok) { $("addForm").reset(); setPrio(2); setAdding(false); } });
      return;
    }
    var maxOrder = items.filter(function (i) { return i.tab === ui.tab; }).reduce(function (m, i) { return Math.max(m, i.order || 0); }, 0);
    write(function () {
      return db.collection("todos").add({
        tab: ui.tab, area: area, problem: problem, fix: $("fFix").value.trim(), priority: Number($("fPrio").value),
        done: false, dropped: false, note: "", order: maxOrder + 1, createdAt: Date.now()
      });
    }, "항목을 추가했습니다.").then(function () { $("addForm").reset(); setPrio(2); setAdding(false); });
  });

  /* ---------- 비밀번호 잠금 (이 브라우저 안에서만 동작) ---------- */
  function cryptoOk() { return !!(window.crypto && window.crypto.subtle && window.TextEncoder && window.crypto.getRandomValues); }
  function b64(buf) { var a = new Uint8Array(buf), s = ""; for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s); }
  function unb64(s) { var b = atob(s), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
  function derive(pw, salt, iter) {
    return crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]).then(function (k) {
      return crypto.subtle.deriveBits({ name: "PBKDF2", salt: salt, iterations: iter, hash: "SHA-256" }, k, 256);
    }).then(b64);
  }
  function readLock() {
    var raw = lsGet(LS.lock); if (!raw) return null;
    try { var o = JSON.parse(raw); if (o && o.s && o.h && o.i) return o; } catch (e) {}
    return null;
  }
  function saveLock(pw) {
    var salt = crypto.getRandomValues(new Uint8Array(16)), iter = 200000;
    return derive(pw, salt, iter).then(function (hh) {
      if (!lsSet(LS.lock, JSON.stringify({ v: 1, s: b64(salt), h: hh, i: iter }))) throw new Error("storage");
      lsDel(LS.skip);
    });
  }
  function checkLock(pw) {
    var l = readLock(); if (!l) return Promise.resolve(false);
    return derive(pw, unb64(l.s), l.i).then(function (hh) { return hh === l.h; });
  }
  function pwProblem(pw, pw2) {
    if (pw.length < 6) return "비밀번호는 6자 이상으로 정해 주세요.";
    if (pw !== pw2) return "두 비밀번호가 같지 않습니다.";
    return "";
  }

  var gateMode = "", fails = 0, blockedUntil = 0;
  function showGate(mode) {
    gateMode = mode;
    $("app").hidden = true; $("gate").hidden = false; $("evModal").hidden = true; $("lockModal").hidden = true; $("addModal").hidden = true; $("pickModal").hidden = true; $("tpAddModal").hidden = true; $("tpLinkModal").hidden = true; $("tpSessModal").hidden = true; $("tpTimeModal").hidden = true;
    $("gPw").value = ""; $("gPw2").value = ""; $("gMsg").textContent = ""; $("gReset").hidden = true;
    var setup = mode === "setup";
    $("gPw2W").hidden = !setup;
    $("gPw").setAttribute("autocomplete", setup ? "new-password" : "current-password");
    $("gateTitle").textContent = setup ? "비밀번호를 정해 주세요" : "비밀번호를 입력하세요";
    $("gateNote").textContent = setup
      ? "이 브라우저에서 열 때마다 비밀번호를 묻습니다. 비밀번호는 서버로 보내지 않고 이 브라우저에만 암호화해 저장합니다."
      : "";
    $("gGo").textContent = setup ? "잠금 켜고 들어가기" : "들어가기";
    $("gAlt").textContent = setup ? "잠금 없이 사용" : "비밀번호를 잊었어요";
    try { $("gPw").focus(); } catch (e) {}
  }
  function enterApp() {
    $("gate").hidden = true; $("app").hidden = false;
    if (!started) { started = true; render(); start(); } else render();
  }
  $("gateForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var pw = $("gPw").value, msg = $("gMsg");
    msg.textContent = "";
    if (gateMode === "setup") {
      var bad = pwProblem(pw, $("gPw2").value);
      if (bad) { msg.textContent = bad; return; }
      saveLock(pw).then(function () { ssSet(SS, "1"); enterApp(); }).catch(function () {
        msg.textContent = "비밀번호를 저장하지 못했습니다. 브라우저의 사이트 데이터 저장이 막혀 있는지 확인해 주세요.";
      });
      return;
    }
    var now = Date.now();
    if (now < blockedUntil) { msg.textContent = Math.ceil((blockedUntil - now) / 1000) + "초 뒤에 다시 시도해 주세요."; return; }
    if (!pw) { msg.textContent = "비밀번호를 입력해 주세요."; return; }
    checkLock(pw).then(function (ok) {
      if (ok) { fails = 0; ssSet(SS, "1"); enterApp(); return; }
      fails++;
      if (fails >= 5) { fails = 0; blockedUntil = Date.now() + 30000; msg.textContent = "여러 번 틀렸습니다. 30초 뒤에 다시 시도해 주세요."; }
      else msg.textContent = "비밀번호가 맞지 않습니다.";
      $("gPw").value = "";
    }).catch(function () { msg.textContent = "확인하지 못했습니다. 잠시 후 다시 시도해 주세요."; });
  });
  $("gAlt").addEventListener("click", function () {
    if (gateMode === "setup") { lsSet(LS.skip, "1"); enterApp(); }
    else $("gReset").hidden = false;
  });
  $("gResetNo").addEventListener("click", function () { $("gReset").hidden = true; });
  $("gResetYes").addEventListener("click", function () { lsDel(LS.lock); ssDel(SS); showGate("setup"); });

  var lockOn = false;
  function openLock() {
    setDrawer(false);
    var avail = storageOk() && cryptoOk();
    lockOn = !!readLock();
    $("lkMsg").textContent = ""; $("lkCur").value = ""; $("lkNew").value = ""; $("lkNew2").value = "";
    if (!avail) {
      $("lockInfo").textContent = "이 브라우저에서는 잠금을 쓸 수 없습니다. 사이트 데이터 저장이나 암호화 기능이 막혀 있습니다.";
      $("lkCurW").hidden = true; $("lkNewW").hidden = true; $("lkNew2W").hidden = true;
      $("lkSave").hidden = true; $("lkOff").hidden = true; $("lkNow").hidden = true;
    } else if (lockOn) {
      $("lockInfo").textContent = "잠금이 켜져 있습니다. 비밀번호를 바꾸려면 현재 비밀번호와 새 비밀번호를 입력하세요. 이 비밀번호는 이 브라우저에만 저장됩니다.";
      $("lkCurW").hidden = false; $("lkNewW").hidden = false; $("lkNew2W").hidden = false;
      $("lkNewL").textContent = "새 비밀번호 (6자 이상, 바꿀 때만)";
      $("lkSave").hidden = false; $("lkSave").textContent = "비밀번호 변경";
      $("lkOff").hidden = false; $("lkNow").hidden = false;
    } else {
      $("lockInfo").textContent = "잠금을 켜면 이 브라우저에서 열 때마다 비밀번호를 묻습니다. 다른 브라우저나 기기에서는 따로 정해야 합니다.";
      $("lkCurW").hidden = true; $("lkNewW").hidden = false; $("lkNew2W").hidden = false;
      $("lkNewL").textContent = "새 비밀번호 (6자 이상)";
      $("lkSave").hidden = false; $("lkSave").textContent = "잠금 켜기";
      $("lkOff").hidden = true; $("lkNow").hidden = true;
    }
    $("lockModal").hidden = false;
  }
  function closeLock() { $("lockModal").hidden = true; }
  qsa("[data-lock-btn]").forEach(function (b) { b.addEventListener("click", openLock); });
  $("lkClose").addEventListener("click", closeLock);
  $("lockModal").addEventListener("click", function (e) { if (e.target === $("lockModal")) closeLock(); });
  $("lkNow").addEventListener("click", function () { ssDel(SS); closeLock(); showGate("unlock"); });
  $("lkOff").addEventListener("click", function () {
    var msg = $("lkMsg"); msg.textContent = "";
    if (!$("lkCur").value) { msg.textContent = "현재 비밀번호를 입력해 주세요."; return; }
    checkLock($("lkCur").value).then(function (ok) {
      if (!ok) { msg.textContent = "현재 비밀번호가 맞지 않습니다."; return; }
      lsDel(LS.lock); lsSet(LS.skip, "1"); closeLock(); say("잠금을 껐습니다.");
    }).catch(function () { msg.textContent = "확인하지 못했습니다. 잠시 후 다시 시도해 주세요."; });
  });
  $("lockForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var msg = $("lkMsg"); msg.textContent = "";
    var np = $("lkNew").value, np2 = $("lkNew2").value;
    var bad = pwProblem(np, np2);
    if (bad) { msg.textContent = bad; return; }
    var done = function () { ssSet(SS, "1"); closeLock(); say(lockOn ? "비밀번호를 바꿨습니다." : "잠금을 켰습니다."); };
    var fail = function () { msg.textContent = "저장하지 못했습니다. 잠시 후 다시 시도해 주세요."; };
    if (lockOn) {
      if (!$("lkCur").value) { msg.textContent = "현재 비밀번호를 입력해 주세요."; return; }
      checkLock($("lkCur").value).then(function (ok) {
        if (!ok) { msg.textContent = "현재 비밀번호가 맞지 않습니다."; return; }
        return saveLock(np).then(done);
      }).catch(fail);
    } else {
      saveLock(np).then(done).catch(fail);
    }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if ($("app").classList.contains("drawer-open")) { setDrawer(false); return; }
    if (!$("pickModal").hidden) closePick();
    else if (!$("tpSessModal").hidden) tpCloseSess();
    else if (!$("tpLinkModal").hidden) tpCloseLink();
    else if (!$("tpAddModal").hidden) tpCloseAdd();
    else if (!$("tpTimeModal").hidden) tpCloseTime();
    else if (ui.pSheet) tpCloseSheet();
    else if (!$("kindModal").hidden) closeKinds(false);
    else if (!$("catModal").hidden) closeCats(false);
    else if (!$("addModal").hidden) setAdding(false);
    else if (!$("evModal").hidden) closeEv();
    else if (!$("lockModal").hidden) closeLock();
  });

  /* ---------- 저장소(db) 연결: 잠금을 통과한 뒤에만 시작 ---------- */
  function start() {
    if (!window.claude || !window.claude.use) { ready = true; loadError = "이 화면에서는 저장 기능이 켜지지 않습니다. claude.ai에서 열어 주세요."; render(); return; }
    window.claude.use("db").then(function (d) {
      if (!d) { ready = true; loadError = "claude.ai에 로그인한 상태에서 열어 주세요."; render(); return; }
      db = d;
      db.collection("events").onSnapshot(function (snap) {
        events = snap.docs.map(function (doc) { return Object.assign({}, doc.data() || {}, { id: doc.id }); })
          .filter(function (v) { return (v.date || v.month) && v.title; })
          .sort(function (a, b) { var x = (a.date || "9999") + (a.time || "99:99"), y = (b.date || "9999") + (b.time || "99:99"); return x < y ? -1 : (x > y ? 1 : 0); });
        evLoaded = true;
        render();
      }, function () {});
      db.collection("plans").onSnapshot(function (snap) {
        plLoaded = true;
        rawPlans = snap.docs.map(function (doc) { return Object.assign({}, doc.data() || {}, { id: doc.id }); });
        refilterPlans();
        renderSafe();
      }, function () {});
      db.collection("kinds").onSnapshot(function (snap) {
        kindDocs = snap.docs.map(function (doc) { return Object.assign({}, doc.data() || {}, { id: doc.id }); });
        rebuildKinds();
        if (!$("evModal").hidden) renderKinds();
        renderSafe();
      }, function () {});
      db.collection("cats").onSnapshot(function (snap) {
        catDocs = snap.docs.map(function (doc) { return Object.assign({}, doc.data() || {}, { id: doc.id }); });
        rebuildTabs(); refilterItems(); renderSafe();
      }, function () {});
      db.collection("todos").onSnapshot(function (snap) {
        rawTodos = snap.docs.map(function (doc) { return Object.assign({ tab: "resume" }, doc.data() || {}, { id: doc.id }); });
        refilterItems();
        ready = true; loadError = ""; renderSafe();
      }, function (err) {
        ready = true; loadError = "항목을 불러오지 못했습니다. 페이지를 새로 고쳐 주세요."; render();
      });
    }).catch(function () { ready = true; loadError = "저장소에 연결하지 못했습니다."; render(); });
  }

  function boot() {
    if (!storageOk() || !cryptoOk()) { enterApp(); return; }
    var lock = readLock();
    if (lock) { if (ssGet(SS) === "1") enterApp(); else showGate("unlock"); }
    else if (lsGet(LS.skip) === "1") enterApp();
    else showGate("setup");
  }
  boot();
})();
