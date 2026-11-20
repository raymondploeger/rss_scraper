export function shouldStartBackendQuery({ loading = false, loadingKey = "", failedKey = "", queryKey = "" } = {}) {
  if (String(failedKey || "") === String(queryKey || "")) {
    return false;
  }
  return !loading || String(loadingKey || "") !== String(queryKey || "");
}
