/*
 * local-db.js
 * Claude 아티팩트 안에서는 window.claude.use("db")가 데이터 저장소를 제공합니다.
 * 그 밖의 환경(GitHub Pages, 로컬 파일 등)에서는 같은 인터페이스를 브라우저 localStorage로 흉내 내서
 * app.js를 고치지 않고도 동작하게 합니다.
 *
 * 지원하는 메서드: collection(name).add / onSnapshot, collection(name).doc(id).set / update / delete
 * update()에서 값이 { __delete__: true } 이면 해당 필드를 지웁니다.
 *
 * 처음 열면 가상의 샘플 일정·할 일·오늘 계획이 들어갑니다. 날짜는 오늘 기준으로 계산하므로 항상 최근 데이터처럼 보입니다.
 * 실제 개인 데이터는 이 저장소에 없고, 사용자의 브라우저 안에만 저장됩니다.
 */
(function () {
  "use strict";
  if (window.claude && typeof window.claude.use === "function") return;

  var PREFIX = "cb.db.v1.";
  var SEEDED = PREFIX + "seeded";
  var PLANS_SEEDED = PREFIX + "plans-seeded";   /* 계획(plans) 샘플은 따로 한 번만 넣는다(이미 샘플을 받은 브라우저에도 추가) */
  var listeners = {};

  function load(name) {
    try { return JSON.parse(localStorage.getItem(PREFIX + name) || "{}") || {}; } catch (e) { return {}; }
  }
  function save(name, obj) {
    try {
      localStorage.setItem(PREFIX + name, JSON.stringify(obj));
    } catch (e) {
      var err = new Error("quota"); err.code = "quota_exceeded"; throw err;
    }
  }
  function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function snapshot(name) {
    var all = load(name);
    return {
      docs: Object.keys(all).map(function (id) {
        return { id: id, data: function () { return JSON.parse(JSON.stringify(all[id])); } };
      })
    };
  }
  function notify(name) {
    (listeners[name] || []).forEach(function (fn) { try { fn(snapshot(name)); } catch (e) {} });
  }
  function ok(fn) {
    return new Promise(function (resolve, reject) {
      try { resolve(fn()); } catch (e) { reject(e); }
    });
  }
  function applyUpdate(target, patch) {
    Object.keys(patch).forEach(function (k) {
      var v = patch[k];
      if (v && typeof v === "object" && v.__delete__) delete target[k];
      else target[k] = v;
    });
    return target;
  }

  function collection(name) {
    return {
      add: function (data) {
        return ok(function () {
          var all = load(name), id = newId();
          all[id] = applyUpdate({}, data || {});
          save(name, all); notify(name);
          return { id: id };
        });
      },
      doc: function (id) {
        return {
          set: function (data) {
            return ok(function () {
              var all = load(name); all[id] = applyUpdate({}, data || {});
              save(name, all); notify(name);
            });
          },
          update: function (patch) {
            return ok(function () {
              var all = load(name);
              if (!all[id]) all[id] = {};
              applyUpdate(all[id], patch || {});
              save(name, all); notify(name);
            });
          },
          delete: function () {
            return ok(function () {
              var all = load(name); delete all[id];
              save(name, all); notify(name);
            });
          }
        };
      },
      onSnapshot: function (cb) {
        (listeners[name] = listeners[name] || []).push(cb);
        setTimeout(function () { try { cb(snapshot(name)); } catch (e) {} }, 0);
        return function () {
          listeners[name] = (listeners[name] || []).filter(function (f) { return f !== cb; });
        };
      }
    };
  }

  /* 다른 탭에서 바뀐 내용도 반영 */
  window.addEventListener("storage", function (e) {
    if (e.key && e.key.indexOf(PREFIX) === 0 && e.key !== SEEDED) notify(e.key.slice(PREFIX.length));
  });

  /* ---------- 샘플 데이터 (모두 가상) ---------- */
  function iso(offsetDays) {
    var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + offsetDays);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function ym(offsetDays) { return iso(offsetDays).slice(0, 7); }
  function p2(n) { return String(n).padStart(2, "0"); }
  function hm(min) { return p2(Math.floor(min / 60)) + ":" + p2(min % 60); }
  /* 오늘(offsetDays=0) 0시 기준 min분 지점의 타임스탬프 */
  function atMin(offsetDays, min) { var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + offsetDays); return d.getTime() + min * 60000; }
  /* 오늘 계획 샘플의 기준 시각: 지금 시각을 15분 단위로 맞추고 12:00~19:00 안으로 제한한다.
     오늘의 계획 배치(끝난 계획은 기준 앞, 대기 계획은 기준 뒤)를 이 시각에 맞춰 계산하므로 언제 열어도 비슷한 모양이 된다. */
  function baseMin() {
    var n = new Date(), m = Math.round((n.getHours() * 60 + n.getMinutes()) / 15) * 15;
    return Math.min(19 * 60, Math.max(12 * 60, m));
  }

  /* 일정 종류별 색, 서류 마감·면접 D-day, 마감 임박(7일 이내), 날짜 미정, 기간 일정, 같은 시각 겹침을 한 달 안에 보여 주는 예제 */
  function seed() {
    try { if (localStorage.getItem(SEEDED) === "1") return; } catch (e) { return; }
    var now = Date.now(), B = baseMin();
    var events = [
      /* 0 */ { date: iso(0),  month: "", endDate: "",     time: hm(B + 15),  title: "E사 실무 면접(화상)",       kind: "interview", note: "화상 링크 미리 접속, 화면 공유 준비" },
      /* 1 */ { date: iso(0),  month: "", endDate: "",     time: hm(B + 105), title: "스터디 모임",               kind: "ssafy",     note: "알고리즘 3주차 문제 리뷰" },
      /* 2 */ { date: iso(1),  month: "", endDate: "",     time: "14:00",     title: "A사 백엔드 1차 면접",       kind: "interview", note: "자기소개 1분, 프로젝트 2개 정리" },
      /* 3 */ { date: iso(2),  month: "", endDate: "",     time: "18:00",     title: "F사 서류 마감",             kind: "deadline",  note: "자기소개서 3번 문항 최종 확인" },
      /* 4 */ { date: iso(3),  month: "", endDate: "",     time: "18:00",     title: "B사 서류 마감",             kind: "deadline",  note: "포트폴리오 링크 확인" },
      /* 5 */ { date: iso(3),  month: "", endDate: "",     time: "18:00",     title: "G사 온라인 코딩 테스트",    kind: "interview", note: "B사 마감과 같은 시각" },
      /* 6 */ { date: iso(4),  month: "", endDate: iso(6), time: "",          title: "팀 프로젝트 기간",          kind: "ssafy",     note: "" },
      /* 7 */ { date: iso(7),  month: "", endDate: "",     time: "",          title: "C사 서류 마감",             kind: "deadline",  note: "접수 사이트에서 마감 시각 확인" },
      /* 8 */ { date: iso(9),  month: "", endDate: iso(10), time: "",         title: "알고리즘 집중 학습",        kind: "etc",       note: "" },
      /* 9 */ { date: iso(11), month: "", endDate: "",     time: "10:00",     title: "정보처리기사 실기",         kind: "cert",      note: "신분증, 수험표" },
      /* 10 */ { date: iso(14), month: "", endDate: "",    time: "",          title: "H사 코딩 테스트",           kind: "interview", note: "" },
      /* 11 */ { date: "",      month: ym(20), endDate: "", time: "",         title: "D사 최종 면접 (날짜 미정)", kind: "interview", note: "월만 확정" },
      /* 12 */ { date: iso(-3), month: "", endDate: "",     time: "14:00",     title: "특강 참석",                 kind: "ssafy",     note: "" }
    ].map(function (e) { e.createdAt = now; return e; });

    /* 우선순위가 섞인 할 일, 완료(done)·포기(dropped) 항목. 번호는 아래 오늘·어제 계획의 todoIds가 가리키는 sample-t번호와 같다. */
    var todos = [
      /* 0 */  { tab: "resume",    area: "자기소개",    problem: "지원 동기가 회사마다 비슷해 보임",   fix: "회사별 사업·기술 키워드를 한 문장씩 추가", priority: 1 },
      /* 1 */  { tab: "resume",    area: "경력 요약",   problem: "성과 수치가 빠져 있음",               fix: "개선 전후 수치를 괄호로 병기",             priority: 2 },
      /* 2 */  { tab: "resume",    area: "형식",        problem: "날짜 표기가 섞여 있음",               fix: "YYYY.MM 형식으로 통일",                   priority: 3, done: atMin(-1, 650) },
      /* 3 */  { tab: "resume",    area: "기술 스택",   problem: "기술 이름 대소문자가 제각각임",       fix: "공식 표기로 통일",                         priority: 3, done: atMin(-2, 900) },
      /* 4 */  { tab: "career",    area: "프로젝트 A",  problem: "맡은 역할과 기여도가 불분명함",       fix: "담당 모듈과 기간을 표로 정리",             priority: 1 },
      /* 5 */  { tab: "career",    area: "프로젝트 B",  problem: "성과 지표가 없음",                    fix: "응답 시간·사용자 수 같은 수치 추가",       priority: 2 },
      /* 6 */  { tab: "career",    area: "사용 기술",   problem: "버전 정보가 없음",                    fix: "주요 라이브러리 버전 추가",               priority: 3 },
      /* 7 */  { tab: "career",    area: "형식",        problem: "프로젝트 기간 표기가 빠짐",           fix: "시작·종료 연월 기입",                      priority: 2, done: atMin(-3, 1000) },
      /* 8 */  { tab: "portfolio", area: "README",      problem: "실행 방법과 스크린샷이 없음",         fix: "설치·실행 단계와 화면 캡처 추가",           priority: 1, done: atMin(0, B - 152) },
      /* 9 */  { tab: "portfolio", area: "데모",        problem: "배포 링크가 없음",                    fix: "정적 호스팅으로 데모 공개",                priority: 2 },
      /* 10 */ { tab: "portfolio", area: "코드 정리",   problem: "불필요한 파일이 섞여 있음",           fix: "저장소 정리",                              priority: 3, dropped: true, note: "[포기 사유] 비공개 저장소로 전환해 제외" },
      /* 11 */ { tab: "portfolio", area: "소개 문구",   problem: "프로젝트 한 줄 소개가 약함",          fix: "해결한 문제 중심으로 다시 쓰기",           priority: 1 },
      /* 12 */ { tab: "prep",      area: "면접 질문",   problem: "프로젝트 심화 질문 답변 준비 부족",   fix: "예상 질문 10개 작성 후 소리 내어 연습",     priority: 1 },
      /* 13 */ { tab: "prep",      area: "코딩 테스트", problem: "그래프 유형 정확도가 낮음",           fix: "BFS/DFS 문제 주 5개",                     priority: 2 },
      /* 14 */ { tab: "prep",      area: "자격증",      problem: "어학 점수 갱신",                      fix: "정기 시험 일정 확인 후 접수",              priority: 3, dropped: true, note: "[포기 사유] 지원 자격에 필요하지 않아 제외" },
      /* 15 */ { tab: "prep",      area: "회사 조사",   problem: "지원 회사 최근 소식 정리 안 됨",      fix: "회사별 보도자료 3건씩 요약",               priority: 2, done: atMin(-1, 1100) },
      /* 16 */ { tab: "prep",      area: "CS 복습",     problem: "운영체제 스케줄링 개념 흐림",         fix: "핵심 알고리즘 4개 비교표 작성",            priority: 3, done: atMin(-4, 800) },
      /* 17 */ { tab: "resume",    area: "맞춤법",      problem: "맞춤법 검사를 안 함",                 fix: "검사기로 전체 점검",                       priority: 3, done: atMin(-2, 1200) }
    ].map(function (t, i) {
      var doneAt = typeof t.done === "number" ? t.done : 0;
      t.done = !!doneAt; if (doneAt) t.doneAt = doneAt;
      t.dropped = !!t.dropped; if (t.dropped) t.droppedAt = now - 86400000;
      t.note = t.note || ""; t.order = i; t.createdAt = now - (10 + (17 - i)) * 86400000;
      return t;
    });

    var ev = {}, td = {};
    events.forEach(function (e, i) { ev["sample-e" + i] = e; });
    todos.forEach(function (t, i) { td["sample-t" + i] = t; });
    try {
      save("events", ev); save("todos", td);
      localStorage.setItem(SEEDED, "1");
    } catch (e) {}
  }

  /* 오늘 계획 · 진행 샘플 (모두 가상). 오늘은 기준 시각(지금)을 중심으로 배치한다.
     - 완료 2(쉰 구간 있음) · 절반 1 · 집중 중 1(쉰 구간 있음, 일시정지 아님) · 대기 3(일정에서 온 점선 계획 1 포함)
     - 겹침: 집중 중인 계획과 면접 계획, 예상 질문 계획과 스터디 일정(계획에서 제외한 일정)
     어제는 완료·절반·실패(집중하지 못한 계획)를 둔다. 연결한 할 일은 위 샘플 할 일(sample-t…)을 가리킨다. */
  function seedPlans() {
    try { if (localStorage.getItem(PLANS_SEEDED) === "1") return; } catch (e) { return; }
    var now = Date.now(), B = baseMin();
    function plan(day, title, s, e, todoIds, tabs, focus, status, extra) {
      var p = { date: iso(day), title: title, start: hm(s), end: hm(e), planMin: e - s, eventId: "", todoIds: todoIds, tabs: tabs, carriedFrom: "",
                focus: focus || null, status: status || "wait", createdAt: now, updatedAt: now };
      if (focus && focus.endedAt != null) {
        var rest = 0; (focus.pauses || []).forEach(function (q) { rest += (q.to - q.from); });
        p.doneAt = focus.endedAt;
        p.focusMin = Math.round((focus.endedAt - focus.startedAt - rest) / 60000);
        p.restMin = Math.round(rest / 60000);
      }
      if (extra) Object.keys(extra).forEach(function (k) { p[k] = extra[k]; });
      return p;
    }
    function done(day, s, e, pauses) { return { startedAt: atMin(day, s), endedAt: atMin(day, e), pauses: (pauses || []).map(function (q) { return { from: atMin(day, q[0]), to: atMin(day, q[1]) }; }) }; }
    var live = { startedAt: now - 43 * 60000, endedAt: null, pauses: [{ from: now - 30 * 60000, to: now - 24 * 60000 }] };
    var plans = [
      /* 오늘 */
      plan(0, "알고리즘 문제 풀이",         B - 390, B - 330, [],            [],            done(0, B - 388, B - 335, [[B - 360, B - 353]]), "done"),
      plan(0, "이력서 경력 요약 고치기",     B - 300, B - 240, ["sample-t1"], ["resume"],    done(0, B - 297, B - 262), "partial"),
      plan(0, "포트폴리오 README 보강",      B - 210, B - 150, ["sample-t8"], ["portfolio"], done(0, B - 207, B - 152, [[B - 180, B - 176]]), "done"),
      plan(0, "프로젝트 A 역할 표 정리",     B - 45,  B + 45,  ["sample-t4"], ["career"],    live, "doing"),
      plan(0, "E사 실무 면접(화상)",         B + 15,  B + 75,  [],            [],            null, "wait", { eventId: "sample-e0" }),
      plan(0, "스터디 모임",                 B + 105, B + 165, [],            [],            null, "wait", { eventId: "sample-e1", excluded: true }),
      plan(0, "예상 면접 질문 작성",         B + 120, B + 180, ["sample-t12"], ["prep"],     null, "wait"),
      plan(0, "그래프(BFS/DFS) 문제 풀이",   B + 240, B + 300, ["sample-t13"], ["prep"],     null, "wait"),
      /* 어제 */
      plan(-1, "이력서 형식 정리",           600,  660,  ["sample-t2"], ["resume"], done(-1, 603, 655), "done"),
      plan(-1, "포트폴리오 데모 배포",       840,  930,  [],            [],         null, "wait"),
      plan(-1, "코딩 테스트 복습",           1020, 1080, [],            [],         done(-1, 1023, 1078, [[1050, 1056]]), "done"),
      plan(-1, "자기소개 다듬기",            1110, 1170, ["sample-t0"], ["resume"], null, "wait"),
      plan(-1, "CS 복습",                    1200, 1260, [],            [],         done(-1, 1202, 1232), "partial")
    ];
    var pl = {};
    plans.forEach(function (p, i) { pl["sample-p" + i] = p; });
    try {
      save("plans", pl);
      localStorage.setItem(PLANS_SEEDED, "1");
    } catch (e) {}
  }

  seed();
  seedPlans();

  window.claude = {
    use: function (name) {
      return Promise.resolve(name === "db" ? { collection: collection } : null);
    }
  };
})();
