# Backend Development Guidelines

## Language

All communication with the user MUST be in Brazilian Portuguese (pt-BR).

This includes:

- Explanations.
- Questions.
- Suggestions.
- Technical discussions.
- Progress updates.
- Error explanations.
- Implementation summaries.
- Responses generated while following OpenSpec specifications.

OpenSpec artifacts such as `proposal.md`, `design.md`, `spec.md`, and `tasks.md` MAY be written in English when the specification requires or prefers English.

The language of the specification MUST NOT change the language used when communicating with the user.

Code, code identifiers, API routes, database fields, environment variables, file names, commit messages, and technical identifiers MAY remain in English according to the project's technical conventions.

## Project Overview

This repository contains the backend API for the personal portfolio application.

The backend is responsible for providing APIs for features that require server-side logic and persistent data, including future user authentication, article interactions, likes, comments, and replies.

The portfolio frontend is maintained as a separate application.

The backend SHALL be developed independently from the frontend and consumed through HTTP/REST APIs.

## Technology Stack

The backend SHALL use:

- Node.js
- TypeScript
- NestJS
- Prisma ORM
- PostgreSQL
- REST API
- Swagger/OpenAPI
- Jest

The PostgreSQL database may be hosted using a managed provider such as Neon.

The database provider SHALL NOT influence the application architecture. The application must remain compatible with standard PostgreSQL.

## Development Methodology

This project uses OpenSpec for specification-driven development.

Claude MUST follow the active OpenSpec change specification before implementing functionality.

Claude MUST NOT implement features that are outside the scope of the active OpenSpec change.

When requirements are unclear or contradictory, Claude SHOULD identify the ambiguity before making architectural assumptions.

Changes SHOULD be implemented incrementally and remain independently testable.

## Architecture

The backend SHALL follow NestJS modular architecture.

Business functionality SHOULD be organized into independent modules.

The expected high-level structure is:

```text
src/
├── common/
├── config/
├── health/
├── prisma/
├── app.module.ts
└── main.ts
```

Future business modules may include:

```text
src/
├── auth/
├── users/
├── articles/
├── likes/
└── comments/
```

Do not create future modules until they are required by an active OpenSpec change.

## Separation of Concerns

Controllers SHALL be responsible primarily for HTTP concerns.

Business logic SHALL reside in services or appropriate application/domain layers.

Database access SHALL be performed through Prisma.

Infrastructure concerns SHALL remain separated from business logic whenever practical.

Avoid placing business logic directly inside controllers.

## Code Quality

Prioritize:

1. Readability.
2. Maintainability.
3. Testability.
4. Strong typing.
5. Separation of concerns.
6. Reusability.
7. Minimal duplication.

Do not duplicate logic when a reusable abstraction provides a clear improvement.

Do not create abstractions prematurely when they do not provide meaningful value.

Prefer simple and explicit implementations over unnecessary architectural complexity.

## TypeScript

Use strict TypeScript configuration.

Avoid `any` whenever possible.

Prefer explicit types for public APIs and important application boundaries.

Do not suppress TypeScript errors without understanding and documenting the reason.

## API

The API SHALL use REST conventions.

All public API endpoints SHALL use the `/api/v1` prefix.

Example:

```text
GET /api/v1/health
```

Resource naming SHOULD use plural nouns where appropriate.

HTTP methods and status codes SHALL follow conventional REST semantics.

## Validation

Global request validation SHALL be enabled.

DTOs SHOULD be used for request validation and transformation.

Invalid client input SHALL result in an appropriate HTTP 4xx response.

Validation rules SHOULD be explicit and easy to understand.

## Error Handling

API errors SHALL use consistent HTTP responses.

Production responses MUST NOT expose:

- Stack traces.
- Database credentials.
- SQL queries.
- Internal implementation details.
- Sensitive infrastructure information.

Unexpected errors SHOULD be handled centrally.

## Database

Prisma SHALL be the ORM used to access PostgreSQL.

Database schema changes SHALL be performed through Prisma migrations.

Never modify the production database schema manually when the change can be represented through a Prisma migration.

Do not introduce another ORM or database abstraction layer.

The database connection string SHALL be provided through environment variables.

## Prisma

Use a centralized Prisma service integrated with the NestJS application lifecycle.

Prisma Client SHALL be generated as part of the project setup/build process when required.

Database access should be kept out of controllers.

Prisma queries SHOULD be optimized to retrieve only the data required by the application.

## Environment Variables

Environment-specific configuration SHALL be stored in environment variables.

Secrets MUST NOT be committed to source control.

Provide an `.env.example` containing the required variables without real credentials.

Expected configuration includes:

```text
PORT
NODE_ENV
DATABASE_URL
FRONTEND_URL
```

Additional variables may be introduced by future OpenSpec changes.

## CORS

CORS SHALL be configurable through environment variables.

Production environments SHOULD allow only the configured frontend origin.

Do not use unrestricted wildcard CORS in production unless explicitly required and justified.

## Swagger

Swagger/OpenAPI SHALL be used to document the API.

API documentation SHOULD be available through:

```text
/api/docs
```

New endpoints MUST include appropriate Swagger metadata.

## Health Check

The backend SHALL expose:

```text
GET /api/v1/health
```

The endpoint should provide a simple indication that the application is operational.

Database health checks may be added when required by the architecture.

## Testing

Jest SHALL be used for automated testing.

New functionality MUST include appropriate tests according to its scope.

Tests SHOULD cover:

- Expected behavior.
- Validation.
- Error scenarios.
- Important business rules.

Do not write tests that only verify framework behavior without adding meaningful coverage.

## Security

Never commit secrets, API keys, tokens, passwords, or private credentials.

Authentication and authorization SHALL be implemented only through an approved OpenSpec change.

Do not expose sensitive database or infrastructure information through API responses.

Public endpoints SHOULD be evaluated for rate limiting and abuse prevention when implemented.

## Logging

Application logging SHOULD provide useful information for diagnosing production problems without exposing sensitive information.

Do not log:

- Passwords.
- Authentication tokens.
- API keys.
- Database credentials.
- Sensitive user information.

## Git

Keep commits focused and related to the active OpenSpec change.

Do not mix unrelated refactoring with feature implementation.

Do not commit generated secrets, local environment files, or build artifacts.

## Dependencies

Prefer established and well-maintained libraries.

Do not add a dependency when the required functionality can be implemented clearly using the existing stack.

Every new dependency SHOULD have a clear justification.

## Implementation Rules

Before implementing a feature:

1. Read the active OpenSpec proposal.
2. Read the associated specification.
3. Read the design when available.
4. Understand the existing project structure.
5. Implement only the requested scope.
6. Add or update tests.
7. Run linting and tests.
8. Verify the production build.

Do not skip specification review before implementation.

## Future Features

The backend is expected to support future features such as:

- LinkedIn authentication.
- User management.
- Article integration with Sanity.
- Article likes.
- Removing likes.
- Comments.
- Editing comments.
- Removing comments.
- Comment replies.

These features SHALL be implemented through separate OpenSpec changes.

Do not implement them during the initial backend foundation change.
