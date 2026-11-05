/*
 * CAREER BOARD DB 명세서(career-board-db-spec.pptx) 생성 스크립트
 *
 * 사용법 (docs/db 폴더에서)
 *   1) ERD 갱신:  dot -Tpng erd.dot -o erd.png      (graphviz 필요)
 *   2) PPT 생성:  node build.js                    (pptxgenjs 필요, OUT=경로 로 출력 위치 변경 가능)
 *
 * 수정 방법: 아래 표 데이터(컬럼 행, 관계, 수정 내역)를 고친 뒤 다시 실행합니다.
 *   - 수정 내역은 "1. 수정 내역 기록" 부분의 hist 배열에 한 줄씩 추가합니다.
 *   - 목차의 쪽수(toc 배열)는 페이지가 늘거나 줄면 함께 고칩니다.
 * 테마 적용(applyTheme)은 pptx 스킬의 scripts/apply_theme.js를 사용하며, 없으면 테마 색 적용만 건너뜁니다.
 */
const pptxgen = require("pptxgenjs");
const fs = require("fs");
const path = require("path");
const HERE = __dirname;
const OUT = process.env.OUT || path.join(HERE, "career-board-db-spec.pptx");
const ERD = path.join(HERE, "erd.png");
let applyTheme = null;
try {
  const root = "/root/.claude/skills/synced";
  const found = fs.readdirSync(root).map(d => path.join(root, d, "pptx/scripts/apply_theme.js")).find(p => fs.existsSync(p));
  if (found) applyTheme = require(found).applyTheme;
} catch (e) {}

const FONT = "Malgun Gothic";
const THEME = { name:"CareerBoardSpec", headFontFace:FONT, bodyFontFace:FONT,
  colors:{ dk1:"1F2937", lt1:"FFFFFF", dk2:"16213E", lt2:"F3F5FA",
    accent1:"3D5EA0", accent2:"0F766E", accent3:"5B6B8C", accent4:"D97706", accent5:"B91C1C", accent6:"7C3AED",
    hlink:"3D5EA0", folHlink:"5B6B8C" } };

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.title = "CAREER BOARD DB 명세서";
pres.theme = { headFontFace:FONT, bodyFontFace:FONT };
const C = pres.SchemeColor;

pres.defineSlideMaster({ title:"TITLE_DARK", masterName:"TITLE_DARK", background:{ color:C.text2 },
  objects:[], slideNumber:undefined });
pres.defineSlideMaster({ title:"CONTENT", masterName:"CONTENT", background:{ color:C.background1 },
  objects:[
    { text:{ text:"CAREER BOARD · DB 명세서", options:{ x:0.6, y:7.05, w:6, h:0.3, fontSize:10, color:C.accent3, margin:0 } } },
    { placeholder:{ options:{ name:"title", type:"title", x:0.6, y:0.35, w:12.1, h:0.75, fontSize:26, bold:true, color:C.text2, margin:0, valign:"middle", align:"left" }, text:"" } },
  ],
  slideNumber:{ x:12.2, y:7.05, w:0.55, h:0.3, fontSize:10, color:C.accent3, align:"right" } });

const HDR = { bold:true, color:"FFFFFF", fill:{ color:"16213E" }, fontSize:11.5, valign:"middle", align:"left" };
function table(slide, header, rows, colW, opt={}) {
  const x = opt.x ?? 0.6, y = opt.y ?? 1.35;
  const fs = opt.fs ?? 11;
  const data = [ header.map(t=>({ text:t, options:{...HDR, fontSize:fs+0.5} })) ];
  rows.forEach((r,i)=> data.push(r.map((t,j)=>({ text:String(t), options:{
      fontSize:fs, color:"1F2937", valign:"middle",
      fill:{ color: i%2 ? "F3F5FA" : "FFFFFF" },
      bold: (opt.boldFirst ?? true) && j===0 } }))));
  slide.addTable(data, { x, y, w:colW.reduce((a,b)=>a+b,0), colW, rowH:opt.rowH ?? 0.4,
    border:{ type:"solid", pt:0.75, color:"CBD2E1" }, margin:[0.04,0.08,0.04,0.08], fontFace:FONT, autoPage:false });
}
function note(slide, text, y, h=0.5) {
  slide.addText(text, { x:0.6, y, w:12.1, h, fontSize:12, color:"5B6B8C", valign:"top", margin:0, isTextBox:true });
}
function mk(title, sec) {
  const s = pres.addSlide({ masterName:"CONTENT", sectionTitle:sec });
  s.addText(title, { placeholder:"title" });
  return s;
}


const CW=[1.5,1.1,0.7,3.9,4.9];
const CH=["컬럼","타입","키","설명","값 규칙"];
function colTable(title, rows, o={}) {
  const sl = mk(title, "5. 컬렉션 명세");
  table(sl, o.header||CH, rows, o.cw||CW, { rowH:o.rowH??0.43, fs:o.fs??11 });
  if (o.note) note(sl, o.note, o.noteY??6.2, 0.7);
  return sl;
}

// 1 Title
pres.addSection({ title:"표지" });
let s = pres.addSlide({ masterName:"TITLE_DARK", sectionTitle:"표지" });
s.addShape(pres.ShapeType.ellipse, { x:0.9, y:1.5, w:0.9, h:0.9, fill:{ color:C.accent2 }, line:{ color:C.accent2 }, objectName:"Motif" });
s.addText("DB", { x:0.9, y:1.5, w:0.9, h:0.9, align:"center", valign:"middle", fontSize:22, bold:true, color:"FFFFFF", margin:0, isTextBox:true });
s.addText("CAREER BOARD", { x:0.9, y:2.7, w:11, h:0.6, fontSize:20, color:"B8C4E0", margin:0, isTextBox:true });
s.addText("데이터베이스 명세서", { x:0.9, y:3.3, w:11, h:1.1, fontSize:44, bold:true, color:"FFFFFF", margin:0, isTextBox:true });
s.addText("컬렉션(테이블) · 컬럼 · 관계 · 목적과 역할 · ERD · 수정 내역", { x:0.9, y:4.6, w:11, h:0.5, fontSize:16, color:"B8C4E0", margin:0, isTextBox:true });
s.addText("문서 버전 v1.2 · 작성일 2026-11-05 · 기준: 게시 버전 1793848507-3e74", { x:0.9, y:6.5, w:11.5, h:0.4, fontSize:12, color:"8E9BBA", margin:0, isTextBox:true });

// 2 TOC
pres.addSection({ title:"목차" });
s = mk("목차", "목차");
const toc = [
  ["1","수정 내역 기록","수정할 때마다 한 줄씩 기록하는 페이지","3"],
  ["2","구성 개요","컬렉션 5개의 목적과 역할","4"],
  ["3","전체 DB 구성 관계 ERD","컬렉션 사이의 관계도","5"],
  ["4","관계 정의","외래키와 카디널리티","6"],
  ["5","컬렉션 명세","events · todos · cats · kinds · plans · focus · status","7–14"],
  ["6","데이터 규칙 · 제약","값 표기, 완료·포기, 연결, 보안, 권한 규칙","15"],
];
toc.forEach((t,i)=>{
  const y = 1.45 + i*0.9;
  s.addShape(pres.ShapeType.ellipse, { x:0.8, y, w:0.62, h:0.62, fill:{ color:C.accent1 }, line:{ color:C.accent1 }, objectName:"TocNo"+t[0] });
  s.addText(t[0], { x:0.8, y, w:0.62, h:0.62, align:"center", valign:"middle", fontSize:16, bold:true, color:"FFFFFF", margin:0, isTextBox:true });
  s.addText(t[1], { x:1.7, y:y-0.02, w:7, h:0.38, fontSize:18, bold:true, color:C.text2, margin:0, isTextBox:true });
  s.addText(t[2], { x:1.7, y:y+0.34, w:8.5, h:0.3, fontSize:12, color:C.accent3, margin:0, isTextBox:true });
  s.addText("p. "+t[3], { x:11.3, y:y+0.1, w:1.4, h:0.4, fontSize:16, color:C.accent1, align:"right", margin:0, isTextBox:true });
});

// 3 history (item 1)
pres.addSection({ title:"1. 수정 내역" });
s = mk("1. 수정 내역 기록", "1. 수정 내역");
const hist = [
  ["v1.0","2026-11-05","추가","plans 컬렉션","오늘 계획·진행용 plans 컬렉션(18개 필드) 추가, 명세서 최초 작성","기준 게시 버전 1793848507-3e74","소유자"],
  ["v1.1","2026-11-05","변경","문서 전체","수정 내역을 1번 항목으로 이동, 목차 추가, 일정 종류 목록 정리, 설명/값 규칙 열 분리, 페이지당 표 1개로 재구성","문서 구성 개선","소유자"],
  ["v1.2","2026-11-05","추가","docs/db/schema.sql, sample-data.sql","참고용 관계형 DDL(SQLite)과 가상 샘플 데이터 파일 추가. 실제 저장소 구조는 변경 없음","배열·focus는 연결 테이블로 분리","소유자"],
];
while (hist.length < 8) hist.push(["","","","","","",""]);
table(s, ["버전","수정일","구분","대상 (컬렉션.컬럼)","수정 내용","사유 / 비고","수정자"], hist,
  [0.8,1.3,0.9,2.2,3.9,2.2,0.8], { rowH:0.46, fs:10.5 });
note(s, "기록 방법: 컬렉션·컬럼·관계를 바꿀 때마다 맨 아래 빈 행에 한 줄씩 추가합니다. 구분은 추가·변경·삭제 중 하나, 버전은 컬럼 변경 시 올림(v1.1, v1.2 …), 구조 변경 시 정수 올림(v2.0)으로 적습니다. 컬렉션 구조가 바뀌면 프로젝트 지침의 \"컬렉션 구조\"도 함께 고칩니다.", 6.05, 0.9);

// 4 Overview
pres.addSection({ title:"2~4. 개요·관계" });
s = mk("2. 구성 개요 — 컬렉션 5개", "2~4. 개요·관계");
table(s, ["컬렉션","한글명","목적 / 역할","주 사용 화면","행 단위"], [
  ["events","일정","서류 마감·면접·자격증 등 날짜가 있는 일정을 저장","달력, 오늘 계획(원본 일정)","일정 1건"],
  ["todos","할 일","문서 탭별로 해야 할 일·문제점과 해결 방법, 우선순위·완료·포기 상태를 관리","문서 탭(이력서·기술경력서 등), 진행률","할 일 1건"],
  ["cats","문서 탭","할 일을 나누는 탭 구분(이력서·기술경력서·포트폴리오·취업). 추가·이름 변경·숨김·순서 변경 가능","문서 탭 바, 할 일 분류","탭 1개"],
  ["kinds","일정 종류","일정 분류(서류 마감·면접·자격증·기타)와 표시 색","달력 범례, 일정 입력","종류 1개"],
  ["plans","오늘 계획·진행","하루 시간표에 올린 계획과 집중(타이머) 기록, 통계의 원천","오늘 계획·진행, 통계","계획 1건"],
], [1.3,1.6,5.0,2.9,1.3], { rowH:0.7 });
note(s, "저장소는 아티팩트 DB(window.claude.use(\"db\"))이며 모든 컬렉션은 소유자만 읽고 씁니다. 문서 id \"cfg\"는 cats·kinds의 설정용이므로 건드리지 않습니다.", 6.0, 0.7);

// 5 ERD
s = mk("3. 전체 DB 구성 관계 ERD", "2~4. 개요·관계");
const imgH = 5.5, imgW = imgH*2068/1387;
s.addImage({ path:ERD, x:0.6, y:1.3, w:imgW, h:imgH, altText:"CAREER BOARD 컬렉션 관계 ERD", objectName:"ERD" });
s.addText([
  { text:"범례", options:{ bold:true, breakLine:true } },
  { text:"PK 기본키 · FK 외래키", options:{ breakLine:true } },
  { text:"선 끝 까마귀발 = 여러 개(N)", options:{ breakLine:true } },
  { text:"선 끝 막대 = 하나(1)", options:{ breakLine:true } },
  { text:" ", options:{ breakLine:true } },
  { text:"plans는 일정·할 일을 참조해 하루 계획을 만들고, 어제 계획을 이월하면 자기 자신을 참조합니다.", options:{} },
], { x:0.6+imgW+0.25, y:1.4, w:12.73-(0.6+imgW+0.25), h:3.8, fontSize:11.5, color:"1F2937", valign:"top", margin:0, paraSpaceAfter:4, isTextBox:true });

// 6 Relations
s = mk("4. 관계 정의", "2~4. 개요·관계");
table(s, ["#","자식 컬럼(FK)","부모 키(PK)","관계","필수","설명"], [
  ["R1","events.kind","kinds.id","N : 1","필수","일정은 반드시 현재 kinds에 있는 key 하나를 가진다"],
  ["R2","todos.tab","cats.id","N : 1","필수","할 일은 문서 탭 하나에 속한다"],
  ["R3","plans.eventId","events.id","N : 1","선택","일정에서 온 계획이면 원본 일정 id, 직접 만든 계획이면 \"\""],
  ["R4","plans.todoIds[]","todos.id","1 : N","선택","계획에 연결한 할 일 id 배열. 한 할 일은 한 계획에만 연결"],
  ["R5","plans.carriedFrom","plans.id","N : 1","선택","어제 계획을 이월한 경우 원본 plan id, 아니면 \"\" (자기 참조)"],
  ["R6","plans.tabs[]","cats.id","N : M","선택","연결한 할 일의 탭 key 모음. 통계용 파생 값"],
], [0.6,2.3,1.9,1.1,0.9,5.3], { rowH:0.62 });
note(s, "DB 차원의 외래키 제약은 없습니다. 참조 무결성(존재하는 id인지, 한 할 일은 한 계획에만 연결되는지)은 화면 코드가 지킵니다. 일정·할 일을 삭제할 때 plans의 참조도 함께 확인해야 합니다.", 5.95, 0.8);

// 7.. collection specs (one table per page)
pres.addSection({ title:"5. 컬렉션 명세" });
colTable("5-1. events (일정)", [
  ["id","string","PK","문서 고유 식별자","자동 생성"],
  ["date","string","","일정 날짜","\"YYYY-MM-DD\". 날짜 미정이면 \"\""],
  ["month","string","","날짜 미정 일정의 대상 월","날짜 미정일 때만 \"YYYY-MM\", 확정이면 \"\""],
  ["endDate","string","","기간 일정의 종료일","\"YYYY-MM-DD\". 단일 일정이면 \"\""],
  ["time","string","","일정 시각","\"HH:MM\". 시간 미정이면 \"\""],
  ["title","string","","일정 제목","한눈에 알 수 있는 짧은 문자열"],
  ["kind","string","FK","일정 종류","kinds.id 중 하나 (deadline·interview·cert·etc)"],
  ["note","string","","메모","제목과 겹치지 않는 핵심만. 비밀번호·키·주민번호·계좌번호 저장 금지"],
  ["createdAt","number","","생성 시각","밀리초 타임스탬프"],
  ["updatedAt","number","","수정 시각","밀리초 타임스탬프"],
], { rowH:0.46 });

colTable("5-2. todos (문서별 할 일)", [
  ["id","string","PK","문서 고유 식별자","자동 생성"],
  ["tab","string","FK","속한 문서 탭","cats.id (resume·career·portfolio·prep 등)"],
  ["area","string","","구분(항목 영역)","자유 입력"],
  ["problem","string","","해야 할 일 또는 문제점","자유 입력"],
  ["fix","string","","해결 방법","자유 입력"],
  ["priority","number","","우선순위","1 높음 / 2 중간 / 3 낮음"],
  ["done","boolean","","완료 여부","완료 시 doneAt 기록, 되돌리면 doneAt 제거"],
  ["doneAt","number","","완료 시각","밀리초. 미완료이면 없음"],
  ["dropped","boolean","","포기 여부","없으면 false. done과 동시에 true 불가"],
  ["droppedAt","number","","포기 시각","되살리거나 완료하면 제거"],
  ["note","string","","메모","포기 사유는 \"[포기 사유] …\"로 기록"],
  ["order","number","","정렬 순서","같은 탭 안의 순서"],
  ["createdAt","number","","생성 시각","밀리초 타임스탬프"],
], { rowH:0.38, fs:10.5 });

colTable("5-3. cats (문서 탭)", [
  ["id","string","PK","탭 key","resume 이력서 · career 기술경력서 · portfolio 포트폴리오 · prep 취업. \"cfg\"는 설정용(건드리지 않음)"],
  ["label","string","","표시 이름","이름 변경 가능"],
  ["icon","number","","아이콘 번호","—"],
  ["order","number","","탭 순서","순서 변경 가능"],
  ["hidden","boolean","","숨김 여부","true이면 탭 바에서 숨김"],
], { rowH:0.7, noteY:5.6, note:"탭은 사용자가 추가·이름 변경·숨김·순서 변경을 할 수 있습니다." });

colTable("5-4. kinds (일정 종류)", [
  ["id","string","PK","종류 key","deadline 서류 마감 · interview 면접 · cert 자격증 · etc 기타. \"cfg\"는 설정용(건드리지 않음)"],
  ["label","string","","표시 이름","—"],
  ["color","string","","달력 표시 색","—"],
  ["order","number","","표시 순서","—"],
], { rowH:0.75, noteY:5.2, note:"새 일정의 kind는 현재 kinds에 있는 key여야 하며, 맞는 종류가 없으면 먼저 kinds에 추가합니다." });

colTable("5-5. plans (오늘 계획·진행) ① 계획 정보", [
  ["id","string","PK","문서 고유 식별자","자동 생성"],
  ["date","string","","계획을 시작한 날 (통계 기준일)","\"YYYY-MM-DD\""],
  ["title","string","","계획 제목","일정에서 온 계획은 일정 제목"],
  ["start","string","","계획 시작 시각","\"HH:MM\" (00:00~23:59)"],
  ["end","string","","계획 종료 시각","\"HH:MM\". 24시를 넘으면 \"25:30\"처럼, 최대 \"48:00\""],
  ["planMin","number","","계획 길이(분)","시간을 고칠 때마다 함께 저장"],
  ["eventId","string","FK","원본 일정","events.id. 일정에서 온 계획이 아니면 \"\""],
  ["todoIds","string[]","FK","연결한 할 일","todos 문서 id 배열. 한 할 일은 한 계획에만 연결"],
  ["tabs","string[]","","연결한 할 일의 문서 탭","탭 key 배열 (통계용)"],
  ["carriedFrom","string","FK","이월 원본 계획","어제 이월분이면 원본 plan id, 아니면 \"\""],
], { rowH:0.46 });

colTable("5-5. plans (오늘 계획·진행) ② 집중·결과 정보", [
  ["focus","object","","집중 기록","계획당 1개. 집중 전에는 null (5-6 참고)"],
  ["status","string","","계획 상태","wait · doing · done · partial (5-7 참고)"],
  ["doneAt","number","","집중 종료 시각","집중 기록을 지우면 제거"],
  ["focusMin","number","","집중 시간(분, 쉰 시간 제외)","집중이 끝난 뒤에만 기록. 집중 중에는 제거"],
  ["restMin","number","","쉰 시간(분)","집중이 끝난 뒤에만 기록. 집중 중에는 제거"],
  ["excluded","boolean","","일정에서 온 계획 제외 표시","true이면 목록·통계에서 빠지고 다시 만들지 않음. 다시 넣으면 제거"],
  ["createdAt","number","","생성 시각","밀리초 타임스탬프"],
  ["updatedAt","number","","수정 시각","밀리초 타임스탬프"],
], { rowH:0.5, noteY:5.9, note:"집중 중(일시정지 아님)인 계획은 동시에 1개만 허용되며, 통계는 시작한 날에만 반영합니다." });

colTable("5-6. plans.focus 객체 구조", [
  ["startedAt","number","","집중 시작 시각","밀리초 타임스탬프"],
  ["endedAt","number | null","","집중 종료 시각","집중 중·일시정지 중이면 null"],
  ["pauses","{from, to}[]","","쉰 구간 목록","밀리초. 지금 쉬는 중이면 마지막 to가 null"],
], { header:["필드","타입","키","설명","값 규칙"], cw:[1.5,1.6,0.6,3.6,4.8], rowH:0.75, noteY:4.6, note:"1분 미만으로 쉰 구간은 기록하지 않고 집중 시간에 포함합니다." });

s = mk("5-7. plans.status 값", "5. 컬렉션 명세");
table(s, ["값","설명","값 규칙"], [
  ["wait","대기 (집중 전)","저장"],
  ["doing","집중 중 (일시정지 포함)","저장"],
  ["done","완료","저장"],
  ["partial","절반 (달성도 0.5)","저장"],
  ["fail","실패 (집중 기록 없이 마지막 날짜가 지남)","저장하지 않음 · 화면에서 계산"],
], [2.0,5.0,5.1], { rowH:0.7 });

// rules
pres.addSection({ title:"6. 규칙" });
s = mk("6. 데이터 규칙 · 제약", "6. 규칙");
table(s, ["구분","규칙"], [
  ["시간대","Asia/Seoul(KST). 날짜는 \"YYYY-MM-DD\", 시간은 \"HH:MM\" 문자열, 시각은 밀리초 타임스탬프"],
  ["미정 값","빈 문자열 \"\" 로 표현 (날짜 미정 일정은 date=\"\" 이고 month만 입력)"],
  ["완료·포기","done과 dropped는 동시에 true가 될 수 없다. 포기한 할 일은 진행률 분모와 \"우선순위 높은데 미완료\" 강조에서 제외"],
  ["계획 시간","plans는 최대 48:00까지 허용. 시간이 겹치는지는 저장하지 않고 화면에서 계산(일정 원본 포함)"],
  ["연결","한 할 일은 한 계획에만 연결. 일정에서 온 계획은 자동 생성(60분)되며 excluded:true로 재생성을 막는다"],
  ["보안","비밀번호·API 키·주민등록번호·계좌번호는 note·할 일 등 어떤 필드에도 저장하지 않는다"],
  ["권한","모든 컬렉션은 소유자만 읽기·쓰기 가능"],
], [1.8,10.3], { rowH:0.65 });

(async()=>{
  await pres.writeFile({ fileName:OUT });
  if (applyTheme) await applyTheme(OUT, THEME); else console.warn("apply_theme.js를 찾지 못해 테마 색 적용을 건너뜁니다.");
  console.log("ok", OUT);
})();
