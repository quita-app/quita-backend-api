# ---------- Stage 1: build (JDK + Maven, discarded at the end) ----------
FROM eclipse-temurin:25-jdk AS build
WORKDIR /app

# Dependencies first: this layer is rebuilt only when pom.xml changes
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw -q -B dependency:go-offline

# Then the source code
COPY src/ src/
RUN ./mvnw -q -B package -DskipTests        # tests already ran in CI

# ---------- Stage 2: runtime (JRE only) ----------
FROM eclipse-temurin:25-jre
WORKDIR /app

# Never run as root inside the container
RUN useradd --system --no-create-home quita
USER quita

COPY --from=build /app/target/*.jar app.jar

# Sized for a 512 MB container (LLD api, section 12). The platform can override it.
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=70 -XX:+UseSerialGC -Xss512k"

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]