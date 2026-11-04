/*
 * local-db.js
 * Claude 아티팩트 안에서는 window.claude.use("db")가 데이터 저장소를 제공합니다.
 * 그 밖의 환경(GitHub Pages, 로컬 파일 등)에서는 같은 인터페이스를 브라우저 localStorage로 흉내 내서
 * app.js를 고치지 않고도 동작하게 합니다.
 *
 * 지원하는 메서드: collection(name).add / onSnapshot, collection(name).doc(id).set / update / delete
 * update()에서 값이 { __delete__: true } 이면 해당 필드를 지웁니다.
 *
 * 처음 열면 가상의 샘플 일정·할 일이 들어갑니다. 날짜는 오늘 기준으로 계산하므로 항상 최근 데이터처럼 보입니다.
 * 실제 개인 데이터는 이 저장소에 없고, 사용자의 브라우저 안에만 저장됩니다.
 */
(function () {
  "use strict";
  if (window.claude && typeof window.claude.use === "function") return;

  var PREFIX = "cb.db.v1.";
  var SEEDED = PREFIX + "seeded";
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

  function seed() {
    try { if (localStorage.getItem(SEEDED) === "1") return; } catch (e) { return; }
    var now = Date.now();
    var events = [
      { date: iso(1),  month: "", endDate: "",       time: "14:00", title: "A사 백엔드 1차 면접", kind: "interview", note: "자기소개 1분, 프로젝트 2개 정리" },
      { date: iso(3),  month: "", endDate: "",       time: "18:00", title: "B사 서류 마감",       kind: "deadline",  note: "포트폴리오 링크 확인" },
      { date: iso(6),  month: "", endDate: iso(8),   time: "",      title: "알고리즘 집중 학습",  kind: "etc",       note: "" },
      { date: iso(10), month: "", endDate: "",       time: "10:00", title: "정보처리기사 실기",   kind: "cert",      note: "신분증, 수험표" },
      { date: iso(14), month: "", endDate: "",       time: "",      title: "C사 코딩 테스트",     kind: "interview", note: "" },
      { date: "",      month: ym(30), endDate: "",    time: "",      title: "D사 최종 면접 (날짜 미정)", kind: "interview", note: "월만 확정" }
    ].map(function (e) { e.createdAt = now; return e; });

    var todos = [
      { tab: "resume",    area: "자기소개",   problem: "지원 동기가 회사마다 비슷해 보임",           fix: "회사별 사업·기술 키워드를 한 문장씩 추가", priority: 1, done: false },
      { tab: "resume",    area: "경력 요약",  problem: "성과 수치가 빠져 있음",                       fix: "개선 전후 수치를 괄호로 병기",             priority: 2, done: false },
      { tab: "resume",    area: "형식",       problem: "날짜 표기가 섞여 있음",                       fix: "YYYY.MM 형식으로 통일",                   priority: 3, done: true  },
      { tab: "career",    area: "프로젝트 A", problem: "맡은 역할과 기여도가 불분명함",               fix: "담당 모듈과 기간을 표로 정리",             priority: 1, done: false },
      { tab: "career",    area: "사용 기술",  problem: "버전 정보가 없음",                            fix: "주요 라이브러리 버전 추가",               priority: 3, done: false },
      { tab: "portfolio", area: "README",     problem: "실행 방법과 스크린샷이 없음",                 fix: "설치·실행 단계와 화면 캡처 추가",           priority: 1, done: false },
      { tab: "portfolio", area: "데모",       problem: "배포 링크가 없음",                            fix: "정적 호스팅으로 데모 공개",                priority: 2, done: false },
      { tab: "prep",      area: "면접 질문",  problem: "프로젝트 심화 질문 답변 준비 부족",           fix: "예상 질문 10개 작성 후 소리 내어 연습",     priority: 2, done: false },
      { tab: "prep",      area: "코딩 테스트", problem: "그래프 유형 정확도가 낮음",                  fix: "BFS/DFS 문제 주 5개",                     priority: 2, done: false },
      { tab: "prep",      area: "자격증",     problem: "어학 점수 갱신",                              fix: "정기 시험 일정 확인 후 접수",              priority: 3, done: false, dropped: true, note: "[포기 사유] 지원 자격에 필요하지 않아 제외" }
    ].map(function (t, i) { t.note = t.note || ""; t.order = i; t.createdAt = now; if (t.dropped) t.droppedAt = now; return t; });

    var ev = {}, td = {};
    events.forEach(function (e, i) { ev["sample-e" + i] = e; });
    todos.forEach(function (t, i) { td["sample-t" + i] = t; });
    try {
      save("events", ev); save("todos", td);
      localStorage.setItem(SEEDED, "1");
    } catch (e) {}
  }

  seed();

  window.claude = {
    use: function (name) {
      return Promise.resolve(name === "db" ? { collection: collection } : null);
    }
  };
})();
