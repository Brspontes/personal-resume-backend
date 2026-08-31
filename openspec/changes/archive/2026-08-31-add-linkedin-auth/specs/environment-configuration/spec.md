## MODIFIED Requirements

### Requirement: Required Environment Variables Are Validated At Startup
The system SHALL validate that `PORT`, `NODE_ENV`, `DATABASE_URL`, `FRONTEND_URL`, `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_CALLBACK_URL`, and `AUTH_JWT_SECRET` are present and well-formed before the application begins accepting requests, and SHALL fail to start with a descriptive error when any required variable is missing or invalid.

#### Scenario: Application starts with valid configuration
- **WHEN** the application is started with all required environment variables present and valid
- **THEN** the application starts successfully and begins accepting requests

#### Scenario: Application refuses to start with missing configuration
- **WHEN** the application is started with a required environment variable missing or empty
- **THEN** the application fails to start and logs a descriptive error identifying the missing variable, without exposing secret values

#### Scenario: Application refuses to start with a weak session secret
- **WHEN** the application is started with `AUTH_JWT_SECRET` shorter than the minimum required length
- **THEN** the application fails to start and logs a descriptive error, without exposing the configured value
