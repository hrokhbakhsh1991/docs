import { runTourPublishedExposureRemapCli } from "./run-tour-published-exposure-remap";

runTourPublishedExposureRemapCli(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
