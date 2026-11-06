-- CAREER BOARD 샘플 데이터 (모두 가상) · schema.sql을 먼저 실행한 뒤 사용합니다.
-- local-db.js의 가상 샘플과 같은 내용이며, 기준일은 2026-11-05로 고정했습니다.
-- 실행: sqlite3 career-board.db < schema.sql && sqlite3 career-board.db < sample-data.sql

PRAGMA foreign_keys = ON;
BEGIN;

INSERT INTO kinds (id, label, color, sort_order) VALUES
  ('deadline',  '서류 마감', 'red',   0),
  ('interview', '면접',      'teal',  1),
  ('cert',      '자격증',    'amber', 2),
  ('etc',       '기타',      'slate', 3);

INSERT INTO cats (id, label, icon, sort_order, hidden) VALUES
  ('resume',    '이력서',     0, 0, 0),
  ('career',    '기술경력서', 1, 1, 0),
  ('portfolio', '포트폴리오', 2, 2, 0),
  ('prep',      '취업',       3, 3, 0);

INSERT INTO events (id, date, month, end_date, time, title, kind, note, created_at) VALUES
  ('sample-e0', '2026-11-06', '', '', '14:00', 'A사 백엔드 1차 면접', 'interview', '자기소개 1분, 프로젝트 2개 정리', 1793847600000),
  ('sample-e1', '2026-11-08', '', '', '18:00', 'B사 서류 마감', 'deadline', '포트폴리오 링크 확인', 1793847600000),
  ('sample-e2', '2026-11-11', '', '2026-11-13', '', '알고리즘 집중 학습', 'etc', '', 1793847600000),
  ('sample-e3', '2026-11-15', '', '', '10:00', '정보처리기사 실기', 'cert', '신분증, 수험표', 1793847600000),
  ('sample-e4', '2026-11-19', '', '', '', 'C사 코딩 테스트', 'interview', '', 1793847600000),
  ('sample-e5', '', '2026-12', '', '', 'D사 최종 면접 (날짜 미정)', 'interview', '월만 확정', 1793847600000);

INSERT INTO todos (id, tab, area, problem, fix, priority, done, done_at, dropped, dropped_at, note, sort_order, created_at) VALUES
  ('sample-t0', 'resume', '자기소개', '지원 동기가 회사마다 비슷해 보임', '회사별 사업·기술 키워드를 한 문장씩 추가', 1, 0, NULL, 0, NULL, '', 0, 1793847600000),
  ('sample-t1', 'resume', '경력 요약', '성과 수치가 빠져 있음', '개선 전후 수치를 괄호로 병기', 2, 0, NULL, 0, NULL, '', 1, 1793847600000),
  ('sample-t2', 'resume', '형식', '날짜 표기가 섞여 있음', 'YYYY.MM 형식으로 통일', 3, 1, 1793847600000, 0, NULL, '', 2, 1793847600000),
  ('sample-t3', 'career', '프로젝트 A', '맡은 역할과 기여도가 불분명함', '담당 모듈과 기간을 표로 정리', 1, 0, NULL, 0, NULL, '', 3, 1793847600000),
  ('sample-t4', 'career', '사용 기술', '버전 정보가 없음', '주요 라이브러리 버전 추가', 3, 0, NULL, 0, NULL, '', 4, 1793847600000),
  ('sample-t5', 'portfolio', 'README', '실행 방법과 스크린샷이 없음', '설치·실행 단계와 화면 캡처 추가', 1, 0, NULL, 0, NULL, '', 5, 1793847600000),
  ('sample-t6', 'portfolio', '데모', '배포 링크가 없음', '정적 호스팅으로 데모 공개', 2, 0, NULL, 0, NULL, '', 6, 1793847600000),
  ('sample-t7', 'prep', '면접 질문', '프로젝트 심화 질문 답변 준비 부족', '예상 질문 10개 작성 후 소리 내어 연습', 2, 0, NULL, 0, NULL, '', 7, 1793847600000),
  ('sample-t8', 'prep', '코딩 테스트', '그래프 유형 정확도가 낮음', 'BFS/DFS 문제 주 5개', 2, 0, NULL, 0, NULL, '', 8, 1793847600000),
  ('sample-t9', 'prep', '자격증', '어학 점수 갱신', '정기 시험 일정 확인 후 접수', 3, 0, NULL, 1, 1793847600000, '[포기 사유] 지원 자격에 필요하지 않아 제외', 9, 1793847600000);

INSERT INTO plans (id, date, title, start_time, end_time, plan_min, focus_started_at, focus_ended_at, status, done_at, focus_min, rest_min, excluded, created_at, updated_at) VALUES
  ('sample-p0', '2026-11-05', '알고리즘 문제 풀이', '07:30', '08:30', 60, 1793831520000, 1793834700000, 'done', 1793834700000, 53, 0, 0, 1793847600000, 1793847600000),
  ('sample-p1', '2026-11-05', '이력서 경력 요약 고치기', '09:00', '10:00', 60, 1793837100000, 1793839200000, 'partial', 1793839200000, 35, 0, 0, 1793847600000, 1793847600000),
  ('sample-p2', '2026-11-05', '프로젝트 A 역할 표 정리', '14:00', '15:30', 90, NULL, NULL, 'wait', NULL, NULL, NULL, 0, 1793847600000, 1793847600000),
  ('sample-p3', '2026-11-05', '예상 면접 질문 작성', '16:00', '17:00', 60, NULL, NULL, 'wait', NULL, NULL, NULL, 0, 1793847600000, 1793847600000),
  ('sample-p4', '2026-11-04', '코딩 테스트 복습', '20:00', '21:00', 60, 1793790180000, 1793793480000, 'done', 1793793480000, 49, 6, 0, 1793847600000, 1793847600000),
  ('sample-p5', '2026-11-04', '자기소개 다듬기', '21:00', '22:00', 60, NULL, NULL, 'wait', NULL, NULL, NULL, 0, 1793847600000, 1793847600000);

INSERT INTO plan_todos (plan_id, todo_id) VALUES
  ('sample-p1', 'sample-t1'),
  ('sample-p2', 'sample-t3'),
  ('sample-p3', 'sample-t7'),
  ('sample-p5', 'sample-t1');

INSERT INTO plan_tabs (plan_id, tab_id) VALUES
  ('sample-p1', 'resume'),
  ('sample-p2', 'career'),
  ('sample-p3', 'prep'),
  ('sample-p5', 'resume');

INSERT INTO focus_pauses (plan_id, from_at, to_at) VALUES
  ('sample-p4', 1793791800000, 1793792160000);

COMMIT;
