## Context

`src/main.ts` currently builds the OpenAPI document with `@nestjs/swagger`'s `DocumentBuilder` + `SwaggerModule.createDocument`, then calls `SwaggerModule.setup('api/docs', app, swaggerDocument)`, which mounts Swagger UI at `/api/docs` and, as a side effect, also exposes the raw spec at `/api/docs-json`. See proposal.md - Why for motivation. This document covers how to swap only the rendering layer while keeping document generation and the JSON spec's availability unchanged.

## Goals / Non-Goals

**Goals:**
- Keep `DocumentBuilder`/`SwaggerModule.createDocument` exactly as they are - every existing `@ApiTags`/`@ApiOperation`/`@ApiResponse` decorator across `health`, `auth`, `reactions`, and `comments` keeps working unmodified.
- Keep the raw OpenAPI JSON reachable at the same `/api/docs-json` URL it's at today, independent of which UI renders `/api/docs`.

**Non-Goals:**
- Any change to which endpoints are documented or how their DTOs are described - this change touches only `main.ts`'s doc-serving setup.
- Customizing Scalar's theme/branding beyond the defaults - not required by the proposal; can be a follow-up if desired.

## Decisions

### Use `@scalar/nestjs-api-reference`'s `apiReference()` middleware
Scalar publishes an official NestJS integration, `@scalar/nestjs-api-reference`, exporting an `apiReference(config)` function that returns Express middleware. Replace the `SwaggerModule.setup('api/docs', app, swaggerDocument)` call with `app.use('/api/docs', apiReference({ content: swaggerDocument }))`, passing the exact same `swaggerDocument` object `SwaggerModule.createDocument` already produces. `content` embeds the spec directly, so Scalar doesn't need a separate network round-trip to fetch it.
- Alternative considered: point Scalar at a `url` instead of embedding `content`. Rejected as an unnecessary extra hop when the document is already in memory at bootstrap.

### Keep `/api/docs-json` as an explicit route
`SwaggerModule.setup()` auto-exposes `<path>-json` as a side effect; once it's removed, that route disappears unless recreated. Add one explicit line in `main.ts`: `app.getHttpAdapter().get('/api/docs-json', (_req, res) => res.json(swaggerDocument))`, preserving the exact URL and behavior any existing or future tooling (codegen, the frontend) might rely on, per the proposal's explicit "no impact on the raw OpenAPI JSON document's availability" impact note.

### No change to `DocumentBuilder` configuration
Title, description, and version stay as already configured; this change is scoped to the rendering surface only.

## Risks / Trade-offs

- [Scalar's "try it" request execution, like Swagger UI's, calls endpoints via `fetch()` from the docs page - redirect-based endpoints such as `GET /api/v1/auth/linkedin` still can't be meaningfully exercised from the docs UI] → Not a regression: Swagger UI had the exact same limitation (already noted to the user for the current Swagger docs); no behavior gets worse.
- [A new external dependency (`@scalar/nestjs-api-reference`) is added] → Justified per the proposal's motivation (better documentation UX); it only affects the `/api/docs` rendering path, not runtime API behavior.

## Migration Plan

1. Add `@scalar/nestjs-api-reference` to `package.json`.
2. Update `src/main.ts`: replace `SwaggerModule.setup(...)` with the `apiReference()` middleware mount plus the explicit `/api/docs-json` route.
3. Deploy; no data migration, no other endpoint changes.

Rollback: revert `main.ts` to call `SwaggerModule.setup('api/docs', app, swaggerDocument)` again and remove the dependency - fully reversible, no persisted state involved.
