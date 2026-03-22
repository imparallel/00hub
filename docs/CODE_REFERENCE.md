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

### 현재 코드

```jsx
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// PWA Service Worker는 WebView2 환경에서 autoUpdate 시 강제 page reload를
// 발생시켜 환영 화면이 자동 소멸되는 버그가 있어 비활성화합니다.
// registerSW({ immediate: true })

createRoot(document.getElementById('root')).render(
  <App />
)
```

### 변경 이력

| 항목 | 이전 | 현재 | 이유 |
| --- | --- | --- | --- |
| `<StrictMode>` | 적용 | **제거** | dev 환경에서 Effect 이중 실행으로 SplashScreen 애니메이션 중복 발생 |
| `registerSW({ immediate: true })` | 활성 | **비활성화** | PWA autoUpdate가 초기 로드 완료 후 강제 페이지 리로드를 유발하여 환영 화면이 즉시 소멸되는 버그 |

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
├── Clock                     — 실시간 시계 컴포넌트 (useState + setInterval)
├── SplashScreen               — 실행 시 한 번만 등장하는 환영 화면 컴포넌트
├── HeatmapCell (memo)         — 히트맵 셀 렌더링 컴포넌트 (성능 최적화)
├── createWhiteNoise()         — 백색소음 오디오 생성 함수
├── generateId()               — UUID 형식 고유 ID 생성 (`timestamp-random`)
├── formatFocus()              — 초 → HH:MM:SS 포맷
├── formatTime()               — Date → 시:분 포맷 (시계용)
├── formatDate()               — Date → 요일·날짜 포맷 (시계용)
├── migrateTodos()             — 구버전 데이터 자동 마이그레이션
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

### 3-2. `SplashScreen` 컴포넌트 — 첫 환영 화면

앱이 처음 켜졌을 때만 등장하는 환영 화면 컴포넌트입니다. `App.jsx` 상단에 독립적으로 선언됩니다.

### 작동 원리

- **첫 실행 감지**: `performance.getEntriesByType('navigation')[0].type`이 `'navigate'`일 때만 표시. 이는 sessionStorage(WebView2에서 세션 간 유지) 대신 브라우저 표준 API를 사용합니다.
  - `navigate` → 앱 새로 켜짐 → 환영 화면 표시 ✓
  - `reload` → F5 새로고침/HMR 리로드 → 환영 화면 스킵 ✓
- **자동 소멸 방지**: `tabIndex={0}` + 마운트 후 1초 뒤 `divRef.current?.focus()` 호출로 키보드 입력 가능 상태로 전환. 클릭 / 아무 키나 눌러야만 소멸.
- **퇴장 애니메이션**: 소멸 시 `exit` 클래스를 추가해 `translateY(-100%) scale(1.05)`로 상단 슬라이드업 퇴장.
- **HMR/SW 대응**: `hmr: false`와 `registerSW` 비활성화로 강제 리로드를 원천 차단하여 중복 재생 방지.

### CSS 클래스 (App.css)

| 클래스 | 역할 |
| --- | --- |
| `.splash-screen` | 전체 오버레이 (트레이싱 페이퍼 배경, `backdrop-filter: blur`) |
| `.splash-screen.exit` | 퇴장 애니메이션 (`translateY(-100%)`, opacity 0) |
| `.greeting-text` | 환영 문구 (`@keyframes justOnceText`, `forwards`) |
| `.greeting-hint` | "아무 키나 눌러서 시작" 힌트 텍스트 |
| `.greeting-glow` | 배경 광원 효과 |

---

### 3-3. `createWhiteNoise(ctx)` — 백색소음 생성기

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

### 3-4. State (상태 변수) 전체 목록

| 변수명 | 타입 | 초기값 | 역할 |
| --- | --- | --- | --- |
| `todos` | Array | localStorage 또는 `[]` | Action Items 목록 |
| `quests` | Array | localStorage 또는 기본 퀘스트 2개 | Daily Quests 목록 |
| `input` | String | `''` | Action Items 입력창 임시 값 |
| `questInputValue` | String | `''` | Daily Quests 입력창 임시 값 |
| `editingTodoId` | String/null | `null` | 현재 수정 중인 할 일 ID (UUID 문자열) |
| `editingTodoText` | String | `''` | 수정 중인 할 일 임시 텍스트 |
| `editingQuestId` | String/null | `null` | 현재 수정 중인 퀘스트 ID |
| `editingQuestText` | String | `''` | 수정 중인 퀘스트 임시 텍스트 |
| `lastResetDate` | String | localStorage 또는 오늘 | 자정 리셋 기준 날짜 |
| `heatmap` | Object | localStorage 또는 `{}` | 날짜별 성취도 및 **원시 데이터** `{q, a, t, total, s, qq_done, qq_total, qa_main, qa_sub}` |
| `heatmapTooltip` | Object/null | `null` | 마우스 호버 중인 히트맵 셀 정보 |
| `currentTime` | Date | `new Date()` | 실시간 시계용 |
| `focusTimeSeconds` | Number | localStorage 또는 `0` | Focus Timer 누적 초 |
| `isFocusTimerRunning` | Boolean | `false` | 타이머 실행 중 여부 |
| `archivedTodos` | Array | `[]` | 보관된 할 일 및 서브태스크 목록 (hub-archived-todos) |
| `activeActionTab` | String | `'active'` | Action Items 현재 탭 (`active`/`archive`) |
| `expandedTodoIds` | Set | `new Set()` | 보관함 내 서브태스크 펼침 상태 관리 |
| `expandedArchiveDates` | Set | `new Set()` | 보관함 날짜 그룹 펼침 상태 관리 |
| `isArchiveOpen` | Boolean | `false` | (Deprecated) 과거 보관함 열림 방식 (현재 탭으로 대체) |
| `editingArchiveId` | String/null | `null` | 보관함 할 일 수정 대상 ID |
| `editingArchiveText` | String | `''` | 보관함 할 일 수정 임시 텍스트 |
| `editingArchiveSubId` | String/null | `null` | 보관함 서브태스크 수정 대상 ID |
| `editingArchiveSubText` | String | `''` | 보관함 서브태스크 수정 임시 텍스트 |
| `brainDump` | String | localStorage 또는 `''` | Brain Dump 메모 내용 |
| `oneThing` | String | localStorage 또는 `''` | "The One Thing" 입력 내용 |
| `isZenMode` | Boolean | `false` | 젠 모드 ON/OFF (진입 시 런처에 `topmost:true` 전송) |
| `zenFocus` | String | localStorage 또는 `''` | 젠 모드 포커스 텍스트 (현재는 oneThing과 공유) |
| `zenFocusTimeSeconds` | Number | `0` | 젠 모드 전용 타이머 초 |
| `isZenTimerRunning` | Boolean | `false` | 젠 타이머 실행 중 여부 |
| `isNoiseOn` | Boolean | `false` | 백색소음 ON/OFF |
| `lastTickRef` | Ref | `null` | 타이머 정밀 측정을 위한 마지막 타임스탬프 기록 |
| `audioCtxRef` | Ref | `null` | Web Audio API 컨텍스트 (백색소음용) |
| `noiseRef` | Ref | `null` | 현재 재생 중인 노이즈 소스 객체 |
| `wasDwtRunning` | Ref | `false` | 젠 모드 진입 전 타이머 실행 상태 저장용 |
| `zenFrogRef` / `heroRef` | Ref | `null` | "The One Thing" 입력창 자동 높이 조절용 |
| `dummyFocusRef` | Ref | `null` | 최소화 해제 시 WebView2가 텍스트 입력창 포커스를 탈취하는 현상(이중 점프) 방지용 싱크 |
| `toast` | Object | `{visible:false, message:''}` | 커스텀 토스트 알림 상태 |
| `confirmConfig` | Object | `{visible:false, ...}` | 커스텀 확인 모달 설정 및 콜백 |
| `editingSubtaskId` | String/null | `null` | 현재 수정 중인 서브태스크 ID |
| `editingSubtaskText` | String | `''` | 수정 중인 서브태스크 임시 텍스트 |
| `isSplashShowing` | Boolean | `performance.navigation` 기반 | 앱 첫 실행 여부 판별 후 환영 화면 표시 제어 |
| `isPageVisible` | Boolean | `true` | 브라우저/런처 가시성 상태 (Throttling 제어용) |
| `todayString` | String | - | `currentTime.toDateString()` (계산용 기준 날짜) |

---

### 3-5. 항목 데이터 구조 (Item Data Structure)

각 상태 변수(`todos`, `quests`) 내의 객체들은 다음과 같은 속성을 가집니다. `completed`와 `completedAt`은 변수가 아닌 객체의 **속성(Property)**입니다.

| 항목 타입 | 속성명 | 타입 | 설명 |
| --- | --- | --- | --- |
| **Todo** | `id` | String | 고유 식별자 (`timestamp-random`) |
| | `text` | String | 할 일 내용 |
| | `status` | String | `todo` / `doing` / `done` |
| | `completedAt` | String | 완료된 날짜 (`toDateString()`) |
| | `subtasks` | Array | 서브태스크 객체 배열 |
| **Quest** | `id` | String | 고유 식별자 (`timestamp-random`) |
| | `text` | String | 퀘스트 내용 |
| | `completed` | Boolean | 달성 여부 |
| | `completedAt` | String | 달성된 날짜 (`toDateString()`) |
| **Subtask** | `id` | String | 고유 식별자 (`timestamp-random`) |
| | `text` | String | 서브태스크 내용 |
| | `completed` | Boolean | 완료 여부 |
| | `completedAt` | String | 완료된 날짜 (`toDateString()`) |

---

### 3-6. Heatmap 비율 계산 및 원자적 동기화 (v1.5.0 개정)

v1.5.5부터 성능 최적화와 데이터 무결성을 위해 **Atomic Sync(원자적 동기화)** 엔진을 도입했습니다.

1. **실시간 파생 계산 (`useMemo`)**:
   UI(오늘의 진행 바, 정보 바 등)에 사용되는 수치는 `useMemo`를 통해 `quests`, `todos`, `timers` 상태가 변할 때마다 즉시 계산됩니다. 이를 통해 렌더링 딜레이를 최소화합니다.
2. **원자적 상태 동기화 (`useEffect`)**:
   사용자가 퀘스트를 체크하거나 타이머가 1초 경과할 때마다, 개별 수치가 아닌 **'오늘의 히트맵 데이터 객체'** 전체를 `setHeatmap`으로 갱신합니다. 이를 통해 히트맵 데이터가 항상 최신 상태를 유지하며 로컬스토리지와 정밀하게 동기화됩니다.

```jsx
// Heatmap Data Object Structure
{
  s: 14400,        // 초 (Focus + Zen)
  qq_done: 4,      // 퀘스트 완료 수
  qq_total: 5,     // 전체 퀘스트 수
  qa_main: 3,      // 메인 할 일 완료 수
  qa_sub: 2,       // 서브태스크 완료 수
  qa_total: 10,    // 분모용 전체 할 일 (active)
  q: 0.8, a: 0.5, t: 1.0, total: 0.76
}
```

---

---

### 3-7. 데이터 복구 및 역산 로직 (Data Precision & Recovery)

V1.3.x 부터는 단순히 비율(`q, a, t`)만 저장하지 않고, **원시 데이터(초, 개수)**를 함께 저장하여 목표치가 바뀌어도 과거 기록의 정확성을 유지합니다.

| 필드 | 설명 |
| --- | --- |
| `s` | 집중 시간(초) |
| `qq_done` / `qq_total` | 퀘스트 완료 / 전체 개수 |
| `qa_main` / `qa_sub` | 메인 할 일 / 서브태스크 완료 개수 |
| `qa_total` | 분모용 전체 할 일 개수 (active 기준) |

#### 지능형 역산 (Reverse Calculation) 로직

데이터 리셋이나 구버전 데이터로 인해 개수 정보가 유실된 경우, 히트맵의 **비율(Ratio)** 정보를 기반으로 수학적 역산을 수행합니다.

- **원리**: `전체 개수 = 1 / 비율` (가장 합리적인 최소 분모 도출)
- **철벽 방어**: 항목 리스트에 기록이 없더라도 히트맵에 '색의 흔적(비율)'이 있다면 무조건 숫자로 복구하여 정보 바에 표시합니다.

---

### 3-8. useEffect 묶음

#### 자동 저장 (LocalStorage 동기화)

```jsx
useEffect(() => { localStorage.setItem('hub-todos',      JSON.stringify(todos))          }, [todos])
useEffect(() => { localStorage.setItem('hub-quests',     JSON.stringify(quests))         }, [quests])
useEffect(() => { localStorage.setItem('hub-lastResetDate', JSON.stringify(lastResetDate)) }, [lastResetDate])
useEffect(() => { localStorage.setItem('hub-focusTime',  JSON.stringify(focusTimeSeconds)) }, [focusTimeSeconds])
useEffect(() => { localStorage.setItem('hub-braindump',  JSON.stringify(brainDump))      }, [brainDump])
useEffect(() => { localStorage.setItem('hub-oneThing',   JSON.stringify(oneThing))       }, [oneThing])
useEffect(() => { localStorage.setItem('hub-zenFocus',   JSON.stringify(zenFocus))       }, [zenFocus])
```

> 의존성 배열의 값이 바뀔 때마다 자동 저장됩니다. 별도 저장 버튼이 없는 이유입니다.

#### 자정 자동 리셋 및 타이머 분할 (Precision Sync)

```jsx
useEffect(() => {
  if (isFocusTimerRunning || isZenTimerRunning) {
    lastTickRef.current = Date.now();
    const interval = setInterval(() => {
      const nowMs = Date.now();
      const deltaMs = nowMs - lastTickRef.current;
      if (deltaMs >= 1000) {
        // ... 날짜 변경 체크 및 시간 합산 (deltaMs 기반)
        if (lastDate !== nowDate) {
          setFocusTimeSeconds(secToToday); // 오늘 시간 리셋
          setCurrentTime(new Date());      // 전체 앱 날짜 갱신
        }
        lastTickRef.current += Math.floor(deltaMs / 1000) * 1000;
      }
    }, 1000);
    return () => clearInterval(interval);
  }
}, [isFocusTimerRunning, isZenTimerRunning])
```

> **실시간 동의성**: 기존에는 앱이 처음 켜질 때만 리셋을 체크했으나, 이제는 타이머 로직과 통합되어 가동 중 자정을 넘겨도 즉시 리셋이 일어납니다. 특히 v1.4.2부터는 **타임스탬프 기반 보정(Catch-up)** 로직이 적용되어, 최소화나 절전 모드로 인해 자바스크립트가 느려져도 실제 흐른 시간을 정확히 추적하여 자정 전후로 나누어 기록합니다.
  
#### 데이터 무결성 및 자동 보관 (v1.4.1 강화)

```jsx
// 자정 변경 시 즉각적인 보관 처리 및 중복 방지
useEffect(() => {
  const toArchive = todos.filter(t => t.status === 'done' && t.completedAt && t.completedAt !== todayString)
  if (toArchive.length > 0) {
    setArchivedTodos(prev => {
      const existingIds = new Set(prev.map(t => t.id))
      const newToArchive = toArchive.filter(t => !existingIds.has(t.id)) // 중복 ID 필터링
      return [...newToArchive, ...prev]
    })
    setTodos(prev => prev.filter(t => !(t.status === 'done' && t.completedAt && t.completedAt !== todayString)))
  }
}, [todos, todayString])
```

> **철저한 중복 제거**: 앱 초기화 시점과 데이터 보관 시점에 모두 ID 기반 중복 제거 필터를 적용하여, 데이터가 불어나는 현상을 방지합니다.

#### Precision Focus Timer & Sync

v1.4.2의 핵심 업데이트로, 단순 `setInterval(s => s + 1)` 방식을 폐기하고 **타임스탬프 차등 계산 방식**을 도입했습니다.

- **Throttling 방지**: 브라우저(WebView2)가 백그라운드에서 JS 실행을 지연시켜도, 다음 실행 시점에 `현재 - 과거` 시각을 계산하여 밀린 시간을 한꺼번에 더해줍니다.
- **교대 근무 시스템**: 일반 타이머와 젠 모드 타이머가 전환될 때 서로를 정지시키고 기준점을 새로 잡아 중복 기록을 원천 차단합니다.
- **자정 분할 기록**: 타이머 가동 중 자정을 넘기면, 자정 이전 배분은 어제 히트맵에, 이후는 오늘 타이머로 자동 분할합니다.

```jsx
useEffect(() => {
  if (!isZenMode) {
    // 젠 모드 종료 시
    setIsZenTimerRunning(false)
    if (wasDwtRunning.current) {
      setIsFocusTimerRunning(true); // 이전에 돌고 있었다면 복구
      wasDwtRunning.current = false
    }
  } else {
    // 젠 모드 진입 시
    if (isFocusTimerRunning) {
      wasDwtRunning.current = true; // 실행 상태 저장
      setIsFocusTimerRunning(false); // 일반 타이머 일시정지
    }
    setIsZenTimerRunning(true)
  }
}, [isZenMode])
```

> **상시 고정(TopMost)**: v1.4.1부터 런처 수준에서 상시 고정되므로, JS에서 더 이상 `topmost` 메시지를 보내지 않습니다. Zen 모드는 시각적 집중과 백색소음에만 집중합니다.

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

### 3-9. 핸들러 함수 목록

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
| `startEditSubtask(id, text)` | 서브태스크 수정 모드 진입 |
| `saveEditSubtask(todoId, subId)` | 서브태스크 수정 저장 |

#### Action Items (Archive 보관함) 관련

| 함수 | 동작 |
| --- | --- |
| `toggleExpand(id, e)` | 보관함 할 일 아코디언 열기/닫기 토글 |
| `toggleArchiveDate(date)` | 보관함 날짜별 그룹 열기/닫기 토글 |
| `startEditArchive(id, text)` | 보관함 내 할 일 수정 진입 |
| `saveEditArchive(id)` | 보관함 내 할 일 수정 저장 |
| `deleteArchiveTodo(id)` | 보관함 내 할 일 직접 삭제 |
| `startEditArchiveSub(todoId, subId, text)` | 보관함 내 서브태스크 수정 진입 |
| `saveEditArchiveSub(todoId, subId)` | 보관함 내 서브태스크 수정 저장 |
| `deleteArchiveSubtask(todoId, subId)` | 보관함 내 서브태스크 직접 삭제 |

#### 환경/타이머 제어 관련

| 함수 | 동작 |
| --- | --- |
| `toggleFocusTimer()` | 메인 집중 타이머(Focus Timer) 시작/일시정지 토글 |
| `toggleNoise()` | 백색소음 켜기/끄기 토글 |

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
  // todos, archivedTodos, quests, brainDump, heatmap 등을 JSON으로 묶어
  // 날짜 이름의 파일로 자동 다운로드 (보관 데이터 포함)
}

const importData = (e) => {
  // JSON 파일을 읽어서 보관 처리된 항목까지 포함하여 각 state에 복원
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
| `showToast(msg)` | 하단 플로팅 토스트 메시지 표시 (1.5초 후 자동 소멸, Black ✦ 아이콘) |
| `askConfirm(title, msg, onOk)` | 커스텀 글래스모피즘 모달을 띄워 사용자 확인 수신 |

---

## 4. `src/App.css` — 컴포넌트 디자인 시스템

### 주요 섹션 구조 (약 2,100줄)

```text
App.css
├── .app-container          — 전체 레이아웃 래퍼 (최대 1200px, 가운데 정렬)
├── .card-header-group      — 모든 위젯 헤더의 공통 레이아웃 (수직 중앙 정렬 통합)
├── .card-title             — 위젯 제목 (통합 구조 내에서 0 margin)
├── .tab-item               — Action Items 전역 탭 (밑줄 애니메이션 포함)
├── .quest-progress         — Daily Quests 진행도 (마젠타/블랙 배색)
├── .timer-status-dot       — Focus Timer 작동 인디케이터 (Cyan 블러 효과)
├── .header                 — 상단 헤더 (로고 + 시계)
```

```css
/* V1.4.0 통합 헤더 구조 */
.card-header-group {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.2rem;
  width: 100%;
}

.card-title {
  font-size: clamp(1.2rem, 3.5vw, 1.6rem);
  font-weight: 800;
  margin-bottom: 0;
}
```

> **디테일의 미학**: 위젯의 제목(`card-title`)과 오른쪽의 보조 기능(탭, 진행도, 타이머 도트)들이 항상 수직 중앙에 놓이도록 `align-items: center`를 적용했습니다.

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
export default defineConfig({
  // ...
  base: './', // 상대 경로 기반으로 정적 파일 로드 (로컬 WebView 앱의 핵심 설정)

  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      // ...manifest 설정...
      workbox: { runtimeCaching: [] }, // 캐싱 제어를 완전히 초기화하여 무결성 유지
      devOptions: { enabled: true, type: 'module' }  // 개발 중에도 PWA 기능 테스트 가능
    })
  ],

  server: {
    port: 23500,       // 개발 서버 포트 (00Hub.exe가 이 포트로 접속)
    strictPort: true,  // 포트 사용 중이면 에러 발생
    hmr: false         // ← WebView2 초기 페이지 로드 시 HMR Full-Reload 차단 (환영 화면 소멸 방지)
  }
})
```

> **⚠️ `hmr: false` 이유**: Vite 개발 서버는 번들링이 완료되면 접속한 클라이언트에게 HMR 신호를 보내 페이지를 강제 리로드합니다. 이 리로드가 환영 화면이 떠있는 사이에 발생하면 즉시 대시보드로 전환되어 버립니다. WebView2 기반 데스크탑 앱은 HMR 기능이 필요 없으므로 비활성화했습니다.

---

## 6. `stop_hub.bat` — 서버 종료기

```bat
:: 포트 23500에서 LISTENING 중인 프로세스 PID를 찾아 강제 종료
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :23500 ^| findstr LISTENING') do (
    taskkill /f /pid %%a
)

:: 혹시 남은 node.exe 프로세스도 모두 강제 종료
taskkill /f /im node.exe /t
```

> `netstat -aon`으로 모든 네트워크 연결을 나열하고, `findstr`로 23500 포트를 필터링해 PID를 뽑아냅니다.

---

## 7. launcher_src/Launcher 런처 코드

### 전체 흐름 (WebView2 통합 버전)

```text
Main() (STAThread)
  ├── SetCurrentProcessExplicitAppUserModelID()  — 작업 표시줄 그룹 ID 설정
  ├── Application.Run(new Launcher())            — 메인 윈도우(Form) 실행
       ├── KillPort(23500)                        — 포트 정리
       ├── StartServer()                         — npm run dev 백그라운드 실행
       └── InitializeWebView()                   — 창 내부에 WebView2(Edge 엔진) 삽입
            └── Source = localhost:23500          — 웹앱 주소 로드
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

// 고정 딜레이(Task.Delay(5000)) 대신 실제 HTTP 200 응답을 확인 후 Navigate
// → Vite 번들 완료 전 접속으로 인한 HMR Full-Reload를 방지합니다.
await WaitForPortAsync(23500, timeoutMs: 30000);
webView.Source = new Uri("http://localhost:23500");
```

> **`WaitForPortAsync` 변경**: 기존 `Task.Delay(5000)` 고정 딜레이에서, 실제로 `http://localhost:23500/`에 HTTP 요청을 보내 **200 OK 응답이 올 때까지** 300ms마다 폴링하는 방식으로 개선했습니다. 이렇게 해야 Vite가 완전히 준비된 후 단 한 번만 Navigate하여 이중 로드가 발생하지 않습니다.

#### 3) 전역 단축키 및 창 제어 (Global HotKey)

v1.4.1에 추가된 핵심 제어 로직입니다. 창이 가려져 있더라도 시스템 전역에서 단축키를 감지합니다.

- **`RegisterHotKey`**: `Alt + \`` (VK_OEM_3) 조합을 시스템에 등록합니다.
- **`WndProc` 오버라이드**: 단축키 메시지(`WM_HOTKEY`)를 수신하면 창의 표시 상태를 토글합니다.
- **`ToggleWindow`**:
  - 창이 보일 때: 트레이로 숨김 (`Hide`)
  - 창이 숨겨져 있을 때: 창을 맨 앞으로 불러오며 `TopMost = true` 재강조

#### 5) 프로세스 종료 및 시스템 종료 대응

창을 닫으면 백그라운드에서 돌아가는 `npm run dev` 서버도 함께 종료되도록 `taskkill /f /t` 옵션을 사용합니다. `/t`는 자식 프로세스 트리 전체를 찾아 죽입니다.

- **v1.6.2 업데이트**: 시스템 종료(`CloseReason.WindowsShutDown`) 시에는 운영체제가 프로세스를 직접 정리하므로, 런처가 중복해서 `taskkill`을 실행하지 않도록 예외 처리를 추가하여 'taskkill.exe 오류'를 방지했습니다.

#### 4) 정적 라이브러리 의존성

실행을 위해 `00Hub.exe`와 같은 폴더에 다음 DLL들이 반드시 함께 있어야 합니다:

- `Microsoft.Web.WebView2.Core.dll`
- `Microsoft.Web.WebView2.WinForms.dll`
- `WebView2Loader.dll`

---

## 6. 트러블슈팅: v1.5.0 후속 UX 엣지 케이스 (드래그 앤 드롭 심화 충돌)

### Issue 1: 최소화(\`visibility:hidden\`) 후 복귀 시 'The One Thing' 텍스트 창 강제 포커스 현상

**원인**: WebView2 브라우저 엔진 특성 상, 창이 다시 보일 때 가장 최상단의 텍스트 포커서블(\`focusable\`) 요소에 강제로 \`focus\`를 주입하는 경향이 있습니다. 이 때 드래그 앤 드롭(\`react-beautiful-dnd\`) 엔진이 마우스를 눌러 드래그를 시작하면, 브라우저는 포커스를 해제하지 않고 상태를 캐싱해버립니다.
**해결법(정공법 우회)**: \`App.jsx\` 최상단에 화면 밖(\`top: -1000px\`)으로 보이지 않는 투명한 더미 싱크 요소(Dummy Focus Sink)를 심고, \`visibility:visible\` 핸들러가 트리거된 직후 \`setTimeout(..., 50)\`을 부여해 해당 로직이 \`focus()\`를 탈취하게 합니다. WebView2가 창 활성화 포커스를 복구하는 미세한 타임 갭을 노린 해결책입니다.

### Issue 2: 드래그 후 항목을 놓을 때, 애니메이션이 '어디선가 휙 날아오는' 이중 점프 현상

**원인**: \`react-beautiful-dnd\`의 핵심 착지(Drop) 모션은 라이브러리가 내부적으로 DOM에 인라인 \`transform\`과 \`transition\`을 동적으로 계산하여 할당하는 방식으로 구현됩니다.
만약 \`Draggable\` 래퍼(\`.archive-item\` 등) CSS 자체 구조에 \`transition: all 0.2sease\` 같은 속성이 부여되어 있으면, React가 요소 렌더링을 끝마치고 DOM 레이아웃이 확정되는 찰나(Snap) 브라우저 엔진이 이 CSS를 우선하여 레이아웃 역산 애니메이션을 단독으로 재생합니다. 결과적으로 라이브러리 애니메이션과 CSS 오리가 겹쳐 2번 날아오거나 이상한 궤도를 그립니다.
**해결법**:

```jsx
style={{ 
  ...provided.draggableProps.style,
  transition: provided.draggableProps.style?.transition || 'background 0.2s, box-shadow 0.2s, border-color 0.2s'
}}
```

항상 위 형태처럼 \`provided.draggableProps.style.transition\`를 \`Draggable\` 컴포넌트의 가장 마지막 줄(최고 우선순위) 인라인 스타일에 고정 Overriding 해야만 착지 애니메이션이 훼손되지 않습니다.

---

이 문서는 00Hub v1.6.2 기준으로 작성 및 갱신되었습니다 — 2026.03.22
