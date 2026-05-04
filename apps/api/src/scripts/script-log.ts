/** CLI scripts are outside Nest DI; honor LOG_LEVEL like runtime LoggerService (pino). */

export function emitScriptInfo(message: string): void {
  if (!shouldEmitInfo()) {
    return;
  }
  console.log(message);
}

export function emitScriptDebug(message: string): void {
  if (!shouldEmitDebug()) {
    return;
  }
  console.log(message);
}

function shouldEmitInfo(): boolean {
  const level = (process.env.LOG_LEVEL ?? "info").toLowerCase();
  return level === "debug" || level === "info";
}

function shouldEmitDebug(): boolean {
  return (process.env.LOG_LEVEL ?? "info").toLowerCase() === "debug";
}
