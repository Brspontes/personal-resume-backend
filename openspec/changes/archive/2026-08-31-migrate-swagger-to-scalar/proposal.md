## Why

The backend documents its API with `@nestjs/swagger`'s built-in Swagger UI at `/api/docs`. Scalar's API reference UI renders the same underlying OpenAPI document with a more modern, readable interface (better request/response examples, search, dark mode) at no cost to the API surface - the documentation is worth upgrading now that there are real endpoints (auth, reactions, comments) worth reading.

## What Changes

- Replace the Swagger UI rendered at `GET /api/docs` with Scalar's API reference UI, serving the exact same OpenAPI document `@nestjs/swagger` already generates from existing controller/DTO decorators.
- **BREAKING (cosmetic only, no consumers depend on the UI itself)**: the HTML page at `/api/docs` changes from Swagger UI's interface to Scalar's interface. The OpenAPI JSON document's content, and every other API endpoint, is unaffected.
- No changes to any controller, DTO, or Swagger decorator - `@nestjs/swagger`'s `DocumentBuilder`/`SwaggerModule.createDocument` keep generating the OpenAPI spec exactly as they do today; only how that spec is rendered at `/api/docs` changes.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `api-documentation`: The "Swagger Documentation Endpoint" requirement changes from rendering Swagger UI to rendering Scalar's API reference UI at the same `/api/docs` URL, with the same content requirement (reflects currently available endpoints and their schemas).

## Impact

- `src/main.ts`: replace the `SwaggerModule.setup(...)` call (Swagger UI) with Scalar's NestJS integration, reusing the same `SwaggerModule.createDocument(...)` output.
- New dependency: Scalar's NestJS API reference package.
- `package.json`: add the new dependency; no dependency is removed (`@nestjs/swagger` is still required to generate the OpenAPI document).
- No impact on `health-check`, `article-reactions`, `article-comments`, `session-authentication`, `linkedin-login`, or any other capability - their Swagger decorators and generated schemas are unchanged; only the rendering surface at `/api/docs` changes.
- No impact on the raw OpenAPI JSON document's availability - the JSON spec remains fetchable so any tooling that consumes it (e.g. a future frontend codegen step) keeps working.
