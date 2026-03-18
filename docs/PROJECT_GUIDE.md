# 00Hub — 종합 프로젝트 기술 가이드

평행 님과 함께 만든 00Hub의 모든 파일과 폴더를 빠짐없이 정리한 완전 가이드입니다.

---

## 📂 루트 폴더 파일들

> 프로젝트 최상위 폴더(`00_Hub/`)에 있는 파일들입니다.

| 파일 | 역할 |
| --- | --- |
| **[00Hub.exe](file:///c:/Users/MY_NOTE/Desktop/2026%20WORKROOM/PRL%20Workspace/00_Hub/00Hub.exe)** | **메인 실행기.** C# WebView2 기반의 통합 런처로, 서버 관리와 창 제어를 동시에 수행합니다. |
| [Microsoft.Web.WebView2.Core.dll](./Microsoft.Web.WebView2.Core.dll) | WebView2 엔진 핵심 라이브러리 |
| [Microsoft.Web.WebView2.WinForms.dll](./Microsoft.Web.WebView2.WinForms.dll) | WebView2 윈도우 폼 컨트롤 라이브러리 |
| [WebView2Loader.dll](./WebView2Loader.dll) | WebView2 로더 모듈 |
| [run_hub.bat](file:///c:/Users/MY_NOTE/Desktop/2026%20WORKROOM/PRL%20Workspace/00_Hub/run_hub.bat) | 런처 대신 배치 파일로 실행하고 싶을 때 사용 (구버전) |
| [stop_hub.bat](file:///c:/Users/MY_NOTE/Desktop/2026%20WORKROOM/PRL%20Workspace/00_Hub/stop_hub.bat) | 종료기. 백그라운드 서버와 런처 관련 프로세스를 완전히 종료합니다. |
| [index.html](file:///c:/Users/MY_NOTE/Desktop/2026%20WORKROOM/PRL%20Workspace/00_Hub/index.html) | 웹 앱의 뼈대가 되는 HTML 파일. |
| [vite.config.js](file:///c:/Users/MY_NOTE/Desktop/2026%20WORKROOM/PRL%20Workspace/00_Hub/vite.config.js) | 빌드 엔진(Vite)의 설정 파일. |
| [eslint.config.js](file:///c:/Users/MY_NOTE/Desktop/2026%20WORKROOM/PRL%20Workspace/00_Hub/eslint.config.js) | 코드 품질 검사기 설정. |
| [package.json](file:///c:/Users/MY_NOTE/Desktop/2026%20WORKROOM/PRL%20Workspace/00_Hub/package.json) | 프로젝트의 '이력서'. |
| package-lock.json | 외부 도구 잠금 파일. |
| [README.md](file:///c:/Users/MY_NOTE/Desktop/2026%20WORKROOM/PRL%20Workspace/00_Hub/README.md) | 프로젝트 메인 소개 문서. |
| [ABOUT.md](file:///c:/Users/MY_NOTE/Desktop/2026%20WORKROOM/PRL%20Workspace/00_Hub/ABOUT.md) | 앱 디자인 및 기능 상세 소개. |
| [PROJECT_GUIDE.md](file:///c:/Users/MY_NOTE/Desktop/2026%20WORKROOM/PRL%20Workspace/00_Hub/PROJECT_GUIDE.md) | 현재 보고 계신 이 가이드. |
| [CODE_REFERENCE.md](file:///c:/Users/MY_NOTE/Desktop/2026%20WORKROOM/PRL%20Workspace/00_Hub/CODE_REFERENCE.md) | 코드별 상세 설명 레퍼런스. |
| [ROADMAP.md](file:///c:/Users/MY_NOTE/Desktop/2026%20WORKROOM/PRL%20Workspace/00_Hub/ROADMAP.md) | 향후 개발 계획 및 알려진 이슈. |
| [AI_MAINTENANCE.md](file:///c:/Users/MY_NOTE/Desktop/2026%20WORKROOM/PRL%20Workspace/00_Hub/docs/AI_MAINTENANCE.md) | **AI 에이전트 전용** 유지보수 및 빌드 지침서. |

---

## 📁 폴더별 상세 설명

### 🎨 [src/](file:///c:/Users/MY_NOTE/Desktop/2026%20WORKROOM/PRL%20Workspace/00_Hub/src) — 핵심 소스 코드

가장 중요한 폴더입니다. 허브의 뇌와 디자인이 모두 여기 있습니다.

| 파일 | 역할 |
| --- | --- |
| **[App.jsx](file:///c:/Users/MY_NOTE/Desktop/2026%20WORKROOM/PRL%20Workspace/00_Hub/src/App.jsx)** | **허브의 뇌.** 할 일 추가, 퀘스트 체크, 워크 타이머, 히트맵 계산, 젠 모드, 백색소음 등 모든 로직이 담겨 있습니다. |
| **[App.css](file:///c:/Users/MY_NOTE/Desktop/2026%20WORKROOM/PRL%20Workspace/00_Hub/src/App.css)** | **허브의 세부 디자인.** 카드 배치, 유리 효과(Glassmorphism), 버튼 호버 효과 등이 정의되어 있습니다. |
| **[index.css](file:///c:/Users/MY_NOTE/Desktop/2026%20WORKROOM/PRL%20Workspace/00_Hub/src/index.css)** | **공통 테마.** CMYK 컬러 팔레트 정의, 스크롤바 숨김 처리 등 앱 전체에 적용되는 기본 규칙입니다. |
| **[main.jsx](file:///c:/Users/MY_NOTE/Desktop/2026%20WORKROOM/PRL%20Workspace/00_Hub/src/main.jsx)** | **앱의 시작점.** 리액트를 HTML에 연결하고 PWA 서비스 워커를 등록하는 3줄짜리 핵심 파일입니다. |
| **assets/** | 소스 코드 빌드 시 포함되는 이미지 등 정적 자산 폴더입니다. Vite가 자동으로 관리합니다. |

---

### 🖼 [public/](file:///c:/Users/MY_NOTE/Desktop/2026%20WORKROOM/PRL%20Workspace/00_Hub/public) — 정적 자산

빌드해도 변환되지 않고 그대로 사용되는 파일들입니다.

| 파일 | 역할 |
| --- | --- |
| **icon-512.png** | 허브의 메인 로고 이미지 (512×512px). PWA 설치 아이콘으로 사용됩니다. |
| **vite.svg** | Vite 기본 로고 이미지. 프로젝트 초기 생성 시 자동으로 들어온 파일이며 현재는 사용하지 않습니다. |

---

### 📦 [dist/](file:///c:/Users/MY_NOTE/Desktop/2026%20WORKROOM/PRL%20Workspace/00_Hub/dist) — 최종 빌드 결과물

`npm run build` 명령으로 생성되는 **배포용 완성본 폴더**입니다. 직접 건드릴 일은 없습니다.

| 파일 | 역할 |
| --- | --- |
| **index.html** | 빌드된 앱의 진입점 HTML. |
| **manifest.webmanifest** | PWA 설치 정보(이름, 아이콘, 색상)를 담은 파일. |
| **registerSW.js** | 서비스 워커(오프라인 비서)를 자동 등록하는 스크립트. |
| **sw.js** | 서비스 워커 본체. 앱 파일을 오프라인용으로 캐싱합니다. |
| **workbox-\*.js** | Google의 Workbox 라이브러리 번들. sw.js가 내부적으로 사용합니다. |
| **vite.svg** | public에서 복사된 Vite 기본 로고. |
| **assets/** | 빌드 시 압축된 JS, CSS 파일들이 저장되는 폴더. |

---

### 🔧 [dev-dist/](file:///c:/Users/MY_NOTE/Desktop/2026%20WORKROOM/PRL%20Workspace/00_Hub/dev-dist) — 개발용 임시 빌드

개발 서버(npm run dev) 실행 중 PWA 기능 테스트를 위해 만들어지는 임시 폴더입니다. `dist/`와 역할이 같지만 개발 모드 전용입니다.

| 파일 | 역할 |
| --- | --- |
| **registerSW.js** | 개발 모드용 서비스 워커 등록 스크립트. |
| **sw.js** | 개발 모드용 서비스 워커 본체. |
| **workbox-\*.js** | 개발용 Workbox 라이브러리 (용량이 훨씬 큼). |

---

### 🎯 [launcher_src/](file:///c:/Users/MY_NOTE/Desktop/2026%20WORKROOM/PRL%20Workspace/00_Hub/launcher_src) — 런처 소스 및 도구

`00Hub.exe`를 만들고 유지하는 데 필요한 재료들 모음입니다.

| 파일 | 역할 |
| --- | --- |
| **[Launcher.cs](file:///c:/Users/MY_NOTE/Desktop/2026%20WORKROOM/PRL%20Workspace/00_Hub/launcher_src/Launcher.cs)** | 00Hub.exe의 원본 소스 코드(C#). 서버를 백그라운드에서 실행하고 앱 전용창을 띄우는 로직이 담겨 있습니다. |
| **[MakeIcon.cs](file:///c:/Users/MY_NOTE/Desktop/2026%20WORKROOM/PRL%20Workspace/00_Hub/launcher_src/MakeIcon.cs)** | 아이콘 제작기 소스 코드(C#). PNG를 윈도우용 .ico 파일로 직접 변환합니다. |
| **MakeIcon.exe** | MakeIcon.cs를 컴파일한 실행 파일. 나중에 아이콘을 바꾸고 싶을 때 사용합니다. |
| **00Hub.ico** | MakeIcon.exe가 만들어낸 결과물. 00Hub.exe 안에 이미 내장되어 있습니다. |

---

### 📂 [*.WebView2/](file:///c:/Users/MY_NOTE/Desktop/2026%20WORKROOM/PRL%20Workspace/00_Hub) — 브라우저 데이터 및 캐시

---

### 🏗 [node_modules/](file:///c:/Users/MY_NOTE/Desktop/2026%20WORKROOM/PRL%20Workspace/00_Hub/node_modules) — 외부 라이브러리 창고

`npm install`로 설치된 모든 외부 도구들이 들어있는 폴더입니다. 내부를 직접 수정하지 않으며, `.gitignore`에 의해 GitHub에는 올라가지 않습니다.

---

### 🔒 [.git/](file:///c:/Users/MY_NOTE/Desktop/2026%20WORKROOM/PRL%20Workspace/00_Hub/.git) — Git 버전 관리 데이터

Git이 모든 커밋 기록과 변경 이력을 저장하는 숨겨진 폴더입니다. 절대 직접 건드리지 마세요.

---

## ⚡ 작동 원리 요약

```text
평행 님이 00Hub.exe 실행
  → 백그라운드에서 npm run dev 서버 실행
  → 2초 대기 후 WebView2 창으로 localhost:23500 오픈
  → React 앱(src/)이 브라우저에 렌더링
  → **v1.4.1: 앱이 모든 창 위에 상시 고정(Always on Top)되며, Alt + ` 단축키로 토글 가능**
  → 모든 데이터는 브라우저 LocalStorage에 **초/개수 단위의 원시 데이터**로 정밀 저장
  → 데이터 유실 시 비율 기반의 **지능형 역산(Recovery)**을 통해 수치 복구
```

> **데이터 주의**: 브라우저 캐시를 완전히 삭제하면 데이터가 날아갈 수 있습니다. 가끔 하단 **Export** 버튼으로 백업을 권장합니다.

---

평행 님, 이제 00Hub 안의 파일 하나도 빠짐없이 설명이 되었습니다! 😊

---

Built by Parallel Lee × Antigravity — v1.4.1 (2026.03.18)
