## Purpose

Defines how a visitor's external LinkedIn identity maps to a persisted application user: created once on first login, kept up to date on later logins, and never duplicated for the same external identity.

## Requirements

### Requirement: Stable External Identity
The system SHALL identify application users by the stable identifier LinkedIn assigns to the visitor, and SHALL NOT use the visitor's name or LinkedIn profile URL as the primary identity key.

#### Scenario: User is looked up by LinkedIn identifier
- **WHEN** a visitor completes LinkedIn login
- **THEN** the system looks up the application user using the LinkedIn identifier from the validated identity, not their name or profile URL

### Requirement: First-Login User Creation
The system SHALL create a new application user on the first successful login for a given LinkedIn identity, populated with the profile information available from that login.

#### Scenario: New LinkedIn identity creates a user
- **WHEN** a visitor with no existing application user completes LinkedIn login successfully
- **THEN** the system creates a new application user associated with that LinkedIn identity

### Requirement: Existing User Recognition And Update
The system SHALL recognize a returning visitor by their LinkedIn identity and SHALL NOT create a second application user for it. The system MAY update the existing user's non-sensitive profile fields (such as name and avatar) with the latest values from LinkedIn.

#### Scenario: Returning visitor reuses their existing user
- **WHEN** a visitor with an existing application user completes LinkedIn login successfully
- **THEN** the system reuses the existing application user rather than creating a new one

#### Scenario: Profile fields refresh on repeat login
- **WHEN** a returning visitor's LinkedIn name or avatar has changed since their last login
- **THEN** the system updates the corresponding fields on their existing application user

### Requirement: No Duplicate Users For The Same Identity
The system SHALL enforce, at the data layer, that at most one application user exists per LinkedIn identity, even under concurrent first-time logins for the same identity.

#### Scenario: Concurrent first logins do not create duplicates
- **WHEN** two login completions for the same new LinkedIn identity are processed concurrently
- **THEN** the system ends up with exactly one application user for that LinkedIn identity, and the second attempt reuses it rather than failing the visitor's login
