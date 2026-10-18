import { Api } from "./generated/api-generated";

const notifyingFetch: typeof fetch = async (input, init) => {
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  let response: Response;
  if (isMutation && typeof window !== "undefined") window.dispatchEvent(new Event("api:request-start"));
  try {
    response = await fetch(input, init);
  } catch (error) {
    if (isMutation && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("api:error", { detail: { error } }));
    }
    throw error;
  } finally {
    if (isMutation && typeof window !== "undefined") window.dispatchEvent(new Event("api:request-end"));
  }

  if (!response.ok && isMutation && typeof window !== "undefined") {
    const payload = await response
      .clone()
      .json()
      .catch(() => null);
    const error = Object.assign(new Error(typeof payload?.message === "string" ? payload.message : response.statusText || "Permintaan gagal diproses."), {
      status: response.status,
      message: typeof payload?.message === "string" ? payload.message : response.statusText || "Permintaan gagal diproses.",
    });
    window.dispatchEvent(new CustomEvent("api:error", { detail: { error } }));
  }

  if (response.ok && isMutation) {
    const payload = await response
      .clone()
      .json()
      .catch(() => null);
    const message = payload && typeof payload.message === "string" ? payload.message.trim() : "";
    if (message && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("api:success", { detail: { message } }));
    }
  }

  return response;
};

/** Browser API client. Set NEXT_PUBLIC_API_BASE_URL before enabling API calls. */
export const browserApi = new Api<string>({
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "",
  customFetch: notifyingFetch,
  securityWorker: (securityData) => (securityData ? { headers: { Authorization: `Bearer ${securityData}` } } : {}),
});
