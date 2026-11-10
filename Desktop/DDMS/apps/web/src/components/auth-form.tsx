"use client";

import { Turnstile } from "@marsidev/react-turnstile";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

type AuthFormProps = {
  mode: "login" | "register" | "resend";
};

const apiBaseUrl = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api"
).replace(/\/$/, "");
const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

function getErrorMessage(payload: unknown): string | null {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("message" in payload)
  ) {
    return null;
  }

  const message = payload.message;
  if (typeof message === "string") {
    return message;
  }
  if (
    Array.isArray(message) &&
    message.every((item) => typeof item === "string")
  ) {
    return message.join(" ");
  }
  return null;
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const isRegister = mode === "register";
  const isResend = mode === "resend";
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaEpoch, setCaptchaEpoch] = useState(0);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!turnstileSiteKey) {
      setErrorMessage("Cloudflare Turnstile is not configured for this app.");
      return;
    }
    if (!captchaToken) {
      setErrorMessage("Complete the CAPTCHA before continuing.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const body = isRegister
      ? {
          fullName: String(formData.get("fullName") ?? ""),
          email: String(formData.get("email") ?? ""),
          password: String(formData.get("password") ?? ""),
          confirmPassword: String(formData.get("confirmPassword") ?? ""),
          turnstileToken: captchaToken,
        }
      : isResend
        ? {
            email: String(formData.get("email") ?? ""),
            turnstileToken: captchaToken,
          }
        : {
            email: String(formData.get("email") ?? ""),
            password: String(formData.get("password") ?? ""),
            turnstileToken: captchaToken,
          };

    setBusy(true);
    try {
      const response = await fetch(
        `${apiBaseUrl}/auth/${isRegister ? "register" : isResend ? "resend-verification" : "login"}`,
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const payload: unknown = await response.json();

      if (!response.ok) {
        setErrorMessage(
          getErrorMessage(payload) ?? "The request could not be completed.",
        );
        return;
      }

      if (isRegister) {
        setSuccessMessage(
          "Registration received. Check your email for a verification link.",
        );
      } else if (isResend) {
        setSuccessMessage(
          "If the account is pending verification, an email will be sent.",
        );
      } else {
        const userName =
          typeof payload === "object" &&
          payload !== null &&
          "user" in payload &&
          typeof payload.user === "object" &&
          payload.user !== null
            ? "fullName" in payload.user &&
              typeof payload.user.fullName === "string"
              ? payload.user.fullName
              : null
            : null;
        setSuccessMessage(userName ? `Welcome, ${userName}.` : "Signed in.");
        router.push("/dashboard");
      }
    } catch {
      setErrorMessage("Unable to reach the DDMS API. Please try again.");
    } finally {
      setBusy(false);
      setCaptchaToken("");
      setCaptchaEpoch((value) => value + 1);
    }
  }

  return (
    <section className="w-full max-w-md rounded-2xl border border-[#e0e7e2] bg-white p-6 shadow-[0_12px_36px_-28px_rgba(23,33,29,0.35)] sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#47715c]">
        {isRegister
          ? "Create an account"
          : isResend
            ? "Email verification"
            : "Member access"}
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">
        {isRegister
          ? "Register for DDMS"
          : isResend
            ? "Resend verification"
            : "Sign in to DDMS"}
      </h1>
      <p className="mt-2 text-sm leading-6 text-[#68756e]">
        {isRegister
          ? "Use your verified Gmail address. New accounts start with Viewer access."
          : isResend
            ? "Enter the email address used during registration."
            : "Sign in with your verified account credentials."}
      </p>

      <form className="mt-7 space-y-5" onSubmit={submit}>
        {isRegister && (
          <label className="block space-y-2 text-sm font-medium">
            <span>Full name</span>
            <input
              autoComplete="name"
              className="w-full rounded-lg border border-[#dce4de] px-3 py-2.5 font-normal outline-none transition focus:border-[#47715c] focus:ring-2 focus:ring-[#47715c]/15"
              maxLength={160}
              name="fullName"
              required
            />
          </label>
        )}

        <label className="block space-y-2 text-sm font-medium">
          <span>Email address</span>
          <input
            autoComplete="email"
            className="w-full rounded-lg border border-[#dce4de] px-3 py-2.5 font-normal outline-none transition focus:border-[#47715c] focus:ring-2 focus:ring-[#47715c]/15"
            name="email"
            required
            type="email"
          />
        </label>

        {!isResend && (
          <label className="block space-y-2 text-sm font-medium">
            <span>Password</span>
            <input
              autoComplete={isRegister ? "new-password" : "current-password"}
              className="w-full rounded-lg border border-[#dce4de] px-3 py-2.5 font-normal outline-none transition focus:border-[#47715c] focus:ring-2 focus:ring-[#47715c]/15"
              minLength={isRegister ? 12 : undefined}
              name="password"
              required
              type="password"
            />
            {isRegister && (
              <span className="block text-xs font-normal text-[#758078]">
                Use 12 to 128 characters.
              </span>
            )}
          </label>
        )}

        {isRegister && (
          <label className="block space-y-2 text-sm font-medium">
            <span>Confirm password</span>
            <input
              autoComplete="new-password"
              className="w-full rounded-lg border border-[#dce4de] px-3 py-2.5 font-normal outline-none transition focus:border-[#47715c] focus:ring-2 focus:ring-[#47715c]/15"
              minLength={12}
              name="confirmPassword"
              required
              type="password"
            />
          </label>
        )}

        {turnstileSiteKey ? (
          <div className="min-h-16">
            <Turnstile
              key={captchaEpoch}
              siteKey={turnstileSiteKey}
              onError={() => setCaptchaToken("")}
              onExpire={() => setCaptchaToken("")}
              onSuccess={setCaptchaToken}
            />
          </div>
        ) : (
          <p className="rounded-lg bg-[#fbf6ed] px-3 py-2 text-sm text-[#8a5a32]">
            CAPTCHA is unavailable until a Turnstile site key is configured.
          </p>
        )}

        {errorMessage && (
          <p className="text-sm text-[#a13c32]" role="alert">
            {errorMessage}
          </p>
        )}
        {successMessage && (
          <p className="text-sm text-[#315d49]" role="status">
            {successMessage}
          </p>
        )}

        <button
          className="w-full rounded-lg bg-[#164a3a] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#103b2e] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={busy || !turnstileSiteKey}
          type="submit"
        >
          {busy
            ? "Please wait…"
            : isRegister
              ? "Create account"
              : isResend
                ? "Send verification email"
                : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-sm text-[#68756e]">
        {isRegister
          ? "Already registered?"
          : isResend
            ? "Ready to sign in?"
            : "New to DDMS?"}{" "}
        <Link
          className="font-semibold text-[#315d49] underline-offset-4 hover:underline"
          href={isRegister || isResend ? "/login" : "/register"}
        >
          {isRegister || isResend ? "Sign in" : "Create an account"}
        </Link>
      </p>
      {!isResend && (
        <Link
          className="mt-3 inline-block text-sm font-medium text-[#315d49] underline-offset-4 hover:underline"
          href="/resend-verification"
        >
          Need a new verification email?
        </Link>
      )}
    </section>
  );
}
