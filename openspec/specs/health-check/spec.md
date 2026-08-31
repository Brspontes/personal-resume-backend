## Purpose

Provides a simple, unauthenticated endpoint that reports whether the backend application is running and able to respond to requests, so operators and monitoring tools can verify availability.

## Requirements

### Requirement: Health Endpoint
The system SHALL expose `GET /api/v1/health` as a public, unauthenticated endpoint that returns a successful response when the application process is running and able to handle requests.

#### Scenario: Application is operational
- **WHEN** a client sends `GET /api/v1/health`
- **THEN** the system responds with HTTP 200 and a JSON body indicating the application status is healthy

### Requirement: Health Endpoint Documentation
The `GET /api/v1/health` endpoint SHALL be documented in the Swagger/OpenAPI specification, including its response schema.

#### Scenario: Endpoint appears in API documentation
- **WHEN** a client requests the Swagger/OpenAPI document
- **THEN** the document includes `GET /api/v1/health` with a description and response schema
