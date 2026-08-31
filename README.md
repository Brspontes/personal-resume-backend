# Personal Resume Backend

Backend API for [brianpontes.dev](https://www.brianpontes.dev) — a standalone NestJS service that handles everything the static portfolio frontend can't do on its own: authentication, and (soon) article interactions such as likes and comments.

[![Node.js](https://img.shields.io/badge/node-%3E%3D18.18.0-339933?logo=node.js&logoColor=white)](package.json)
[![NestJS](https://img.shields.io/badge/NestJS-10-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io)
[![Tests](https://img.shields.io/badge/tests-56%20passing-brightgreen?logo=jest&logoColor=white)](#testing)
[![Coverage](https://img.shields.io/badge/coverage-96%25-brightgreen)](#testing)
[![License](https://img.shields.io/badge/license-private-lightgrey)](#license)

## About

This backend is developed independently from the [portfolio frontend](https://www.brianpontes.dev) and consumed exclusively through a versioned REST API. It follows [OpenSpec](https://github.com/Fission-AI/OpenSpec) for spec-driven development — every capability starts as a written proposal and spec before a line of implementation code exists (see [`openspec/specs`](openspec/specs)).

## Features

- **LinkedIn login (OpenID Connect)** — visitors authenticate with their real LinkedIn identity; no passwords for this app to manage.
- **Cookie-based sessions** — a signed JWT lives in an httpOnly, secure cookie. The frontend never touches the token directly.
- **`returnTo` redirect** — login can be triggered from any page (e.g. an article) and the visitor lands back exactly where they started.
- **Reusable `AuthGuard`** — future authenticated features (likes, comments) protect their routes without knowing anything about LinkedIn or JWTs.
- **Validated configuration** — the app refuses to boot with a missing or malformed environment variable, with a descriptive error and no leaked secrets.
- **Centralized, sanitized error handling** — no stack traces, SQL, or credentials ever reach an API response.
- **OpenAPI documentation** — every endpoint is documented live at `/api/docs`.

## Tech Stack

| | |
|---|---|
| Runtime | Node.js, TypeScript |
| Framework | NestJS |
| ORM / Database | Prisma + PostgreSQL ([Neon](https://neon.tech)) |
| Auth | LinkedIn OpenID Connect (`openid-client`) + JWT sessions (`@nestjs/jwt`) |
| Validation | `class-validator` / `class-transformer`, Joi (env config) |
| Docs | Swagger / OpenAPI (`@nestjs/swagger`) |
| Testing | Jest, Supertest |
| Deployment | [Render](https://render.com) |

## Architecture

```text
┌──────────────────┐
│ Portfolio         │
│ Next.js (Vercel)  │
└────────┬───────────┘
         │ HTTPS / REST
         ▼
┌──────────────────┐        ┌──────────────────┐
│ Backend           │───────▶│ LinkedIn         │
│ NestJS (Render)   │  OIDC  │ OpenID Connect   │
└────────┬───────────┘        └──────────────────┘
         │ Prisma
         ▼
┌──────────────────┐
│ PostgreSQL         │
│ Neon (pooled)      │
└──────────────────┘
```

## Project Structure

```text
src/
├── auth/            # Session cookie, JWT, AuthGuard, LinkedIn login/callback endpoints
├── linkedin/         # LinkedIn OIDC protocol - the only place that talks to LinkedIn's API
├── users/            # Application user persistence (Prisma)
├── health/           # GET /api/v1/health
├── common/filters/    # Global HTTP exception filter
├── config/            # Environment variable validation (Joi)
├── prisma/            # PrismaService / PrismaModule
├── app.module.ts
└── main.ts

prisma/
├── schema.prisma
└── migrations/

openspec/
├── specs/            # Current, merged capability specs (source of truth for behavior)
└── changes/archive/   # Every past change, with its proposal/design/tasks preserved
```

Each business capability owns its module; a business module never reaches into another one's internals (e.g. `linkedin/` never touches Prisma, `auth/` never talks to LinkedIn directly).

## Getting Started

### Prerequisites

- Node.js `>=18.18.0`
- Docker (for a local PostgreSQL instance) — or any reachable PostgreSQL database
- A [LinkedIn OAuth app](https://www.linkedin.com/developers/apps) with **"Sign In with LinkedIn using OpenID Connect"** enabled

### Setup

```bash
git clone git@github.com:Brspontes/personal-resume-backend.git
cd personal-resume-backend
npm install

# Local PostgreSQL via Docker
docker compose up -d

# Configure environment variables
cp .env.example .env
# then fill in DATABASE_URL/DIRECT_URL, LINKEDIN_*, and AUTH_JWT_SECRET

# Apply database migrations
npx prisma migrate dev

# Start the dev server (watch mode)
npm run start:dev
```

The API is now available at `http://localhost:3000/api/v1`, with interactive docs at `http://localhost:3000/api/docs`.

## Environment Variables

See [`.env.example`](.env.example) for the full, up-to-date list with inline comments. Summary:

| Variable | Description |
|---|---|
| `PORT` | HTTP port the server listens on (default `3000`) |
| `NODE_ENV` | `development` \| `production` \| `test` — also controls cookie `secure`/`sameSite` behavior |
| `DATABASE_URL` | PostgreSQL connection string used at runtime. On Neon, use the **pooled** endpoint |
| `DIRECT_URL` | Non-pooled PostgreSQL connection string, used only by `prisma migrate deploy` |
| `FRONTEND_URL` | Portfolio frontend origin — drives CORS and the post-login redirect target |
| `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` | LinkedIn OAuth app credentials |
| `LINKEDIN_CALLBACK_URL` | Must exactly match a redirect URL registered on the LinkedIn app |
| `AUTH_JWT_SECRET` | Signs the session JWT (minimum 32 characters) |

Startup fails fast, with a descriptive error and no leaked values, if any of these is missing or invalid.

## API

Interactive OpenAPI docs: **`/api/docs`** (also served in production).

| Method | Route | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/health` | Public | Liveness check |
| `GET` | `/api/v1/auth/linkedin` | Public | Starts LinkedIn login; accepts an optional `?returnTo=` |
| `GET` | `/api/v1/auth/linkedin/callback` | Public (LinkedIn only) | Completes login, sets the session cookie, redirects back |
| `GET` | `/api/v1/auth/me` | Session cookie | Returns the authenticated user's profile |
| `POST` | `/api/v1/auth/logout` | Public | Clears the session cookie |

## Available Scripts

| Script | Description |
|---|---|
| `npm run start:dev` | Start the app in watch mode |
| `npm run build` | Compile to `dist/` |
| `npm run start:prod` | Run the compiled build |
| `npm run lint` | ESLint (auto-fix) |
| `npm test` | Unit tests |
| `npm run test:e2e` | End-to-end tests (full HTTP request/response cycle) |
| `npm run test:cov` | Unit test coverage |
| `npm run test:cov:all` | Combined unit + e2e coverage report |
| `npm run prisma:migrate` | Create/apply a dev migration |
| `npm run prisma:migrate:deploy` | Apply pending migrations (production) |

## Testing

```text
56 tests passing  (37 unit · 19 end-to-end)
96.34% statement coverage · 95.83% line coverage
```

- **Unit tests** exercise services, guards, and utilities in isolation (Prisma and LinkedIn's OIDC client are mocked — no network calls, no real database).
- **E2E tests** boot the real NestJS application (with a fake in-memory Prisma layer and a mocked LinkedIn provider) and drive it through Supertest: full login round-trips, `returnTo` handling, guarded-route access, validation, and error responses.
- The full LinkedIn OAuth flow, cookie behavior, and Neon connectivity have also been verified manually end-to-end against the real LinkedIn API and a real deployment (see `design.md` in the archived `add-linkedin-auth` change for the two provider-specific quirks that surfaced during that verification).

Run everything and get one merged coverage report:

```bash
npm run test:cov:all
```

## Deployment

Deployed on [Render](https://render.com) as a Web Service, database on [Neon](https://neon.tech).

- **Build command:** `npm install --include=dev && npm run build`
  (Render sets `NODE_ENV=production`, which makes a plain `npm install` skip `devDependencies` — including the NestJS CLI and TypeScript needed to build. `--include=dev` forces them in regardless.)
- **Start command:** `npx prisma migrate deploy && npm run start:prod`
- **Required env vars:** everything listed in [Environment Variables](#environment-variables), using Neon's **pooled** connection string for `DATABASE_URL` and the **direct** one for `DIRECT_URL`.
- The LinkedIn app's authorized redirect URLs must include the deployed `LINKEDIN_CALLBACK_URL`.

## Roadmap

Delivered so far (see [`openspec/changes/archive`](openspec/changes/archive) for the full proposal/design/tasks of each):

- ✅ Backend foundation — NestJS, Prisma, validation, CORS, error handling, Swagger, health check
- ✅ LinkedIn OpenID Connect authentication, cookie sessions, `returnTo`

Planned, each as its own spec-driven change:

- ⏳ Article likes
- ⏳ Comments and replies

## License

Private / unlicensed — part of a personal portfolio project, not intended for reuse.
