import { runTelegramBackfillCli } from "./run-telegram-backfill";

runTelegramBackfillCli(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
