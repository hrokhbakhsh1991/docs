import { expect, test } from "@playwright/test";

import { resetOperatorWizardToBasic } from "../../test/fixtures/denali-itinerary-wizard-fixture";
import { loginOperatorOwner } from "../../test/fixtures/operator-owner-session";

test("local synthetic operator can quick-add a destination without losing the tour name", async ({
  page,
  baseURL,
}) => {
  test.skip(
    !baseURL || !/^(localhost|127\.0\.0\.1|.+\.localhost)$/.test(new URL(baseURL).hostname),
    "Requires a local synthetic operator fixture; never run against staging or production"
  );

  const region = {
    id: "25aca03a-a3fc-41a5-9def-3f8190650e04",
    name: "Quick add test region",
    country: null,
    isActive: true,
    sortOrder: 0,
  };
  const destination = {
    id: "13f855df-7347-4a4b-81b6-92625ae9aa88",
    regionId: region.id,
    name: "Quick add test destination",
    locationType: "generic",
    altitudeM: null,
    typicalTrailDistanceKm: null,
    isActive: true,
    sortOrder: 0,
  };
  let writes = 0;

  await loginOperatorOwner(page);
  await page.route("**/api/settings/resources/locations", async (route) => {
    if (route.request().method() === "POST") {
      writes += 1;
      expect(route.request().postDataJSON()).toEqual({
        entity: "destination",
        regionId: region.id,
        name: destination.name,
        locationType: "generic",
      });
      await route.fulfill({ status: 201, json: destination });
      return;
    }
    await route.fulfill({
      json: { regions: [region], destinations: writes ? [destination] : [], total: 1 + writes },
    });
  });
  await resetOperatorWizardToBasic(page);
  const tourName = page.getByRole("textbox", { name: /نام تور|title/i }).first();
  await tourName.fill("Draft title must remain");

  const trigger = page.getByRole("button", { name: /افزودن مقصد|Add destination/i });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: /افزودن مقصد|Add destination/i });
  const name = dialog.getByRole("textbox", { name: /نام|Name/i });
  await expect(name).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  expect(writes).toBe(0);

  await trigger.click();
  await name.fill(destination.name);
  await dialog.getByRole("combobox", { name: /منطقه|Region/i }).selectOption(region.id);
  await dialog.getByRole("button", { name: /ذخیره و انتخاب|Save and select/i }).click();
  await expect(dialog).toBeHidden();
  await expect(tourName).toHaveValue("Draft title must remain");
  await expect(page.getByText(destination.name, { exact: false }).first()).toBeVisible();
  expect(writes).toBe(1);
});
