client-web/
├─ README.md
├─ docs/
├─ public/
├─ src/
│ ├─ main.tsx
│ ├─ App.tsx
│ ├─ assets/
│ ├─ pages/
│ │ ├─ HomePage.tsx
│ │ ├─ LoginPage.tsx
│ │ ├─ ProfilePage.tsx
│ │ ├─ host/
│ │ │ ├─ HostPrecheckPage.tsx
│ │ │ └─ HostPage.tsx
│ │ └─ viewer/
│ │ └─ ViewerPage.tsx
│ ├─ layouts/
│ │ ├─ SessionLayout.tsx
│ │ └─ SessionProviderLayout.tsx
│ ├─ features/
│ │ ├─ auth/
│ │ │ ├─ api/ (login.ts, logout.ts)
│ │ │ └─ ui/ (LoginForm.tsx)
│ │ ├─ host/
│ │ │ ├─ hooks/
│ │ │ └─ ui/ (+ assets/)
│ │ ├─ media/
│ │ │ ├─ model/
│ │ │ └─ ui/
│ │ ├─ screenShare/
│ │ │ ├─ api/
│ │ │ ├─ model/
│ │ │ └─ ui/
│ │ └─ session/
│ │ ├─ api/
│ │ ├─ errors/
│ │ ├─ hooks/
│ │ ├─ state/
│ │ ├─ ui/
│ │ │ ├─ panels/
│ │ │ └─ ErrorDialog.tsx
│ │ └─ utils/
│ └─ shared/
│ ├─ lib/
│ │ ├─ apiFetch.ts
│ │ ├─ authToken.ts
│ │ └─ signaling/ (SignalingClient.ts, envelope.ts, parse.ts, ...)
│ ├─ styles/ (mediaControls.css)
│ └─ ui/
│ ├─ Button.tsx / Input.tsx / Card.tsx
│ ├─ ConnectionBadge.tsx(+css)
│ ├─ HealthPanel.tsx(+css)
│ └─ ErrorModal.tsx
└─ (vite/tsconfig/eslint 설정 파일들)
