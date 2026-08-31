## Purpose

Ensures the backend's REST API is discoverable and self-describing through published OpenAPI documentation, so frontend developers and future API consumers can explore available endpoints without reading the source code.

## Requirements

### Requirement: Swagger Documentation Endpoint
The system SHALL publish interactive Swagger/OpenAPI documentation at `/api/docs`, reflecting the currently available endpoints and their request/response schemas.

#### Scenario: Documentation is accessible
- **WHEN** a client sends `GET /api/docs`
- **THEN** the system responds with HTTP 200 and renders the Swagger UI listing the API's endpoints

#### Scenario: New endpoint is reflected in documentation
- **WHEN** an endpoint is registered in the application with Swagger metadata
- **THEN** the published documentation at `/api/docs` includes that endpoint's route, request schema, and response schema
