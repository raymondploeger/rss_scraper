const runtimeState = {
  databaseConnected: false,
  migrationsApplied: false,
  schedulerStarted: false,
  lastBootstrapError: null
};

export function markDatabaseConnected(value = true) {
  runtimeState.databaseConnected = value;
}

export function markMigrationsApplied(value = true) {
  runtimeState.migrationsApplied = value;
}

export function markSchedulerStarted(value = true) {
  runtimeState.schedulerStarted = value;
}

export function setBootstrapError(error) {
  runtimeState.lastBootstrapError = error ? String(error.message || error) : null;
}

export function getRuntimeState() {
  return { ...runtimeState };
}

export function isRuntimeReady() {
  return runtimeState.databaseConnected && runtimeState.migrationsApplied;
}
