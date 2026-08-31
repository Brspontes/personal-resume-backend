## Purpose

Lets a visitor authenticate using their LinkedIn account: initiating the OpenID Connect flow, handling LinkedIn's callback, and validating the returned identity before an application session is established.

## ADDED Requirements

### Requirement: Login Initiation
The system SHALL expose `GET /api/v1/auth/linkedin` as a public endpoint that redirects the browser to LinkedIn's OpenID Connect authorization endpoint, requesting only the scopes necessary to identify the user (name, avatar, and a stable identifier). The endpoint SHALL accept an optional `returnTo` query parameter naming the page the visitor should return to after login.

#### Scenario: Visitor starts LinkedIn login
- **WHEN** a client sends `GET /api/v1/auth/linkedin`
- **THEN** the system responds with a redirect to LinkedIn's authorization endpoint, including the application's client identifier and callback URL

#### Scenario: Visitor starts LinkedIn login from a specific page
- **WHEN** a client sends `GET /api/v1/auth/linkedin?returnTo=/articles/some-slug`
- **THEN** the system remembers `/articles/some-slug` for use once login completes, without exposing it to LinkedIn

#### Scenario: An unsafe returnTo value is ignored
- **WHEN** a client sends `GET /api/v1/auth/linkedin?returnTo=` with a value that is not a same-site relative path (for example an absolute URL or a protocol-relative `//host` value)
- **THEN** the system discards the value and proceeds as if no `returnTo` had been provided

### Requirement: Callback Handling
The system SHALL expose `GET /api/v1/auth/linkedin/callback` as a public endpoint that completes the OpenID Connect flow: it SHALL exchange the authorization code for LinkedIn identity information, and SHALL NOT establish an application session if that exchange fails or the returned identity cannot be validated.

#### Scenario: Successful callback establishes identity
- **WHEN** LinkedIn redirects back to `GET /api/v1/auth/linkedin/callback` with a valid authorization code
- **THEN** the system exchanges the code for the visitor's LinkedIn identity and proceeds to establish an application session for that identity

#### Scenario: LinkedIn reports an authorization error
- **WHEN** LinkedIn redirects back to `GET /api/v1/auth/linkedin/callback` with an error instead of an authorization code
- **THEN** the system does not establish an application session and responds with an error the frontend can distinguish from a successful login

#### Scenario: Code exchange or identity validation fails
- **WHEN** the authorization code cannot be exchanged for a valid LinkedIn identity (invalid code, LinkedIn API failure, or malformed identity response)
- **THEN** the system does not establish an application session and returns an appropriate error response without exposing LinkedIn API internals

### Requirement: Post-Login Redirect
On a successful callback, the system SHALL redirect the browser back to the configured frontend origin (`FRONTEND_URL`), appending the `returnTo` page remembered from login initiation when one was provided and safe to use. The system SHALL NOT redirect to any destination outside the configured frontend origin.

#### Scenario: Browser returns to the frontend after login
- **WHEN** the callback completes successfully, the application session has been established, and no `returnTo` was remembered
- **THEN** the system redirects the browser to the configured `FRONTEND_URL`

#### Scenario: Browser returns to the originating page after login
- **WHEN** the callback completes successfully and a safe `returnTo` of `/articles/some-slug` was remembered from login initiation
- **THEN** the system redirects the browser to `/articles/some-slug` under the configured `FRONTEND_URL`
