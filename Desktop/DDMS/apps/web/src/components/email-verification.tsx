"use client";

import Link from "next/link";
import { useState } from "react";

const apiBaseUrl = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api"
).replace(/\/$/, "");

export function EmailVerification() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function verifyEmail() {
    setBusy(true);
    setMessage("");
    setIsError(false);

    const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
    if (!token) {
      setMessage("This verification link is missing its token.");
      setIsError(true);
      setBusy(false);
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/auth/verify-email`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      await response.json();

      if (!response.ok) {
        setMessage("This verification link is invalid or has expired.");
        setIsError(true);
        return;
      }
      setMessage("Your email is verified. You can now sign in.");
      window.history.replaceState(null, "", window.location.pathname);
    } catch {
      setMessage("Unable to reach the DDMS API. Please try again.");
      setIsError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="w-full max-w-md rounded-2xl border border-[#e0e7e2] bg-white p-6 shadow-[0_12px_36px_-28px_rgba(23,33,29,0.35)] sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#47715c]">
        Account verification
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">
        Verify your email
      </h1>
      <p className="mt-2 text-sm leading-6 text-[#68756e]">
        Confirm the address used for your DDMS account.
      </p>
      <button
        className="mt-7 w-full rounded-lg bg-[#164a3a] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#103b2e] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={busy || Boolean(message && !isError)}
        onClick={verifyEmail}
        type="button"
      >
        {busy ? "Verifying…" : "Verify email address"}
      </button>
      {message && (
        <p
          className={`mt-4 text-sm ${isError ? "text-[#a13c32]" : "text-[#315d49]"}`}
          role={isError ? "alert" : "status"}
        >
          {message}
        </p>
      )}
      <p className="mt-6 text-sm text-[#68756e]">
        <Link
          className="font-semibold text-[#315d49] underline-offset-4 hover:underline"
          href="/login"
        >
          Return to sign in
        </Link>
      </p>
    </section>
  );
}
