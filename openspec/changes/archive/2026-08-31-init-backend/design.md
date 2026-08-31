## Context

This is a greenfield backend with no existing code. See proposal.md - Why/What Changes for motivation and scope. The stack, structure, and conventions are fixed by CLAUDE.md (NestJS, Prisma, PostgreSQL, `/api/v1`, Swagger at `/api/docs`, Jest). This document covers the technical decisions needed to wire those pieces together consistently, since several of them (config validation, error handling, Prisma lifecycle) have more than one reasonable implementation.

## Goals / Non-Goals

**Goals:**
- Establish one consistent pattern each for configuration loading/validation, request validation, error handling, and Prisma access, so future feature modules (auth, users, articles, likes, comments) can be added without re-deciding these patterns.
- Keep the foundation minimal: only what `success criteria` in the proposal requires.

**Non-Goals:**
- Designing the schema for any future business entity (users, articles, likes, comments). No Prisma models beyond what is strictly needed to prove connectivity.
- Designing authentication/authorization. That is explicitly out of scope per proposal.md - Non-Goals.
- Choosing a deployment/hosting platform for the backend itself (only the database provider, Neon, is mentioned, and only as an implementation detail behind `DATABASE_URL`).

## Decisions

### Configuration loading and validation
Use `@nestjs/config` with a Joi (or class-validator-based) validation schema evaluated at module load time (`ConfigModule.forRoot({ validationSchema })`), so the process exits with a descriptive error immediately on boot if `PORT`, `NODE_ENV`, `DATABASE_URL`, or `FRONTEND_URL` are missing or malformed. This satisfies the `environment-configuration` spec's "fail fast" requirement without hand-rolled bootstrap checks.
- Alternative considered: manual `process.env` checks in `main.ts`. Rejected - harder to keep in sync as variables grow, and loses typed, centralized access via a `ConfigService`.

### Global validation
Enable a single global `ValidationPipe` (`whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`) in `main.ts`, paired with per-endpoint DTOs using `class-validator`/`class-transformer` decorators. This is the standard NestJS approach and satisfies the `api-foundation` validation requirement uniformly across all future endpoints without per-controller boilerplate.

### Centralized error handling
Implement a single global `HttpExceptionFilter` (`APP_FILTER`) that:
- Passes through NestJS `HttpException` responses (status + message) as-is.
- Catches anything else, logs the full error internally, and returns a generic sanitized 500 body.
This is the one place that guarantees stack traces/DB errors never reach a client response, satisfying `api-foundation`'s centralized error handling requirement.

### Prisma integration
A `PrismaService` extends `PrismaClient`, implements `OnModuleInit`/`OnModuleDestroy` to connect/disconnect with the Nest application lifecycle, and is exported from a global `PrismaModule` so any future feature module can inject it without re-importing Prisma setup. Migrations are managed via the standard `prisma migrate` workflow against `DATABASE_URL`; no custom migration tooling.

### API versioning and Swagger
Use Nest's built-in URI versioning (global prefix `api/v1`) rather than a custom routing scheme, since it's the built-in, well-supported option and matches the fixed `/api/v1` requirement. Swagger is configured via `@nestjs/swagger`'s `SwaggerModule.setup('api/docs', app, document)` in `main.ts`, generating the OpenAPI document from controller/DTO decorators rather than a hand-written spec file, so documentation stays in sync with the code automatically.

### Logging
Use Nest's built-in `Logger` (no external logging library) for this foundational change, since CLAUDE.md only requires "useful information for diagnosing production problems" without specifying structured/external logging - introducing a logging library isn't justified until a concrete need (e.g., log aggregation) exists.

## Risks / Trade-offs

- [Neon free-tier connection limits/cold starts could cause intermittent connection errors] → Prisma's connection handling plus the centralized error filter ensures such failures surface as sanitized 5xx responses rather than crashing the process; revisit connection pooling if this becomes a real issue.
- [Built-in `Logger` has no log levels/transport configuration beyond console output] → Acceptable for this foundational change; swapping to a structured logger later is isolated to one module and does not affect the specs in this change.
- [Global `ValidationPipe` with `forbidNonWhitelisted: true` could reject clients sending extra fields] → This is intentional per the `api-foundation` spec; document the behavior in Swagger so consumers know unexpected fields are rejected.

## Migration Plan

Not applicable in the traditional sense - there is no existing backend or production traffic to migrate. Initial deployment steps:
1. Provision the PostgreSQL database (Neon) and set `DATABASE_URL`.
2. Run `prisma migrate deploy` to apply the initial (empty/minimal) schema.
3. Set `PORT`, `NODE_ENV`, `FRONTEND_URL` in the target environment.
4. Start the application; verify `/api/v1/health` and `/api/docs` respond as expected.

Rollback is simply not deploying/removing the new service, since no other system depends on it yet.
