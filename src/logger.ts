let debugEnabled = false;

export function setDebug(enabled: boolean): void {
  debugEnabled = enabled;
}

export function debug(message: string, ...args: unknown[]): void {
  if (debugEnabled) {
    console.log(`[DEBUG] ${message}`, ...args);
  }
}

export function info(message: string, ...args: unknown[]): void {
  console.log(`[INFO] ${message}`, ...args);
}

export function error(message: string, ...args: unknown[]): void {
  console.error(`[ERROR] ${message}`, ...args);
}
