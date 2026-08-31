## Purpose

Ensures the backend only starts with a complete, valid runtime configuration, so misconfiguration is caught at startup rather than surfacing as unpredictable failures once the application is serving traffic.

## Requirements

### Requirement: Required Environment Variables Are Validated At Startup
The system SHALL validate that `PORT`, `NODE_ENV`, `DATABASE_URL`, `DIRECT_URL`, `FRONTEND_URL`, `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_CALLBACK_URL`, and `AUTH_JWT_SECRET` are present and well-formed before the application begins accepting requests, and SHALL fail to start with a descriptive error when any required variable is missing or invalid.

#### Scenario: Application starts with valid configuration
- **WHEN** the application is started with all required environment variables present and valid
- **THEN** the application starts successfully and begins accepting requests

#### Scenario: Application refuses to start with missing configuration
- **WHEN** the application is started with a required environment variable missing or empty
- **THEN** the application fails to start and logs a descriptive error identifying the missing variable, without exposing secret values

#### Scenario: Application refuses to start with a weak session secret
- **WHEN** the application is started with `AUTH_JWT_SECRET` shorter than the minimum required length
- **THEN** the application fails to start and logs a descriptive error, without exposing the configured value

### Requirement: Example Environment File
The repository SHALL provide an `.env.example` file listing every environment variable required to run the application, without real credentials.

#### Scenario: Developer bootstraps local environment
- **WHEN** a developer copies `.env.example` to `.env` and fills in valid values
- **THEN** the application starts successfully using that configuration
