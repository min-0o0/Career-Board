-- CAREER BOARD DB 스키마 (참고용 관계형 설계 · SQLite 문법)
--
-- 주의: 실제 앱은 SQL을 쓰지 않습니다.
--   - Claude 아티팩트: window.claude.use("db") 문서형 저장소
--   - 이 저장소(Git) 버전: local-db.js가 같은 구조를 브라우저 localStorage에 JSON으로 저장
-- 이 파일은 같은 구조를 관계형으로 옮기면 어떻게 되는지 보여 주는 설계 문서입니다.
-- 명세서(career-board-db-spec.pptx)와 함께 봅니다.
--
-- 문서형 -> 관계형으로 바뀌는 부분
--   * order는 SQL 예약어라 sort_order로 씁니다 (cats, kinds, todos)
--   * 날짜 미정 등의 "" 값은 문서형 그대로 빈 문자열을 씁니다. 연결 컬럼(event_id, carried_from)만 NULL을 씁니다
--   * 배열 plans.todoIds[]  -> plan_todos 테이블
--   * 배열 plans.tabs[]     -> plan_tabs 테이블
--   * 객체 plans.focus      -> plans.focus_started_at / focus_ended_at + focus_pauses 테이블
--   * boolean은 0/1, 타임스탬프는 밀리초 정수
--
-- 실행: sqlite3 career-board.db < schema.sql

PRAGMA foreign_keys = ON;

-- 일정 종류 (색: blue teal green amber orange red purple slate)
CREATE TABLE kinds (
  id          TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  color       TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

-- 문서 탭
CREATE TABLE cats (
  id          TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  icon        INTEGER NOT NULL DEFAULT 0,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  hidden      INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0, 1))
);

-- 일정
CREATE TABLE events (
  id          TEXT PRIMARY KEY,
  date        TEXT NOT NULL DEFAULT '' CHECK (date = '' OR date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  month       TEXT NOT NULL DEFAULT '' CHECK (month = '' OR month GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
  end_date    TEXT NOT NULL DEFAULT '' CHECK (end_date = '' OR end_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  time        TEXT NOT NULL DEFAULT '' CHECK (time = '' OR time GLOB '[0-9][0-9]:[0-9][0-9]'),
  title       TEXT NOT NULL,
  kind        TEXT NOT NULL REFERENCES kinds(id),
  note        TEXT NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER,
  -- month는 날짜 미정 일정에만 입력
  CHECK (NOT (date <> '' AND month <> ''))
);
CREATE INDEX idx_events_date ON events(date);

-- 문서별 할 일
CREATE TABLE todos (
  id          TEXT PRIMARY KEY,
  tab         TEXT NOT NULL REFERENCES cats(id),
  area        TEXT NOT NULL DEFAULT '',
  problem     TEXT NOT NULL DEFAULT '',
  fix         TEXT NOT NULL DEFAULT '',
  priority    INTEGER NOT NULL DEFAULT 2 CHECK (priority IN (1, 2, 3)),  -- 1 높음 / 2 중간 / 3 낮음
  done        INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1)),
  done_at     INTEGER,
  dropped     INTEGER NOT NULL DEFAULT 0 CHECK (dropped IN (0, 1)),
  dropped_at  INTEGER,
  note        TEXT NOT NULL DEFAULT '',                                   -- 포기 사유는 "[포기 사유] ..."
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  CHECK (NOT (done = 1 AND dropped = 1)),                                 -- 완료와 포기는 동시에 불가
  CHECK (done = 1 OR done_at IS NULL),
  CHECK (dropped = 1 OR dropped_at IS NULL)
);
CREATE INDEX idx_todos_tab ON todos(tab, sort_order);

-- 오늘 계획 · 진행
CREATE TABLE plans (
  id                TEXT PRIMARY KEY,
  date              TEXT NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),  -- 계획을 시작한 날(통계 기준일)
  title             TEXT NOT NULL,
  start_time        TEXT NOT NULL CHECK (start_time GLOB '[0-9][0-9]:[0-9][0-9]'),  -- 00:00 ~ 23:59
  end_time          TEXT NOT NULL CHECK (end_time   GLOB '[0-9][0-9]:[0-9][0-9]'),  -- 24시 넘으면 25:30, 최대 48:00
  plan_min          INTEGER NOT NULL CHECK (plan_min > 0),
  event_id          TEXT REFERENCES events(id),   -- 일정에서 온 계획이면 원본 일정, 아니면 NULL
  carried_from      TEXT REFERENCES plans(id),    -- 어제 이월분이면 원본 계획, 아니면 NULL
  focus_started_at  INTEGER,                      -- focus.startedAt (집중 전에는 NULL)
  focus_ended_at    INTEGER,                      -- focus.endedAt (집중 중·일시정지 중이면 NULL)
  status            TEXT NOT NULL DEFAULT 'wait' CHECK (status IN ('wait', 'doing', 'done', 'partial')),  -- fail은 저장하지 않고 화면에서 계산
  done_at           INTEGER,
  focus_min         INTEGER,                      -- 집중이 끝난 뒤에만 기록 (쉰 시간 제외)
  rest_min          INTEGER,                      -- 집중이 끝난 뒤에만 기록
  excluded          INTEGER NOT NULL DEFAULT 0 CHECK (excluded IN (0, 1)),
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER
);
CREATE INDEX idx_plans_date ON plans(date);
-- 일정에서 자동 생성한 계획은 일정당 하루 1개
CREATE UNIQUE INDEX uq_plans_event_day ON plans(event_id, date) WHERE event_id IS NOT NULL;

-- plans.todoIds[] : 한 할 일을 여러 계획에 연결할 수 있음 (같은 계획 안 중복은 PK로 막음)
CREATE TABLE plan_todos (
  plan_id  TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  todo_id  TEXT NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
  PRIMARY KEY (plan_id, todo_id)
);

-- plans.tabs[] : 연결한 할 일의 문서 탭 (통계용 파생 값)
CREATE TABLE plan_tabs (
  plan_id  TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  tab_id   TEXT NOT NULL REFERENCES cats(id),
  PRIMARY KEY (plan_id, tab_id)
);

-- plans.focus.pauses[] : 쉰 구간 (지금 쉬는 중이면 to_at이 NULL)
CREATE TABLE focus_pauses (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id  TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  from_at  INTEGER NOT NULL,
  to_at    INTEGER,
  CHECK (to_at IS NULL OR to_at >= from_at)
);
CREATE INDEX idx_pauses_plan ON focus_pauses(plan_id);
