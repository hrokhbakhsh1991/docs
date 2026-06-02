import assert from "node:assert/strict";
import test from "node:test";
import { MethodNotAllowedException } from "@nestjs/common";
import { UsersController } from "../../../src/modules/identity/users.controller";

function makeController(): UsersController {
  return new UsersController({} as never, {} as never, {} as never, {} as never);
}

test("POST /api/v2/users is explicitly unsupported", () => {
  const controller = makeController();
  assert.throws(
    () => controller.createUserUnsupported(),
    (error: unknown) => {
      assert.ok(error instanceof MethodNotAllowedException);
      const response = error.getResponse() as { error?: { code?: string } };
      assert.equal(response.error?.code, "USER_CREATE_UNSUPPORTED");
      return true;
    }
  );
});

test("DELETE /api/v2/users/:id is explicitly unsupported", () => {
  const controller = makeController();
  assert.throws(
    () => controller.deleteUserUnsupported(),
    (error: unknown) => {
      assert.ok(error instanceof MethodNotAllowedException);
      const response = error.getResponse() as { error?: { code?: string } };
      assert.equal(response.error?.code, "USER_DELETE_UNSUPPORTED");
      return true;
    }
  );
});
