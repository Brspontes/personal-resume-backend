## 1. Dependency

- [x] 1.1 Add `@scalar/nestjs-api-reference` to `package.json` and install it.

## 2. Implementation

- [x] 2.1 In `src/main.ts`, replace `SwaggerModule.setup('api/docs', app, swaggerDocument)` with `app.use('/api/docs', apiReference({ content: swaggerDocument }))`.
- [x] 2.2 Add an explicit `GET /api/docs-json` route in `src/main.ts` returning `swaggerDocument` as JSON, preserving the URL `SwaggerModule.setup` used to expose automatically.
- [x] 2.3 Verify no other file references `SwaggerModule.setup` or assumes Swagger UI is mounted at `/api/docs`.

## 3. Verification

- [x] 3.1 Run the full test suite via the project's standard test commands and confirm it still passes (no test asserts on Swagger UI's specific HTML/markup).
- [x] 3.2 Run lint and fix any violations.
- [x] 3.3 Run the production build and confirm it completes without errors.
- [x] 3.4 Manually start the app locally and verify `GET /api/docs` renders Scalar's API reference UI listing the health, auth, reactions, and comments endpoints, and that `GET /api/docs-json` still returns the raw OpenAPI document.
