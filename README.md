# quita-backend-api

API of **Quita**, a B2B debt collection and renegotiation platform. A modular monolith in Spring Boot (Spring Modulith), with PostgreSQL and Flyway.

## Stack

Java 25 · Spring Boot 4.1 · Spring Modulith · Spring Data JPA · Flyway · Spring Security · PostgreSQL 18 · Testcontainers

## Running locally

Requirements: JDK 25 and Docker.

```bash
docker compose up -d                                         # local PostgreSQL
./mvnw spring-boot:run -Dspring-boot.run.profiles=local      # API on http://localhost:8080
curl localhost:8080/actuator/health                          # {"status":"UP", ...}
```

The API contract is served at `http://localhost:8080/swagger-ui.html` (local profile only) and versioned in `openapi.json`.

## Tests

```bash
./mvnw verify   # needs Docker running (Testcontainers)
```

## Configuration

Environment variables are documented in `.env.example`.
