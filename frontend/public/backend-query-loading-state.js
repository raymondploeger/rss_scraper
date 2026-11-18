export function shouldStartBackendQuery({ loading = false, loadingKey = "", queryKey = "" } = {}) {
  return !loading || String(loadingKey || "") !== String(queryKey || "");
}
