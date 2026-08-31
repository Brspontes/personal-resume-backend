## Why

The portfolio currently relies primarily on the frontend and external services. Future features such as LinkedIn authentication, article likes, comments, and comment replies require server-side logic and persistent data that the frontend cannot own. A dedicated backend must be established as an independent, maintainable foundation before any of these business features can be built.

## What Changes

- Create an independent NestJS backend application (Node.js, TypeScript).
- Configure the modular project structure (`common/`, `config/`, `health/`, `prisma/`).
- Configure Prisma ORM with PostgreSQL connectivity and migration support.
- Configure environment variables (`PORT`, `NODE_ENV`, `DATABASE_URL`, `FRONTEND_URL`) with an `.env.example`.
- Configure versioned REST API routes under `/api/v1`.
- Configure global request validation (DTO-based, rejects invalid payloads with 4xx).
- Configure CORS restricted to the configured frontend origin.
- Configure centralized error handling that hides internal details from API consumers.
- Configure Swagger/OpenAPI documentation available at `/api/docs`.
- Configure application logging that avoids sensitive information.
- Create and document the `GET /api/v1/health` endpoint.
- Configure Jest for automated testing (app bootstrap, health endpoint, validation).
- Verify the production build.

## Capabilities

### New Capabilities
- `health-check`: `GET /api/v1/health` endpoint reporting that the application is operational, documented in Swagger.
- `api-foundation`: Cross-cutting REST API behavior - `/api/v1` versioning prefix, global DTO-based request validation, CORS restricted to the configured frontend origin, and centralized error responses that never leak internal details.
- `api-documentation`: Swagger/OpenAPI documentation published at `/api/docs`, reflecting available endpoints and request/response schemas.
- `environment-configuration`: Application startup validates required environment variables (`PORT`, `NODE_ENV`, `DATABASE_URL`, `FRONTEND_URL`) and fails fast with a clear error when required variables are missing or invalid.

### Modified Capabilities
None. This is the initial backend change; no existing specs are being modified.

## Impact

- New repository content: entire `src/` application tree, `prisma/schema.prisma`, NestJS configuration, Jest configuration, `.env.example`.
- New dependencies: NestJS core packages, Prisma (`@prisma/client`, `prisma`), `class-validator`/`class-transformer` (DTO validation), `@nestjs/swagger`, NestJS config/logging packages.
- New external dependency: PostgreSQL database (e.g., Neon managed instance) reachable via `DATABASE_URL`.
- No impact on the frontend beyond a new HTTP API surface it may later consume.
- No business modules (`auth/`, `users/`, `articles/`, `likes/`, `comments/`) are introduced by this change.
