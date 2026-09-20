/**
 * @app-tour/ticketing-core — pure Ticketing domain (TKT-001 Phase 2).
 *
 * Framework-independent. No persistence, HTTP, Prisma, or workspace imports.
 *
 * Type alignment: `@app-tour/ticketing-http-contracts` mirrors domain literals for
 * transport. Core is the canonical source; http-contracts must not be imported here.
 */

export * from "./domain/index";
export * from "./application/index";
