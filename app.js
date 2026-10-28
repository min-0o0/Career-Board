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
  var ui = { view: "calendar", tab: "resume", status: "all", prio: 0, q: "", open: {}, confirm: null, adding: false, editId: null };
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

  /* ---------- 할 일 ---------- */
  function toggle(it) {
    var next = !it.done;
    write(function () { return ref(it.id).update({ done: next, doneAt: next ? Date.now() : { __delete__: true } }); });
  }
  function saveNote(it, val) {
    if ((it.note || "") === val) return;
    write(function () { return ref(it.id).update({ note: val }); }, "메모를 저장했습니다.");
  }
  function remove(it) {
    ui.confirm = null;
    write(function () { return ref(it.id).delete(); }, "항목을 삭제했습니다.");
  }
  function matches(it) {
    if (it.tab !== ui.tab) return false;
    if (ui.status === "open" && it.done) return false;
    if (ui.status === "done" && !it.done) return false;
    if (ui.prio && it.priority !== ui.prio) return false;
    if (ui.q) {
      var hay = [it.area, it.problem, it.fix, it.note].join(" ").toLowerCase();
      if (hay.indexOf(ui.q.toLowerCase()) < 0) return false;
    }
    return true;
  }
  function rowEl(it) {
    var open = !!ui.open[it.id];
    var chk = h("button", { class: "check", type: "button", "aria-label": (it.done ? "완료 취소: " : "완료 처리: ") + it.area, "aria-pressed": it.done ? "true" : "false", onclick: function () { toggle(it); } });
    chk.innerHTML = CHECK;
    var main = h("button", { class: "main-btn", type: "button", "aria-expanded": open ? "true" : "false", onclick: function () { ui.open[it.id] = !open; render(); } }, [
      h("span", { class: "area", text: it.area }),
      h("span", { class: "ttl", text: it.problem })
    ]);
    var side = h("div", { class: "side-info" }, [
      h("span", { class: "pill p" + it.priority, text: PRIO[it.priority] }),
      h("div", { class: "dates" }, [
        it.createdAt ? h("span", { class: "when sub", text: "등록 " + fmt(it.createdAt) }) : null,
        it.done ? h("span", { class: "when", text: "완료 " + (it.doneAt ? fmt(it.doneAt) : "날짜 없음") }) : null
      ])
    ]);
    var row = h("div", { class: "row" + (it.done ? " done" : "") }, [h("div", { class: "row-top" }, [chk, main, side])]);
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
        del = h("button", { class: "btn sm", type: "button", onclick: function () { ui.confirm = it.id; render(); } }, ["삭제"]);
      }
      var edit = h("button", { class: "btn sm", type: "button", "aria-label": "항목 수정: " + it.area, onclick: function () { setAdding(true, it); } }, ["수정"]);
      row.appendChild(h("div", { class: "detail" }, [
        h("dl", { style: "margin:0;display:grid;gap:12px" }, [
          h("div", null, [h("dt", { text: "자세한 메모" }), h("dd", { text: it.fix || "아직 적지 않았습니다." })]),
          h("div", null, [h("dt", { text: "일정" }), h("dd", { class: "stamps" }, [
            h("span", { text: "등록 " + (it.createdAt ? fmtT(it.createdAt) : "기록 없음") }),
            h("span", { class: it.done ? "done-at" : "", text: it.done ? "완료 " + (it.doneAt ? fmtT(it.doneAt) : "기록 없음") : "아직 완료하지 않음" })
          ])]),
          h("div", null, [h("dt", { text: "진행 메모" }), ta])
        ]),
        h("div", { class: "detail-actions" }, [edit, del])
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
  (function () { var n = new Date(); ui.cy = n.getFullYear(); ui.cm = n.getMonth(); ui.sel = todayStr(); ui.confirmEv = null; })();

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

  /* ---------- 화면 전환 ---------- */
  function applyHash(s) {
    if (tabKeyOk(s)) { ui.view = "todo"; ui.tab = s; return true; }
    if (s === "calendar" || s === "upcoming") { ui.view = s; return true; }
    return false;
  }
  try { applyHash((location.hash || "").slice(1)); } catch (e) {}
  function go(name) {
    setDrawer(false);
    applyHash(name);
    ui.confirm = null; ui.confirmEv = null;
    render();
    try { location.hash = name; } catch (e) {}
    try { $("main").scrollTop = 0; } catch (e) {}
  }
  window.addEventListener("hashchange", function () {
    var s = ""; try { s = (location.hash || "").slice(1); } catch (e) {}
    if (applyHash(s)) { ui.confirm = null; ui.confirmEv = null; if (started) render(); }
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
      var mine = items.filter(function (i) { return i.tab === t.key; });
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
    $("sLeft").textContent = String(items.filter(function (i) { return !i.done && !tabHidden(i.tab); }).length);
    var cur = ui.view === "todo" ? ui.tab : ui.view;
    qsa("[data-go]").forEach(function (b) {
      if (b.getAttribute("data-go") === cur) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
    TABS.forEach(function (t) {
      var mine = items.filter(function (i) { return i.tab === t.key; });
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
    $("fab").setAttribute("aria-label", ui.view === "todo" ? "항목 추가" : "일정 추가"); $("fab").title = ui.view === "todo" ? "항목 추가" : "일정 추가"; $("fab").classList.remove("hide");
  }

  function renderTodoView() {
    $("todoTitle").textContent = tabLabel(ui.tab);
    renderTabs();
    var tabItems = items.filter(function (i) { return i.tab === ui.tab; });
    var total = tabItems.length, done = tabItems.filter(function (i) { return i.done; }).length;
    var pct = total ? Math.round(done / total * 100) : 0;
    $("barFill").style.width = pct + "%";
    $("bar").setAttribute("aria-valuenow", String(pct));
    $("pct").firstChild.nodeValue = pct + "%";
    $("hpct").textContent = pct + "%  ·  " + done + "/" + total;
    $("count").textContent = done + " / " + total + " 완료";

    var sum = $("prioSum"); sum.textContent = "";
    [1, 2, 3].forEach(function (p) {
      var all = tabItems.filter(function (i) { return i.priority === p; });
      var left = all.filter(function (i) { return !i.done; }).length;
      if (all.length) sum.appendChild(h("span", { class: "pill p" + p, text: PRIO[p] + " " + left + "/" + all.length }));
    });

    var list = $("list"); list.textContent = "";
    if (!ready) { list.appendChild(h("div", { class: "empty" }, [h("b", { text: "불러오는 중" }), "저장된 항목을 확인하고 있습니다."])); return; }
    if (loadError) { list.appendChild(h("div", { class: "empty" }, [h("b", { text: "저장소를 사용할 수 없습니다" }), loadError])); return; }
    if (!total) { list.appendChild(h("div", { class: "empty" }, [h("b", { text: "아직 항목이 없습니다" }), "‘+ 항목 추가’로 이 탭에서 할 일을 적어 보세요."])); return; }

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
    if (!shown) wrap.appendChild(h("div", { class: "empty" }, [h("b", { text: "조건에 맞는 항목이 없습니다" }), "필터나 검색어를 바꿔 보세요."]));
    list.appendChild(wrap);
  }

  function render() {
    renderChrome();
    if (ui.view === "calendar") renderCalView();
    else if (ui.view === "upcoming") renderUpView();
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
  function setPickValue(v) { $(pk.target).value = v; syncPicks(); closePick(); }
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
      for (var mm = 0; mm < 60; mm += 5) (function (mm) { mgm.appendChild(pkBtn("pk-c" + (pk.mi === mm ? " sel" : ""), p2(mm), function () { pk.mi = mm; renderPick(); })); })(mm);
      c.appendChild(mgm);
      c.appendChild(h("div", { class: "pk-f" }, [
        pkBtn("btn", "시간 없음", function () { setPickValue(""); }), h("span", { class: "sp" }),
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
    pk = { sub: "", mode: mode, target: target, clear: !!opts.clear, min: opts.min || "" };
    if (mode === "time") { var a = (cur || "09:00").split(":"); pk.hh = Number(a[0]); pk.mi = Math.round(Number(a[1]) / 5) * 5 % 60; }
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
        done: false, note: "", order: maxOrder + 1, createdAt: Date.now()
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
    $("app").hidden = true; $("gate").hidden = false; $("evModal").hidden = true; $("lockModal").hidden = true; $("addModal").hidden = true; $("pickModal").hidden = true;
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
        render();
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
