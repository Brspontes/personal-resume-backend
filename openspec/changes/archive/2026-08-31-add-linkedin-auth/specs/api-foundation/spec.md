## MODIFIED Requirements

### Requirement: Cross-Origin Access Control
The system SHALL restrict cross-origin requests to the origin configured via the `FRONTEND_URL` environment variable, and SHALL NOT allow unrestricted wildcard origins in production. The system SHALL support credentialed cross-origin requests (cookies) from that configured origin, since authenticated sessions are carried via cookie.

#### Scenario: Configured frontend origin is allowed
- **WHEN** a browser sends a cross-origin request from the origin configured in `FRONTEND_URL`
- **THEN** the system includes CORS headers permitting that origin

#### Scenario: Unconfigured origin is rejected
- **WHEN** a browser sends a cross-origin request from an origin other than the one configured in `FRONTEND_URL`
- **THEN** the system does not include CORS headers permitting that origin

#### Scenario: Credentialed request from the configured origin is allowed
- **WHEN** a browser sends a cross-origin request with credentials (cookies) included from the origin configured in `FRONTEND_URL`
- **THEN** the system includes CORS headers that permit the browser to expose the response to that credentialed request
