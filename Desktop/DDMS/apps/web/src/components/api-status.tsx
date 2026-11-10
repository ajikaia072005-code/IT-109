"use client";

import { useEffect, useState } from "react";

type ApiHealth = {
  status: string;
  service: string;
};

type ApiStatusState =
  | { kind: "checking" }
  | { kind: "available"; health: ApiHealth }
  | { kind: "unavailable" };

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api";

export function ApiStatus() {
  const [state, setState] = useState<ApiStatusState>({ kind: "checking" });

  useEffect(() => {
    const controller = new AbortController();

    async function checkApi() {
      try {
        const response = await fetch(`${apiBaseUrl}/health`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          setState({ kind: "unavailable" });
          return;
        }

        const health: ApiHealth = await response.json();
        setState({ kind: "available", health });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setState({ kind: "unavailable" });
      }
    }

    void checkApi();
    return () => controller.abort();
  }, []);

  if (state.kind === "checking") {
    return (
      <p className="mt-5 text-sm text-[#68756e]" role="status">
        Checking API connectivity…
      </p>
    );
  }

  if (state.kind === "unavailable") {
    return (
      <p className="mt-5 flex items-center gap-2 text-sm text-[#8a5a32]" role="status">
        <span className="size-2 rounded-full bg-[#c88846]" aria-hidden="true" />
        API not reachable. Start the backend to verify connectivity.
      </p>
    );
  }

  return (
    <p className="mt-5 flex items-center gap-2 text-sm text-[#315d49]" role="status">
      <span className="size-2 rounded-full bg-[#4b8b65]" aria-hidden="true" />
      {state.health.service} is {state.health.status}.
    </p>
  );
}
