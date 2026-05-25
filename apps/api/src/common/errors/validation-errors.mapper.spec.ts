import assert from "node:assert/strict";
import test from "node:test";
import { mapValidationPipeErrors } from "./validation-errors.mapper";

test("mapValidationPipeErrors maps string messages with inferred path and code", () => {
  const result = mapValidationPipeErrors({
    message: ["phone must be a valid phone number", "otp should not be empty"],
  });

  assert.equal(result.length, 2);
  assert.deepEqual(result[0], {
    path: "phone",
    code: "VALIDATION_FIELD_FORMAT_INVALID",
    message: "phone must be a valid phone number",
  });
  assert.deepEqual(result[1], {
    path: "otp",
    code: "VALIDATION_REQUIRED_FIELD_MISSING",
    message: "otp should not be empty",
  });
});

test("mapValidationPipeErrors maps forbidNonWhitelisted property messages", () => {
  const result = mapValidationPipeErrors({
    message: ["property unknownField should not exist"],
  });

  assert.equal(result.length, 1);
  assert.equal(result[0]?.path, "unknownField");
  assert.equal(result[0]?.code, "VALIDATION_UNKNOWN_FIELD");
});

test("mapValidationPipeErrors flattens nested class-validator errors", () => {
  const result = mapValidationPipeErrors({
    message: [
      {
        property: "tripDetails",
        children: [
          {
            property: "overview",
            children: [
              {
                property: "title",
                constraints: {
                  isNotEmpty: "title should not be empty",
                },
              },
            ],
          },
        ],
      },
    ],
  });

  assert.equal(result.length, 1);
  assert.equal(result[0]?.path, "tripDetails.overview.title");
  assert.equal(result[0]?.code, "VALIDATION_REQUIRED_FIELD_MISSING");
  assert.equal(result[0]?.message, "title should not be empty");
});
