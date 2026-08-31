## MODIFIED Requirements

### Requirement: Swagger Documentation Endpoint
The system SHALL publish interactive API reference documentation at `/api/docs`, rendered with Scalar's API reference UI, reflecting the currently available endpoints and their request/response schemas from the same OpenAPI document generated from the application's controllers and DTOs.

#### Scenario: Documentation is accessible
- **WHEN** a client sends `GET /api/docs`
- **THEN** the system responds with HTTP 200 and renders Scalar's API reference UI listing the API's endpoints

#### Scenario: New endpoint is reflected in documentation
- **WHEN** an endpoint is registered in the application with Swagger metadata
- **THEN** the published documentation at `/api/docs` includes that endpoint's route, request schema, and response schema
