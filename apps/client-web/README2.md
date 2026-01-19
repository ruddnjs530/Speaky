## 🧱 Frontend Architecture Overview

본 프론트엔드 애플리케이션은
WebRTC 기반 실시간 스트리밍 서비스를 목표로 하며,
Host / Viewer 역할 분리, 상태 중심 UI, 통신 규약 기반 시그널링을 핵심 설계 원칙으로 합니다.

---

## 1. Architecture Principles
   ### 1️⃣ 상태 중심 설계 (State-driven UI)

- UI 컴포넌트는 직접 네트워크/미디어 이벤트를 제어하지 않음

- 모든 화면 전환과 UX는

  - 세션 상태

  - 연결 상태

  - 미디어 상태
  
  에 의해 선언적으로 결정

### 2️⃣ 역할 분리 (Host / Viewer)

- Host와 Viewer는 명확히 다른 진입 경로와 책임을 가짐

- 공통 미디어 UI는 재사용하되,

  - 연결 방식

  - 자동 재생 정책

  - 권한 요구
  
  는 역할에 따라 분기

### 3️⃣ 레이어드 구조

- Page → Feature → Model/Hook → UI 순으로 책임 분리

- 통신(WebRTC/REST/WS) 로직은 UI 외부에 캡슐화

---
## 2. High-Level Layer Structure
   ```
   pages        : 라우팅 단위 화면 (Host / Viewer / Auth)
   features     : 도메인 기능 단위 (host, screenShare, media 등)
   ├─ model   : 상태/로직 훅 (WebRTC, 상태 계산)
   ├─ api     : REST / signaling 통신
   └─ ui      : 기능 단위 UI 컴포넌트
   shared       : 공용 UI 컴포넌트 / 스타일
   ```
----
## 3. Routing & Role Separation
   ### Routing Policy

- Public Routes

  - / : Home

  - /login

  - /viewer/:roomId (비로그인 허용)

- Protected Routes

  - /host/precheck

  - /host/studio

  - /profile

### Access Control

- ProtectedRoute를 통해 Host 전용 페이지 접근 제어

- 인증 여부에 따라 자동 리다이렉트 처리

---
## 4. Core Runtime Flow
 ###  4-1. Host Flow

#### 1. Pre-check

- 마이크 권한, 입력 레벨, 장치 상태 점검

- 상태 기반 UI로 진행 가능 여부 판단

#### 2. Studio 진입

- Screen Capture 시작

- WebRTC 연결 생성

- 변조된 remote stream 미리보기

#### 3. Live 상태

- 연결 상태/미디어 상태를 실시간 반영

### 4-2. Viewer Flow

#### 1. Room 상태 감지

- room phase(waiting/live/ended) 폴링

#### 2. Live 진입 시 자동 연결

- WebRTC Viewer 연결 수행

#### 3. Autoplay 대응

- 브라우저 정책에 따라 자동 재생 시도

- 실패 시 사용자 제스처 기반 재생 UX 제공
---
## 5. Media & WebRTC Architecture
   ### WebRTC 책임 분리

- useScreenShare

  - Screen Capture

  - RTCPeerConnection 생성/관리

  - Offer/Answer 교환

  - remote stream 수신

- UI는 MediaStream만 전달받아 렌더링

### Media Rendering

- StreamPreview

  - video.srcObject 바인딩

  - 재생 시도 및 예외 처리

- HostMediaPanel / ViewerMediaPanel

  - 역할별 UX 차이를 캡슐화
------
## 6. Communication Model (Current)
| 구분             | 방식        | 용도                    |
| -------------- | --------- | --------------------- |
| Session / Room | REST      | start / join / status |
| Signaling      | REST (임시) | offer / answer        |
| Media          | WebRTC    | audio / video stream  |


향후 Signaling은 WebSocket 기반으로 전환 예정이며,
현재 구조는 이를 고려한 모듈 분리를 유지합니다.
---
## 7. UX & Resilience Strategy

- 연결 상태 안내 (Connecting / Connected / Failed)

- 자동 재생 실패 대응 UX

- 네트워크/미디어 상태 변화에 따른 화면 분기

- 재연결/재시도 UX를 고려한 구조 설계

---
## 8. Deployment Context

- Docker 기반 빌드/배포

- 프론트엔드는 정적 빌드 후 Nginx 서빙

- 모노레포 구조를 기준으로 경로/빌드 컨텍스트 고정
---
## Summary

본 프론트엔드는
**“통신 규약 기반, 상태 중심, 역할 분리”**를 핵심 원칙으로 하여
실시간 스트리밍 서비스의 복잡성을 관리 가능한 구조로 설계되었습니다.