## Purpose

Ensures the backend only starts with a complete, valid runtime configuration, so misconfiguration is caught at startup rather than surfacing as unpredictable failures once the application is serving traffic.

## ADDED Requirements

### Requirement: Required Environment Variables Are Validated At Startup
The system SHALL validate that `PORT`, `NODE_ENV`, `DATABASE_URL`, and `FRONTEND_URL` are present and well-formed before the application begins accepting requests, and SHALL fail to start with a descriptive error when any required variable is missing or invalid.

#### Scenario: Application starts with valid configuration
- **WHEN** the application is started with all required environment variables present and valid
- **THEN** the application starts successfully and begins accepting requests

#### Scenario: Application refuses to start with missing configuration
- **WHEN** the application is started with a required environment variable missing or empty
- **THEN** the application fails to start and logs a descriptive error identifying the missing variable, without exposing secret values

### Requirement: Example Environment File
The repository SHALL provide an `.env.example` file listing every environment variable required to run the application, without real credentials.

#### Scenario: Developer bootstraps local environment
- **WHEN** a developer copies `.env.example` to `.env` and fills in valid values
- **THEN** the application starts successfully using that configuration
