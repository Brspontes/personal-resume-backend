## 1. Project Setup

- [x] 1.1 Initialize the NestJS project (TypeScript, strict mode) with `package.json`, `tsconfig.json`, `nest-cli.json`.
- [x] 1.2 Add core dependencies: `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `@nestjs/config`, `@nestjs/swagger`, `class-validator`, `class-transformer`, `prisma`, `@prisma/client`.
- [x] 1.3 Add dev dependencies: `jest`, `ts-jest`/`@nestjs/testing`, `supertest`, ESLint/Prettier config consistent with the project's TypeScript strictness.
- [x] 1.4 Create the initial `src/` structure: `common/{filters,interceptors,pipes,decorators}`, `config/`, `health/`, `prisma/`, `app.module.ts`, `main.ts`.

## 2. Environment Configuration

- [x] 2.1 Define a configuration schema (e.g., Joi) validating `PORT`, `NODE_ENV`, `DATABASE_URL`, `FRONTEND_URL`.
- [x] 2.2 Wire `ConfigModule.forRoot({ isGlobal: true, validationSchema })` in `app.module.ts` so startup fails fast with a descriptive error on missing/invalid variables.
- [x] 2.3 Create `.env.example` listing `PORT`, `NODE_ENV`, `DATABASE_URL`, `FRONTEND_URL` with placeholder (non-real) values.
- [x] 2.4 Ensure `.env` is git-ignored.

## 3. Prisma & Database

- [x] 3.1 Initialize `prisma/schema.prisma` with the PostgreSQL datasource using `DATABASE_URL`.
- [x] 3.2 Implement `PrismaService` (extends `PrismaClient`, implements `OnModuleInit`/`OnModuleDestroy`) in `src/prisma/prisma.service.ts`.
- [x] 3.3 Implement a global `PrismaModule` exporting `PrismaService` in `src/prisma/prisma.module.ts`.
- [x] 3.4 Run an initial `prisma migrate dev` (or equivalent) to confirm connectivity end-to-end against a real PostgreSQL instance.

## 4. API Foundation (Versioning, Validation, CORS, Error Handling)

- [x] 4.1 Configure the global `/api/v1` prefix/versioning in `main.ts`.
- [x] 4.2 Register a global `ValidationPipe` (`whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`).
- [x] 4.3 Configure CORS in `main.ts` restricted to the `FRONTEND_URL` origin, with no wildcard in production.
- [x] 4.4 Implement a global `HttpExceptionFilter` in `src/common/filters/` that returns consistent error bodies and never leaks stack traces, DB errors, or other internal details.
- [x] 4.5 Register the exception filter globally (e.g., via `APP_FILTER` provider in `app.module.ts`).

## 5. Health Check

- [x] 5.1 Implement `health.module.ts`, `health.controller.ts`, `health.service.ts` in `src/health/`.
- [x] 5.2 Implement `GET /api/v1/health` returning HTTP 200 with a status payload when the app is operational.
- [x] 5.3 Add Swagger decorators (`@ApiTags`, `@ApiOperation`, `@ApiResponse`) documenting the health endpoint and its response schema.

## 6. API Documentation

- [x] 6.1 Configure `SwaggerModule` in `main.ts` to build the OpenAPI document from controller/DTO metadata.
- [x] 6.2 Serve the Swagger UI at `/api/docs`.
- [x] 6.3 Verify the generated document includes the health endpoint's route, request, and response schemas.

## 7. Logging

- [x] 7.1 Configure Nest's built-in `Logger` for application startup and request-level error logging.
- [x] 7.2 Verify no passwords, tokens, API keys, database credentials, or sensitive user data are ever logged.

## 8. Testing

- [x] 8.1 Configure Jest (unit + e2e) per NestJS conventions (`jest.config`/`test` script, `jest-e2e.json`).
- [x] 8.2 Write a unit/e2e test verifying the application bootstraps successfully.
- [x] 8.3 Write an e2e test for `GET /api/v1/health` returning HTTP 200 with the expected payload.
- [x] 8.4 Write a test verifying the global `ValidationPipe` rejects an invalid payload with HTTP 400 on a sample DTO-validated route (or the health module's own request shape if applicable).
- [x] 8.5 Write a test verifying the application fails to start (or config validation throws) when a required environment variable is missing.
- [x] 8.6 Run the full test suite via the project's standard test command and confirm it passes.

## 9. Build & Verification

- [x] 9.1 Run lint and fix any violations.
- [x] 9.2 Run the production build and confirm it completes without errors.
- [x] 9.3 Start the built application locally with a valid `.env`, and manually verify `GET /api/v1/health` and `GET /api/docs` respond as expected.
- [x] 9.4 Confirm no secrets or `.env` files are committed; verify `.gitignore` covers build artifacts and environment files.
