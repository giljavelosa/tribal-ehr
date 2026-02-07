# FHIR Server Package

This directory contains HAPI FHIR server customization for the Tribal EHR system.

The HAPI FHIR server itself runs from a Docker image (`hapiproject/hapi:latest`). This package contains configuration overlays and custom operations that extend the base server to meet Tribal EHR requirements.

## Contents

- `application.yaml` - HAPI FHIR server configuration overlay. This file is mounted into the Docker container at runtime and overrides the default HAPI settings.

## Architecture

The FHIR server acts as the clinical data persistence layer. All patient health records are stored as FHIR R4 resources in a PostgreSQL database, accessed through the HAPI JPA server. The configuration enables US Core Implementation Guide (v6.1.0) validation, CORS for the frontend, bulk export for population health, and the OpenAPI documentation endpoint.

## Custom Operations

Custom FHIR operations (e.g., `$everything`, `$export`, `$validate`) are configured through the overlay. Additional interceptors and custom search parameters can be registered via the HAPI starter project extension points.

## Running

The FHIR server is started as part of the full stack via `docker-compose up`. It is not intended to be run standalone outside of the Docker environment.
