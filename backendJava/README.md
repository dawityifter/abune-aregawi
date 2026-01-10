# Abune Aregawi Church Backend - Java Version

This is a Spring Boot 4.0.1 / Java 25 port of the Node.js backend.

## Project Structure
- `src/main/java`: Core logic (Entities, Repositories, Services, Controllers)
- `src/main/resources`: Configuration (`application.properties`)

## Key Version Info
- **Spring Boot**: 4.0.1
- **Spring Framework**: 7.0.2
- **Java**: 25 (Preview/Future)
- **Gradle**: 8.x recommended

## Getting Started
To run this project, you will need Java 25 installed. If you don't have Gradle installed globally, you can initialize the Gradle Wrapper:

```bash
# From this directory
gradle init --type java-application
```

Note: Since global `gradle` was not found in your environment, you may need to install it first via Homebrew:
```bash
brew install gradle
```

## Configuration
Database and API keys are managed via `application.properties`. It is configured to look for environment variables (like `DATABASE_URL`) to stay compatible with the Node.js setup.

## Current Progress
- [x] Initial Project Structure
- [x] Core Configuration (Spring Web, Security, JPA)
- [x] Basic Security Setup
- [x] Member Model & Repository
- [x] Health Check Endpoints
