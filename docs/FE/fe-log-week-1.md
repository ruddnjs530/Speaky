# Frontend 진행 상황

### 1) 2026.01.14 (수)

* **김경원**
* React Router 기반 **페이지 라우팅 구조(Home/Login/Profile)** 설계 및 적용
* pages 단위로 **초기 프로젝트 구조 분리** → 화면 단위 개발 기반 구축


* **신형섭**
* React 함수 컴포넌트 + TypeScript로 **공용 UI 컴포넌트 설계**
* 로그인 폼에 **입력 검증 / 로딩 / 에러 UX**를 상태 기반 렌더링으로 구현



---

### 2) 2026.01.15 (목)

* **김경원**
* **ProtectedRoute 가드** 추가 → 미로그인 시 **/login 리다이렉트** 처리
* Screen Capture API(**getDisplayMedia**) 연동 → 호스트 화면 공유(탭/창/전체 화면 선택) 정상 동작
* WebRTC 서버 변조 스트림을 **useScreenShare + StreamPreview**로 미리보기 가능하도록 **스트림 관리 UI 연결**


* **신형섭**
* Host(로그인 필수) / Viewer(비로그인 가능) **진입 경로 분리**
* Host 영역을 **보호 라우트로 구성**하여 인증 기반 접근 제어
* 방송 전 단계인 **Pre-check(마이크 권한 요청/장치 선택/입력 레벨 확인)** 페이지의 UI 구조 및 상태 모델 설계·구현
* 헬스 배지(상태 표시) UI 틀 구성



---

### 3) 2026.01.16 (금)

* **김경원**
* Viewer **화면 분기 로직** 추가: room 상태(**waiting / live / ended**)에 따라 대기/시청 화면 전환
* 라이브 감지를 위한 **room 상태 폴링(fetch)** 추가 → live 감지 시 viewer가 **connect({ role:'viewer', roomId }) 자동 호출**
* **자동 재생(autoplay)** 처리: remoteStream 수신 후 `video.play()` 시도, 실패 시 **사용자 재생 버튼 fallback**


* **신형섭**
* Viewer/Host 공용 미디어 UI 구조 개선: **StreamPreview를 ref 기반으로 확장**
* **볼륨/음소거(AudioControl)** 및 **연결 상태 안내/재연결 배너 UI** 구현
* MediaPanel 단위 **캡슐화**로 페이지 로직과 UI 책임 분리 → 협업 충돌 최소화
* 전체 스타일 마감
