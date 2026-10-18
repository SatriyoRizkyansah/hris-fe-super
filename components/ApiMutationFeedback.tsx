"use client";

import { useEffect, useState } from "react";
import { AlertCircle, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LoadingCard } from "@/components/loading/LoadingCard";
import { getApiErrorMessage } from "@/lib/api/errors";

type MutationErrorAlert = { id: number; message: string };

export function ApiMutationFeedback() {
  const [pendingRequests, setPendingRequests] = useState(0);
  const [alerts, setAlerts] = useState<MutationErrorAlert[]>([]);

  useEffect(() => {
    const startRequest = () => setPendingRequests((count) => count + 1);
    const endRequest = () => setPendingRequests((count) => Math.max(0, count - 1));
    const showError = (event: Event) => {
      const error = (event as CustomEvent<{ error?: unknown }>).detail?.error;
      const id = Date.now() + Math.random();
      setAlerts((current) => [...current.slice(-2), { id, message: getApiErrorMessage(error) }]);
      window.setTimeout(() => setAlerts((current) => current.filter((alert) => alert.id !== id)), 6000);
    };

    window.addEventListener("api:request-start", startRequest);
    window.addEventListener("api:request-end", endRequest);
    window.addEventListener("api:error", showError);
    return () => {
      window.removeEventListener("api:request-start", startRequest);
      window.removeEventListener("api:request-end", endRequest);
      window.removeEventListener("api:error", showError);
    };
  }, []);

  return (
    <>
      {pendingRequests > 0 && <LoadingCard label="Memproses permintaan…" />}
      <div className="fixed bottom-5 right-5 z-[200] flex w-[min(380px,calc(100vw-2.5rem))] flex-col gap-3" aria-live="assertive" aria-relevant="additions">
        {alerts.map(({ id, message }) => (
          <Alert key={id} variant="destructive" className="relative pr-10 shadow-xl">
            <AlertCircle />
            <AlertTitle>Permintaan gagal</AlertTitle>
            <AlertDescription className="mt-1">{message}</AlertDescription>
            <button type="button" onClick={() => setAlerts((current) => current.filter((alert) => alert.id !== id))} className="absolute right-3 top-3 rounded p-1" aria-label="Tutup notifikasi">
              <X className="size-4" />
            </button>
          </Alert>
        ))}
      </div>
    </>
  );
}
