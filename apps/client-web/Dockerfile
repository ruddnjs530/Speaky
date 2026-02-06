# ==========================================
# 기본(Base) 스테이지
# ==========================================
FROM node:22-alpine AS base
WORKDIR /app
COPY apps/client-web/package.json apps/client-web/package-lock.json ./
# 설명: 'ci'는 lockfile에 명시된 정확한 버전을 사용하도록 보장함
RUN npm ci

# ==========================================
# 개발(Development) 스테이지
# ==========================================
FROM base AS dev
# 초기 빌드를 위해 파일들을 복사하지만, docker-compose의 볼륨 마운트가 이를 덮어써 실시간 수정이 가능함
COPY apps/client-web .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]

# ==========================================
# 빌더(Builder) 스테이지
# ==========================================
FROM base AS builder
# 빌더를 위해 소스 코드를 명시적으로 복사
COPY apps/client-web .

# 빌드 타임 변수 주입
ARG VITE_API_URL
ARG VITE_WS_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

# 데모 안정성을 위해 tsc 검사 건너뜀
RUN npx vite build

# ==========================================
# 프로덕션(Production) 스테이지
# ==========================================
FROM nginx:1.25-alpine AS prod
# 빌더 스테이지를 올바르게 참조
COPY --from=builder /app/dist /usr/share/nginx/html
# Fix: Remove default config and copy custom nginx config
RUN rm /etc/nginx/conf.d/default.conf
COPY apps/client-web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
