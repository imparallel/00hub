# 🤖 AI Maintenance Guide for 00Hub

이 문서는 00Hub 프로젝트를 유지보수하는 AI 어시스턴트(에이전트)를 위한 전용 지침서입니다. 새로운 세션에서 작업을 시작할 때 이 문서를 가장 먼저 읽으십시오.

## 🏗 핵심 빌드 및 실행 지침

### 1. C# 런처 재빌드 (CRITICAL)

`launcher_src/Launcher.cs`를 수정했다면 **반드시** `00Hub.exe`를 다시 빌드해야 변경 사항이 적용됩니다.

* **컴파일러 경로**: `C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe`
* **빌드 명령어**:

    ```powershell
    C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe /target:winexe /out:00Hub.exe /win32icon:launcher_src\00Hub.ico /r:Microsoft.Web.WebView2.WinForms.dll,Microsoft.Web.WebView2.Core.dll,System.Windows.Forms.dll,System.Drawing.dll,System.dll launcher_src\Launcher.cs
    ```

* **주의**: 빌드 전 반드시 실행 중인 `00Hub.exe`를 종료해야 합니다. (`stop_hub.bat` 사용 권장)

### 2. 프론트엔드 개발

* 런처 실행 시 백그라운드에서 `npm run dev`가 자동으로 실행됩니다.
* 프론트엔드 포트는 `23500`으로 고정되어 있습니다. (`vite.config.js` 수정 금지)

---

## 🎨 프로젝트 철학 및 문법

### 1. CMYK 테마 및 시각화

* **Yellow**: Action Items (할 일)
* **Magenta**: Daily Quests (습관)
* **Cyan**: Focus Timer (집중 시간)
* **Black**: Typography & UI Structure
* **Liquid Fill**: 히트맵은 달성률에 따라 칵테일처럼 층이 쌓이는 액체 애니메이션을 사용합니다. (App.css 참조)

### 2. 데이터 관리

* **모든 데이터는 LocalStorage에 저장됩니다.**
* **Precision Storage**: 단순히 비율만 저장하지 않고, `s`(초), `qq_done`(개수) 등의 원시 데이터를 함께 저장하여 목표치가 변해도 과거 데이터를 정확히 계산합니다.
* **Recovery Logic**: 데이터 구조가 깨지거나 누락된 경우 비율로부터 역산하는 로직이 `App.jsx`에 구현되어 있습니다.

---

## ⚠️ 에이전트 주의 사항

* **절대 경로 사용**: 파일을 읽거나 쓸 때 항상 절대 경로(`c:\Users\...`)를 사용하십시오.
* **중복 방지**: 데이터 보관(Archive) 로직이나 리스트 추가 시 ID 기반 중복 체크를 반드시 수행하십시오.
* **상시 고정(TopMost)**: 평행 님의 요청으로 앱은 상시 최상단에 고정되어야 합니다. Alt+Tab으로 가려지지 않게 Launcher와 App.jsx의 연동을 유지하십시오.
* **단축키**: `Alt + \`` (Backtick)은 앱의 전역 토글 단축키입니다. (Zen 모드 시 Launcher에서 가드 처리됨)
* **메시지 통신**: `zen:on`, `zen:off` 메시지를 통해 런처에 Zen 모드 상태를 전달합니다.

---

마지막 업데이트: 2026-03-22 (v1.6.1)
