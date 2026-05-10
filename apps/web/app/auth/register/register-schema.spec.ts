import assert from "node:assert/strict";
import test from "node:test";
import { buildRegisterFormSchema } from "./register-schema";

const t = (key: string): string => key;

test("register schema accepts empty optional email", () => {
  const s = buildRegisterFormSchema(t);
  const r = s.safeParse({ name: "Alice", email: "" });
  assert.equal(r.success, true);
});

test("register schema rejects invalid email when non-empty", () => {
  const s = buildRegisterFormSchema(t);
  const r = s.safeParse({ name: "Alice", email: "not-an-email" });
  assert.equal(r.success, false);
});

test("register schema accepts valid email", () => {
  const s = buildRegisterFormSchema(t);
  const r = s.safeParse({ name: "Alice", email: "a@b.co" });
  assert.equal(r.success, true);
});
