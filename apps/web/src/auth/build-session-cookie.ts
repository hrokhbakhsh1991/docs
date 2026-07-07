import { createSessionCookieHelpers, SESSION_COOKIE_NAMES } from "@app-tour/session-client";

export const SESSION_TOKEN_COOKIE = SESSION_COOKIE_NAMES.operator;

const helpers = createSessionCookieHelpers(SESSION_COOKIE_NAMES.operator);

export const SESSION_COOKIE_MAX_AGE_SECONDS = helpers.SESSION_COOKIE_MAX_AGE_SECONDS;
export const resolveSessionCookieSecure = helpers.resolveSessionCookieSecure;
export const buildSessionCookieOptions = helpers.buildSessionCookieOptions;
export const setSessionCookieOnResponse = helpers.setSessionCookieOnResponse;
export const clearSessionCookieOnResponse = helpers.clearSessionCookieOnResponse;
