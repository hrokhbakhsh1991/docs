import { DENALI_CATEGORY_ENUM } from "@repo/denali-domain";
import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from "class-validator";

const ALLOWED = new Set<string>(DENALI_CATEGORY_ENUM);

export function IsDenaliCompatibleCategories(validationOptions?: ValidationOptions) {
  return function decorate(object: object, propertyName: string): void {
    registerDecorator({
      name: "isDenaliCompatibleCategories",
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (value == null) {
            return true;
          }
          if (!Array.isArray(value)) {
            return false;
          }
          return value.every((entry) => typeof entry === "string" && ALLOWED.has(entry.trim()));
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} must be an array of Denali category slugs (${[...DENALI_CATEGORY_ENUM].join(", ")})`;
        },
      },
    });
  };
}
