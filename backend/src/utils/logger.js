function serializeError(error) {
  if (!error) return null;
  return {
    name: error.name || 'Error',
    message: error.message || String(error),
    stack: error.stack || null,
  };
}

export function logStructured(level = 'info', event = 'log', payload = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...payload,
  };

  if (payload?.error instanceof Error) {
    entry.error = serializeError(payload.error);
  }

  const method =
    level === 'error'
      ? console.error
      : level === 'warn'
        ? console.warn
        : console.log;

  method(JSON.stringify(entry));
  return entry;
}

export function logInfo(event, payload = {}) {
  return logStructured('info', event, payload);
}

export function logWarn(event, payload = {}) {
  return logStructured('warn', event, payload);
}

export function logError(event, payload = {}) {
  return logStructured('error', event, payload);
}
