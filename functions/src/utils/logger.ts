export function logInfo(message: string, payload?: unknown) {
  if (payload === undefined) {
    console.log(message);
    return;
  }

  console.log(message, payload);
}

export function logError(message: string, error: unknown) {
  console.error(message, error);
}

