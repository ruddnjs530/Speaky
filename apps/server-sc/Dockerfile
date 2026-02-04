FROM eclipse-temurin:21-jdk AS builder
# Why: Debian-based image avoids glibc/musl issues with Protoc
WORKDIR /app

# 1. Copy Wrapper & Config
COPY apps/server-sc/gradlew .
COPY apps/server-sc/gradle ./gradle
COPY apps/server-sc/build.gradle apps/server-sc/settings.gradle ./
COPY packages/proto src/main/proto

# 2. Grant execution rights
RUN chmod +x gradlew

# 3. Download Dependencies (using wrapper)
RUN ./gradlew dependencies --no-daemon

# 4. Build Source
COPY apps/server-sc/src ./src
RUN ./gradlew build -x test --no-daemon

FROM eclipse-temurin:21-jre AS runner
WORKDIR /app
COPY --from=builder /app/build/libs/*.jar app.jar
EXPOSE 8080
CMD ["java", "-jar", "app.jar"]
