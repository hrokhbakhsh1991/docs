# API Endpoint Contracts v2

Document-ID: MKT-DOC-API-ENDPOINT-CONTRACTS-V2  
Version: v1.1  
Status: Active  
Owner: Product Documentation Team  
Last-Updated: 2026-04-29  
Language: English  
Canonical-Reference: docs/20-architecture/canonical_framework.md

## Purpose

This document is the entrypoint for API endpoint contracts and is split by delivery status:

- Implemented contract set: `docs/20-architecture/contracts/api_endpoint_contracts_v2_base.md`
- Planned contract set: `docs/20-architecture/contracts/api_endpoint_contracts_v2_future.md`

## Global Conventions

- Base path: `/api/v2`
- Content type: `application/json` (except CSV export endpoint).
- Error contract: MUST follow `docs/20-architecture/contracts/error_response_taxonomy_v2.md`.
- Success responses are returned as raw payload objects, not wrapped in a `data` envelope.
- Unknown fields: MUST be strictly rejected at top-level payload.
