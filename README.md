# 00Hub — Personal Productivity Command Center

> ADHD 친화적 설계의 개인 생산성 대시보드. 하루의 시작부터 끝까지 단 하나의 창에서.

---

## 주요 기능

- **The One Thing** — 오늘의 가장 중요한 목표를 화면 전체로
- **Discipline Map** — 30일 성취도를 CMYK 색상 레이어로 시각화하는 히트맵
- **Action Items** — 3단계 상태(TODO/DOING/DONE) + 서브태스크 + 드래그 앤 드롭
- **Premium Notifications** — 브라우저 기본창을 대체하는 커스텀 토스트 알림 및 글래스모피즘 확인 모달
- **Daily Quests** — 자정 자동 리셋되는 반복 습관 체크리스트
- **Deep Work Timer** — 오늘의 집중 시간 측정 (목표 3시간)
- **Brain Dump** — 머릿속을 비우는 자유 메모장
- **Zen Mode** — 시계 클릭 한 번으로 진입하는 완전 집중 화면 + 백색소음 + 상단 고정(TopMost)
- **System Tray App** — 작업 표시줄 공간을 차지하지 않고 트레이 아이콘으로 상시 거주
- **Overlay Control** — 상단 호버 시 나타나는 투명 바를 통해 간편하게 최소화 (Alt+Tab 완벽 지원)

## 실행 방법

```text
00Hub.exe 더블 클릭 → 독자적인 WebView2 창으로 앱 실행
```

- 창 상단 제어 바 클릭: 시스템 트레이로 최소화
- 트레이 아이콘 더블 클릭: 창 다시 열기
- 트레이 아이콘 우클릭: 모니터 이동 및 완전 종료

종료: `stop_hub.bat` 실행

## 기술 스택

React 19 · Vite 7 · PWA (vite-plugin-pwa) · Web Audio API · C# 런처

---

## 문서

| 문서 | 설명 |
| --- | --- |
| [ABOUT.md](./docs/ABOUT.md) | 앱 전체 기능 소개 및 개발 여정 |
| [PROJECT_GUIDE.md](./docs/PROJECT_GUIDE.md) | 폴더 및 파일 구조 가이드 |
| [CODE_REFERENCE.md](./docs/CODE_REFERENCE.md) | 코드별 상세 설명 (유지보수용) |
| [ROADMAP.md](./docs/ROADMAP.md) | 향후 개발 계획 및 알려진 이슈 |

---

Built by Parallel Lee × Antigravity — 2026.03
