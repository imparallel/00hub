# CODE_REFERENCE — 00Hub 코드별 상세 설명

> 이 문서는 각 파일의 코드가 어떻게 작동하는지 유지보수 관점에서 상세하게 설명합니다.

---

## 📋 목차

1. [src/main.jsx](#1-srcmainjsx--앱의-시작점)
2. [src/index.css](#2-srcindexcss--전역-테마-시스템)
3. [src/App.jsx](#3-srcappjsx--허브의-뇌-핵심-로직)
4. [src/App.css](#4-srcappcss--컴포넌트-디자인-시스템)
5. [vite.config.js](#5-viteconfigjs--빌드-및-pwa-설정)
6. [stop_hub.bat](#6-stop_hubbat--서버-종료기)
7. [launcher_src/Launcher.cs](#7-launcher_srclauncher-런처-코드)

---

## 1. `src/main.jsx` — 앱의 시작점

### 전체 코드 (15줄)

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { registerSW } from 'virtual:pwa-register'

registerSW({ immediate: true })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

### 설명

| 코드 | 역할 |
| --- | --- |
| `createRoot(...)` | HTML의 `<div id="root">`를 찾아서 리액트 앱을 그 안에 심습니다 |
| `<StrictMode>` | 개발 중에 잠재적인 문제를 더 일찍 발견하도록 도와주는 감시 모드입니다 |
| `registerSW({ immediate: true })` | Vite PWA 플러그인이 제공하는 함수. 앱이 켜지자마자 서비스 워커(오프라인 비서)를 등록합니다 |

---

## 2. `src/index.css` — 전역 테마 시스템

### CSS 변수 `:root` 블록

앱 전체에서 공유하는 색상, 반경, 그림자 값들을 **단 한 곳**에서 정의합니다.
색상을 바꾸고 싶다면 여기서만 수정하면 전체에 반영됩니다.

```css
:root {
  /* 배경 */
  --color-bg-main: #f4f5f7;        /* 앱 전체 배경색 */
  --color-bg-card: rgba(255,255,255,0.85);  /* 카드 기본 배경 */

  /* 텍스트 계층 */
  --color-text-primary: #0a0a0a;    /* 메인 텍스트 */
  --color-text-secondary: #5a5a5a;  /* 보조 텍스트 */
  --color-text-tertiary: #9ca3af;   /* 비활성 텍스트 */

  /* CMYK 핵심 4색 */
  --cmyk-yellow:  #feda00;   /* Action Items, 에너지 */
  --cmyk-magenta: #ff0066;   /* Daily Quests, 습관 */
  --cmyk-cyan:    #00b0ff;   /* Focus Timer, 집중 */
  --cmyk-black:   #121212;   /* 타이포그래피, 강조 */

  /* 그림자 단계 (sm → md → lg로 깊이감 증가) */
  --shadow-sm / --shadow-md / --shadow-lg

  /* 유리 효과 용 변수 */
  --glass-bg: rgba(255,255,255,0.65);
  --glass-border: rgba(255,255,255,0.8);
}
```

### 스크롤바 숨기기 (전체 적용)

```css
*::-webkit-scrollbar { display: none; }       /* Chrome, Safari */
* { -ms-overflow-style: none; scrollbar-width: none; }  /* IE, Firefox */
```

> 스크롤은 작동하지만 시각적으로 보이지 않습니다. 깔끔한 앱 느낌을 위한 핵심 처리입니다.

### `body` 앰비언트 배경

```css
body {
  background-image:
    radial-gradient(circle at 15% 50%, rgba(254,218,0,0.08) ...),   /* 노랑 (Yellow) */
    radial-gradient(circle at 50% 80%, rgba(255,0,102,0.06)  ...),  /* 마젠타 (Magenta) */
    radial-gradient(circle at 85% 30%, rgba(0,176,255,0.08)  ...);  /* 시안 (Cyan) */
}
```

> 세 가지 CMYK 색상이 화면 구석구석에서 아주 희미하게 퍼져 생동감을 줍니다. 비율을 바꾸면 분위기가 달라집니다.

---

## 3. `src/App.jsx` — 허브의 뇌 (핵심 로직)

### 3-1. 전체 구성 개요

```text
App.jsx
├── createWhiteNoise()         — 파일 최상단, 컴포넌트 밖에 있는 오디오 생성 함수
└── function App()             — 메인 컴포넌트
    ├── State 선언부 (useState)
    ├── 파생 계산 (Heatmap 비율)
    ├── useEffect 묶음 (타이머, 리셋, 저장 등)
    ├── 텍스트 영역 자동 높이 조절 (adjustHeight & ResizeObserver)
    ├── 핸들러 함수들
    ├── ZEN MODE 렌더 (조건부 early return)
    └── MAIN DASHBOARD 렌더
```

---

### 3-2. `createWhiteNoise(ctx)` — 백색소음 생성기

```jsx
function createWhiteNoise(ctx) {
  const bufferSize = 2 * ctx.sampleRate      // 2초 분량의 오디오 버퍼
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const output = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1  // -1~1 난수

  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.loop = true                         // 무한 반복

  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 800               // 800Hz 이상 고음 차단 → 빗소리 느낌

  const gainNode = ctx.createGain()
  gainNode.gain.value = 0.12                 // 볼륨 (0~1, 12%로 조용하게)

  source.connect(filter)
  filter.connect(gainNode)
  gainNode.connect(ctx.destination)
  return { source, gainNode }
}
```

> **Web Audio API**를 이용해 소리 파일 없이 **수학적으로** 소음을 생성합니다.
> 랜덤 난수 → 저역 필터 → 볼륨 조절의 3-단계 파이프라인입니다.

---

### 3-3. State (상태 변수) 전체 목록

| 변수명 | 타입 | 초기값 | 역할 |
| --- | --- | --- | --- |
| `todos` | Array | localStorage 또는 `[]` | Action Items 목록 |
| `quests` | Array | localStorage 또는 기본 퀘스트 2개 | Daily Quests 목록 |
| `input` | String | `''` | Action Items 입력창 임시 값 |
| `questInputValue` | String | `''` | Daily Quests 입력창 임시 값 |
| `editingTodoId` | Number/null | `null` | 현재 수정 중인 할 일 ID |
| `editingTodoText` | String | `''` | 수정 중인 할 일 임시 텍스트 |
| `editingQuestId` | Number/null | `null` | 현재 수정 중인 퀘스트 ID |
| `editingQuestText` | String | `''` | 수정 중인 퀘스트 임시 텍스트 |
| `lastResetDate` | String | localStorage 또는 오늘 | 자정 리셋 기준 날짜 |
| `heatmap` | Object | localStorage 또는 `{}` | 날짜별 성취도 및 **원시 데이터** `{q, a, t, total, s, qq_done, qq_total, qa_main, qa_sub}` |
| `heatmapTooltip` | Object/null | `null` | 마우스 호버 중인 히트맵 셀 정보 |
| `currentTime` | Date | `new Date()` | 실시간 시계용 |
| `focusTimeSeconds` | Number | localStorage 또는 `0` | Work Timer 누적 초 |
| `isFocusTimerRunning` | Boolean | `false` | 타이머 실행 중 여부 |
| `brainDump` | String | localStorage 또는 `''` | Brain Dump 메모 내용 |
| `oneThing` | String | localStorage 또는 `''` | "The One Thing" 입력 내용 |
| `isZenMode` | Boolean | `false` | 젠 모드 ON/OFF (진입 시 런처에 `topmost:true` 전송) |
| `zenFocus` | String | localStorage 또는 `''` | 젠 모드 포커스 텍스트 (현재는 oneThing과 공유) |
| `zenFocusTimeSeconds` | Number | `0` | 젠 모드 전용 타이머 초 |
| `isZenTimerRunning` | Boolean | `false` | 젠 타이머 실행 중 여부 |
| `isNoiseOn` | Boolean | `false` | 백색소음 ON/OFF |
| `toast` | Object | `{visible:false, message:''}` | 커스텀 토스트 알림 상태 |
| `confirmConfig` | Object | `{visible:false, ...}` | 커스텀 확인 모달 설정 및 콜백 |
| `editingSubtaskId` | Number/null | `null` | 현재 수정 중인 서브태스크 ID |
| `todayString` | String | - | `new Date().toDateString()` (계산용 기준 날짜) |

---

### 3-4. 항목 데이터 구조 (Item Data Structure)

각 상태 변수(`todos`, `quests`) 내의 객체들은 다음과 같은 속성을 가집니다. `completed`와 `completedAt`은 변수가 아닌 객체의 **속성(Property)**입니다.

| 항목 타입 | 속성명 | 타입 | 설명 |
| --- | --- | --- | --- |
| **Todo** | `id` | Number | 고유 식별자 |
| | `text` | String | 할 일 내용 |
| | `status` | String | `todo` / `doing` / `done` |
| | `completedAt` | String | 완료된 날짜 (`toDateString()`) |
| | `subtasks` | Array | 서브태스크 객체 배열 |
| **Quest** | `id` | Number | 고유 식별자 |
| | `text` | String | 퀘스트 내용 |
| | `completed` | Boolean | 달성 여부 |
| | `completedAt` | String | 달성된 날짜 (`toDateString()`) |
| **Subtask** | `id` | Number | 고유 식별자 |
| | `text` | String | 서브태스크 내용 |
| | `completed` | Boolean | 완료 여부 |
| | `completedAt` | String | 완료된 날짜 (`toDateString()`) |

---

### 3-5. Heatmap 비율 계산 (파생 계산)

```jsx
// 1. Action Items 점수 (Yellow)
//    오늘 완료된(completedAt === todayString) 항목만 점수에 반영
let totalActionScore = 0
todos.forEach(t => {
  if (t.status === 'done' && t.completedAt === todayString) totalActionScore += 1
  else if (t.status === 'doing' && t.subtasks?.length > 0) {
    const subCompletedToday = t.subtasks.filter(s => s.completed && s.completedAt === todayString).length
    totalActionScore += (subCompletedToday / t.subtasks.length) * 0.8
  }
})
const todosRatio = todos.length > 0 ? totalActionScore / todos.length : 0

// 2. Quests 달성률 (Magenta)
//    오늘 수행 완료한 퀘스트만 카운트
const completedQuestsToday = quests.filter(q => q.completed && q.completedAt === todayString).length
const questsRatio = quests.length > 0 ? completedQuestsToday / quests.length : 0

// 3. Focus 달성률 (Cyan) — 목표: 4시간(14400초)
const targetFocusSeconds = 14400
const focusRatio = Math.min((focusTimeSeconds + zenFocusTimeSeconds) / targetFocusSeconds, 1)

// 종합 평균
const todayRatio = (questsRatio + todosRatio + focusRatio) / 3
```

> 이 값들은 렌더 도중 **매 렌더마다 재계산**됩니다 (useState가 아님).
> `todayRatio`는 오늘 히트맵 셀 색상과 info bar에 사용됩니다.

---

### 3-6. 데이터 복구 및 역산 로직 (Data Precision & Recovery)

V1.3.x 부터는 단순히 비율(`q, a, t`)만 저장하지 않고, **원시 데이터(초, 개수)**를 함께 저장하여 목표치가 바뀌어도 과거 기록의 정확성을 유지합니다.

| 필드 | 설명 |
| --- | --- |
| `s` | 집중 시간(초) |
| `qq_done` / `qq_total` | 퀘스트 완료 / 전체 개수 |
| `qa_main` / `qa_sub` | 메인 할 일 / 서브태스크 완료 개수 |

#### 지능형 역산 (Reverse Calculation) 로직

데이터 리셋이나 구버전 데이터로 인해 개수 정보가 유실된 경우, 히트맵의 **비율(Ratio)** 정보를 기반으로 수학적 역산을 수행합니다.

- **원리**: `전체 개수 = 1 / 비율` (가장 합리적인 최소 분모 도출)
- **철벽 방어**: 항목 리스트에 기록이 없더라도 히트맵에 '색의 흔적(비율)'이 있다면 무조건 숫자로 복구하여 정보 바에 표시합니다.

---

### 3-7. useEffect 묶음

#### 자동 저장 (LocalStorage 동기화)

```jsx
useEffect(() => { localStorage.setItem('hub-todos',      JSON.stringify(todos))          }, [todos])
useEffect(() => { localStorage.setItem('hub-quests',     JSON.stringify(quests))         }, [quests])
useEffect(() => { localStorage.setItem('hub-focusTime',  JSON.stringify(focusTimeSeconds)) }, [focusTimeSeconds])
useEffect(() => { localStorage.setItem('hub-braindump',  JSON.stringify(brainDump))      }, [brainDump])
useEffect(() => { localStorage.setItem('hub-oneThing',   JSON.stringify(oneThing))       }, [oneThing])
```

> 의존성 배열의 값이 바뀔 때마다 자동 저장됩니다. 별도 저장 버튼이 없는 이유입니다.

#### 자정 자동 리셋 (실시간 감지)

```jsx
useEffect(() => {
  const today = currentTime.toDateString()
  if (today !== lastResetDate) {        // 날짜가 바뀌었다면 (실시간 감지)
    setQuests(q => q.map(quest => ({ ...quest, completed: false })))  // 퀘스트 초기화
    setFocusTimeSeconds(0)              // 타이머 초기화 (0초부터 다시 시작)
    setZenFocusTimeSeconds(0)
    setLastResetDate(today)
  }
}, [currentTime, lastResetDate])  // currentTime이 바뀔 때마다 체크
```

> **실시간 동의성**: 기존에는 앱이 처음 켜질 때만 리셋을 체크했으나, 이제는 `currentTime` 상태와 연동되어 앱을 켜둔 채 자정을 넘겨도 즉시 리셋이 일어납니다. 타이머가 작동 중이라면 0초부터 끊기지 않고 다시 시작됩니다.

#### Zen Mode & 런처 통신

```jsx
useEffect(() => {
  if (!isZenMode) {
    // 젠 탈출: 런처에 상단 고정 해제 요청 + 백색소음 정지
    window.chrome?.webview?.postMessage("topmost:false")
    if (zenFocusTimeSeconds > 0) {
      setFocusTimeSeconds(s => s + zenFocusTimeSeconds)
      setZenFocusTimeSeconds(0)
    }
  } else {
    // 젠 진입: 런처에 상단 고정 요청 + 백색소음 시작
    window.chrome?.webview?.postMessage("topmost:true")
    setIsZenTimerRunning(true)
  }
}, [isZenMode])
```

> **상단 고정(TopMost)**: 평소에는 Alt+Tab 멀티태스킹이 가능하도록 자유를 주다가, 젠 모드에서만 런처에 메시지를 보내 최상단에 고정시킵니다.

#### 텍스트 영역 자동 높이 조절 (Precision Resize)

```jsx
const adjustHeight = useCallback(() => {
  requestAnimationFrame(() => {
    if (zenFrogRef.current) {
      zenFrogRef.current.style.height = 'auto'
      zenFrogRef.current.style.height = `${zenFrogRef.current.scrollHeight}px`
    }
    // ... heroRef도 동일 처리
  })
}, [])
```

> **The One Thing** 입력창이 내용에 따라 자동으로 늘어납니다. `ResizeObserver`를 연동하여 창 크기가 변할 때도 즉시 대응하며, `requestAnimationFrame`을 써서 시각적 깜빡임을 최소화했습니다.

---

### 3-7. 핸들러 함수 목록

#### Action Items 관련

| 함수 | 동작 |
| --- | --- |
| `addTodo(e)` | 입력창 값을 todos 배열 **맨 앞**에 추가 |
| `cycleStatus(id)` | `todo → doing → done → todo` 순환 |
| `deleteTodo(id)` | 해당 ID 항목 제거 |
| `addSubtask(todoId, text)` | DOING 상태 항목에 서브태스크 추가 |
| `toggleSubtask(todoId, subId)` | 서브태스크 완료/미완료 토글 |
| `deleteSubtask(todoId, subId)` | 서브태스크 삭제 |
| `startEditTodo(id, text)` | 수정 모드 진입 (editingTodoId 설정) |
| `saveEditTodo(id)` | 수정된 텍스트 저장 및 수정 모드 해제 |

#### Daily Quests 관련

| 함수 | 동작 |
| --- | --- |
| `addQuest(e)` | 입력창 값을 quests 배열 **맨 앞**에 추가 |
| `toggleQuest(id)` | 완료/미완료 토글 |
| `deleteQuest(id)` | 해당 ID 퀘스트 제거 |
| `startEditQuest(id, text)` | 퀘스트 수정 모드 진입 |
| `saveEditQuest(id)` | 퀘스트 수정 저장 |

#### 데이터 백업

```jsx
const exportData = () => {
  // todos, quests, brainDump, heatmap 등을 JSON으로 묶어
  // 날짜 이름의 파일로 자동 다운로드
}

const importData = (e) => {
  // JSON 파일을 읽어서 각 state에 복원
  // window.confirm()으로 덮어쓰기 확인
}
```

#### Drag & Drop

```jsx
const onDragEnd = (result) => {
  if (!result.destination) return   // 목록 밖으로 드롭하면 무시
  const { type } = result           // 'todos', 'quests', or 'subtasks-[id]'
  // 1. todos/quests: 배열 재정렬
  // 2. subtasks-[id]: 해당 부모 todo 내의 subtasks 배열만 필터링하여 재정렬
}
```

#### 알림 시스템 (V1.1 추가)

| 함수 | 동작 |
| --- | --- |
| `showToast(msg)` | 하단 플로팅 토스트 메시지 표시 (3초 후 자동 소멸) |
| `askConfirm(title, msg, onOk)` | 커스텀 글래스모피즘 모달을 띄워 사용자 확인 수신 |

---

## 4. `src/App.css` — 컴포넌트 디자인 시스템

### 주요 섹션 구조 (약 1,550줄)

```text
App.css
├── .app-container          — 전체 레이아웃 래퍼 (최대 1200px, 가운데 정렬)
├── .header                 — 상단 헤더 (로고 + 시계)
├── .live-clock             — 시계 카드 (Glassmorphism)
├── .card                   — 모든 카드의 공통 기반 (::before 가상 요소로 유리 효과)
├── Heatmap 관련            — .heatmap-grid, .heatmap-cell, .layer-y/m/c
├── .one-thing-hero         — 최상단 대형 타이포그래피 입력창
├── .dashboard-grid         — 메인 2단 레이아웃 (Action Items + Sidebar)
├── Action Items 관련       — .todo-item, .status-badge, .subtasks-container
├── Daily Quests 관련       — .quest-list, .quest-item, .quest-icon
├── Timer 관련              — .timer-display, .btn-timer
├── Brain Dump 관련         — .brain-dump-input
├── Footer 관련             — .footer, .btn-footer-minimal
└── Zen Mode 관련           — .zen-mode, .zen-clock, .zen-content
```

### 핵심: Glassmorphism 카드 효과

```css
.card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(255,255,255,0.15);   /* 반투명 흰색 */
  backdrop-filter: blur(25px);          /* 뒤 배경 흐리기 */
  border: 1px solid rgba(255,255,255,0.3);  /* 반투명 테두리 */
  box-shadow: 0 8px 32px rgba(0,0,0,0.05);
  z-index: -1;
}
```

> `::before` 가상 요소를 카드 뒤에 깔아서 유리 효과를 만듭니다.
> 실제 카드 내용과 분리되어 있어 성능과 레이아웃에 영향을 최소화합니다.

### Heatmap 칵테일 레이어

```css
/* 칵테일 정렬 로직: 더 많이 달성한 색상을 뒤로 배치 (Y -> M -> C 순) */
.layer-y { z-index: var(--z-a); --wave-h: var(--h-a); } /* Yellow: 8px Wave (Back) */
.layer-m { z-index: var(--z-q); --wave-h: var(--h-q); } /* Magenta: 6px Wave (Mid) */
.layer-c { z-index: var(--z-t); --wave-h: var(--h-t); } /* Cyan: 4px Wave (Front) */
```

> **브랜드 컬러 우선순위**: 모든 수치가 동일할 경우 **Yellow (뒤) > Magenta (중간) > Cyan (앞)** 순으로 정렬됩니다. 수치가 다를 경우 달성률이 높은 색상이 뒤로 가며 높이도 자동으로 계단식(8/6/4px) 배분됩니다.
> **실선 방지**: 각 레이어 파동 하단에 `margin-bottom: -1.2px` 오버랩을 적용하여 브라우저 렌더링 오차로 인한 틈새 비침을 해결했습니다.

---

## 5. `vite.config.js` — 빌드 및 PWA 설정

```js
VitePWA({
  registerType: 'autoUpdate',           // 새 버전이 있으면 자동 업데이트
  manifest: {
    name: '00Hub',
    short_name: '00Hub',
    theme_color: '#f4f5f7',             // 앱 설치 시 상단바 색상
    display: 'standalone',             // 주소창 없이 독립 앱으로 표시
    start_url: '/',
    icons: [{ src: 'icon-512.png', ... , purpose: 'any maskable' }]
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']  // 캐싱할 파일 패턴
  },
  devOptions: { enabled: true }         // 개발 중에도 PWA 기능 테스트 가능
})
```

```js
server: {
  port: 5173,         // 개발 서버 포트 (00Hub.exe가 이 포트로 접속)
  strictPort: true    // 포트 사용 중이면 에러 발생 (자동으로 다른 포트 잡지 않음)
}
```

---

## 6. `stop_hub.bat` — 서버 종료기

```bat
:: 포트 5173에서 LISTENING 중인 프로세스 PID를 찾아 강제 종료
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do (
    taskkill /f /pid %%a
)

:: 혹시 남은 node.exe 프로세스도 모두 강제 종료
taskkill /f /im node.exe /t
```

> `netstat -aon`으로 모든 네트워크 연결을 나열하고, `findstr`로 5173 포트를 필터링해 PID를 뽑아냅니다.

---

## 7. launcher_src/Launcher 런처 코드

### 전체 흐름 (WebView2 통합 버전)

```text
Main() (STAThread)
  ├── SetCurrentProcessExplicitAppUserModelID()  — 작업 표시줄 그룹 ID 설정
  ├── Application.Run(new Launcher())            — 메인 윈도우(Form) 실행
       ├── KillPort(5173)                        — 포트 정리
       ├── StartServer()                         — npm run dev 백그라운드 실행
       └── InitializeWebView()                   — 창 내부에 WebView2(Edge 엔진) 삽입
            └── Source = localhost:5173          — 웹앱 주소 로드
```

### 중요 코드 분석

#### 1) 작업 표시줄 그룹 설정

이 코드는 여전히 유지되어, `00Hub.exe`라는 하나의 아이콘으로 모든 프로세스를 묶어줍니다.

#### 2) WebView2 브라우저 삽입

기존에는 외부 Chrome을 호출했지만, 이제는 `Microsoft.Web.WebView2.WinForms`를 사용하여 **런처 창 자체가 브라우저**가 됩니다.

```csharp
webView = new WebView2();
webView.Dock = DockStyle.Fill;
this.Controls.Add(webView);
await webView.EnsureCoreWebView2Async(null);
webView.Source = new Uri("http://localhost:5173");
```

#### 3) 자동 종료 (OnFormClosing)

창을 닫으면 백그라운드에서 돌아가는 `npm run dev` 서버도 함께 종료되도록 `taskkill /f /t` 옵션을 사용합니다. `/t`는 자식 프로세스 트리 전체를 찾아 죽입니다.

#### 4) 정적 라이브러리 의존성

실행을 위해 `00Hub.exe`와 같은 폴더에 다음 DLL들이 반드시 함께 있어야 합니다:

- `Microsoft.Web.WebView2.Core.dll`
- `Microsoft.Web.WebView2.WinForms.dll`
- `WebView2Loader.dll`

---

이 문서는 00Hub v1.3.12 기준으로 작성되었습니다 — 2026.03
