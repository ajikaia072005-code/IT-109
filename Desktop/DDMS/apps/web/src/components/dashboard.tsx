"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";

const apiBaseUrl = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api"
).replace(/\/$/, "");

const requestableRoles = [
  ["DEPARTMENT_HEAD", "Department Head"],
  ["FACULTY", "Faculty"],
  ["STAFF", "Staff"],
  ["ORGANIZATION", "Organization"],
  ["SYSTEM_ADMIN", "System Admin"],
] as const;

type User = {
  id: string;
  fullName: string;
  email: string;
  role: string;
};

type Application = {
  id: string;
  requestedRole: string;
  reason: string;
  status: string;
  submittedAt: string;
  reviewedAt: string | null;
};

type PendingApplication = Application & {
  applicant: { id: string; fullName: string; email: string };
};

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

type DashboardData = {
  user: User;
  applications: Application[];
  pendingApplications: PendingApplication[];
  notifications: NotificationItem[];
};

function messageFrom(payload: unknown): string {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "message" in payload &&
    typeof payload.message === "string"
  ) {
    return payload.message;
  }
  return "The request could not be completed.";
}

function roleLabel(role: string): string {
  return role.replaceAll("_", " ");
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

async function requestApi(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
}

export function Dashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const refresh = useCallback(async () => {
    try {
      const userResponse = await requestApi("/auth/me");
      if (userResponse.status === 401) {
        router.replace("/login");
        return;
      }
      if (!userResponse.ok) {
        throw new Error("Unable to load your account.");
      }

      setErrorMessage("");
      const user = (await userResponse.json()) as User;
      const [applicationsResponse, notificationsResponse, pendingResponse] =
        await Promise.all([
          requestApi("/role-applications"),
          requestApi("/notifications?limit=20"),
          user.role === "SYSTEM_ADMIN"
            ? requestApi("/role-applications/pending")
            : Promise.resolve(null),
        ]);

      const responses = [
        applicationsResponse,
        notificationsResponse,
        pendingResponse,
      ].filter((response): response is Response => response !== null);
      if (responses.some((response) => response.status === 401)) {
        router.replace("/login");
        return;
      }
      if (responses.some((response) => !response.ok)) {
        throw new Error("Unable to load role applications or notifications.");
      }

      const applications =
        applicationsResponse.ok === true
          ? ((await applicationsResponse.json()) as Application[])
          : [];
      const notifications =
        notificationsResponse.ok === true
          ? ((await notificationsResponse.json()) as NotificationItem[])
          : [];
      const pendingApplications =
        pendingResponse?.ok === true
          ? ((await pendingResponse.json()) as PendingApplication[])
          : [];

      setData({ user, applications, pendingApplications, notifications });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load your dashboard.",
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  async function submitApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setBusy(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const response = await requestApi("/role-applications", {
        method: "POST",
        body: JSON.stringify({
          requestedRole: formData.get("requestedRole"),
          reason: formData.get("reason"),
        }),
      });
      if (!response.ok) {
        throw new Error(messageFrom(await response.json()));
      }
      setSuccessMessage("Your role application was submitted.");
      form.reset();
      await refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to submit application.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function reviewApplication(
    applicationId: string,
    decision: "approve" | "reject",
  ) {
    setBusy(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const response = await requestApi(
        `/role-applications/${encodeURIComponent(applicationId)}/${decision}`,
        { method: "POST" },
      );
      if (!response.ok) {
        throw new Error(messageFrom(await response.json()));
      }
      setSuccessMessage(`Role application ${decision}d.`);
      await refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to review application.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function markNotificationRead(notificationId: string) {
    try {
      const response = await requestApi(
        `/notifications/${encodeURIComponent(notificationId)}/read`,
        { method: "PATCH" },
      );
      if (!response.ok) {
        throw new Error(messageFrom(await response.json()));
      }
      await refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to update notification.",
      );
    }
  }

  async function logout() {
    setBusy(true);
    try {
      const response = await requestApi("/auth/logout", { method: "POST" });
      if (!response.ok) {
        throw new Error("Unable to sign out. Please try again.");
      }
      router.replace("/login");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to sign out.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f7f8f6] p-6">
        <p className="text-sm text-[#68756e]" role="status">
          Loading your dashboard…
        </p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f7f8f6] p-6">
        <section className="max-w-md rounded-xl border border-[#e0e7e2] bg-white p-6">
          <h1 className="text-xl font-semibold">Dashboard unavailable</h1>
          <p className="mt-3 text-sm text-[#68756e]" role="alert">
            {errorMessage || "Unable to load your account."}
          </p>
          <button
            className="mt-5 rounded-lg bg-[#164a3a] px-4 py-2 text-sm font-semibold text-white"
            onClick={() => void refresh()}
            type="button"
          >
            Try again
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8f6] text-[#17211d]">
      <header className="border-b border-[#e3e8e4] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
          <Link
            className="text-sm font-bold tracking-wide text-[#164a3a]"
            href="/"
          >
            DDMS
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden text-right sm:block">
              <span className="block text-sm font-medium">
                {data.user.fullName}
              </span>
              <span className="block text-xs text-[#68756e]">
                {roleLabel(data.user.role)}
              </span>
            </span>
            <button
              className="rounded-lg border border-[#dce4de] px-3 py-2 text-sm font-medium hover:bg-[#f7f8f6] disabled:opacity-60"
              disabled={busy}
              onClick={logout}
              type="button"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {data.user.role !== "VIEWER_STUDENT" && data.applications.length > 0 && (
        <section className="mx-auto mt-8 max-w-7xl px-6 lg:px-10">
          <div className="rounded-2xl border border-[#e0e7e2] bg-white p-6 sm:p-8">
            <h2 className="text-xl font-semibold">Your role applications</h2>
            <ul className="mt-4 divide-y divide-[#edf0ed]">
              {data.applications.map((application) => (
                <li
                  className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0"
                  key={application.id}
                >
                  <span className="text-sm font-medium">
                    {roleLabel(application.requestedRole)}
                  </span>
                  <span className="rounded-full bg-[#f3f6f3] px-2.5 py-1 text-xs text-[#53665a]">
                    {application.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#47715c]">
            DDMS workspace
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Welcome, {data.user.fullName}
          </h1>
          <p className="mt-2 text-sm text-[#68756e]">
            Signed in as {data.user.email}
          </p>
        </div>

        {(errorMessage || successMessage) && (
          <p
            className={`mt-6 rounded-lg px-4 py-3 text-sm ${errorMessage ? "bg-[#fdf2f0] text-[#a13c32]" : "bg-[#edf6ef] text-[#315d49]"}`}
            role={errorMessage ? "alert" : "status"}
          >
            {errorMessage || successMessage}
          </p>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          {data.user.role === "VIEWER_STUDENT" && (
            <section className="rounded-2xl border border-[#e0e7e2] bg-white p-6 sm:p-8">
              <h2 className="text-xl font-semibold">Apply for a role</h2>
              <p className="mt-2 text-sm leading-6 text-[#68756e]">
                Applications are reviewed by a System Admin. An approved
                application replaces your current Viewer role.
              </p>
              <form className="mt-6 space-y-5" onSubmit={submitApplication}>
                <label className="block space-y-2 text-sm font-medium">
                  <span>Requested role</span>
                  <select
                    className="w-full rounded-lg border border-[#dce4de] bg-white px-3 py-2.5 font-normal"
                    name="requestedRole"
                    required
                  >
                    {requestableRoles.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-2 text-sm font-medium">
                  <span>Reason</span>
                  <textarea
                    className="min-h-28 w-full rounded-lg border border-[#dce4de] px-3 py-2.5 font-normal"
                    maxLength={5000}
                    name="reason"
                    required
                  />
                </label>
                <button
                  className="rounded-lg bg-[#164a3a] px-5 py-3 text-sm font-semibold text-white hover:bg-[#103b2e] disabled:opacity-60"
                  disabled={busy}
                  type="submit"
                >
                  Submit application
                </button>
              </form>

              <div className="mt-8 border-t border-[#edf0ed] pt-6">
                <h3 className="font-semibold">Your applications</h3>
                {data.applications.length === 0 ? (
                  <p className="mt-3 text-sm text-[#68756e]">
                    You have not submitted a role application.
                  </p>
                ) : (
                  <ul className="mt-4 divide-y divide-[#edf0ed]">
                    {data.applications.map((application) => (
                      <li className="py-4 first:pt-0" key={application.id}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-medium">
                            {roleLabel(application.requestedRole)}
                          </span>
                          <span className="rounded-full bg-[#f3f6f3] px-2.5 py-1 text-xs text-[#53665a]">
                            {application.status}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-[#758078]">
                          Submitted {formatDate(application.submittedAt)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          )}

          {data.user.role === "SYSTEM_ADMIN" && (
            <section className="rounded-2xl border border-[#e0e7e2] bg-white p-6 sm:p-8">
              <h2 className="text-xl font-semibold">
                Pending role applications
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#68756e]">
                Review requests and make one decision per application.
              </p>
              {data.pendingApplications.length === 0 ? (
                <p className="mt-5 text-sm text-[#68756e]">
                  No applications are awaiting review.
                </p>
              ) : (
                <ul className="mt-5 divide-y divide-[#edf0ed]">
                  {data.pendingApplications.map((application) => (
                    <li className="py-5 first:pt-0" key={application.id}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold">
                            {roleLabel(application.requestedRole)}
                          </h3>
                          <p className="mt-1 text-sm text-[#68756e]">
                            {application.applicant.fullName} ·{" "}
                            {application.applicant.email}
                          </p>
                        </div>
                        <span className="text-xs text-[#758078]">
                          {formatDate(application.submittedAt)}
                        </span>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#59675f]">
                        {application.reason}
                      </p>
                      <div className="mt-4 flex gap-3">
                        <button
                          className="rounded-lg bg-[#164a3a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#103b2e] disabled:opacity-60"
                          disabled={busy}
                          onClick={() =>
                            void reviewApplication(application.id, "approve")
                          }
                          type="button"
                        >
                          Approve
                        </button>
                        <button
                          className="rounded-lg border border-[#dce4de] px-4 py-2 text-sm font-semibold text-[#59675f] hover:bg-[#f7f8f6] disabled:opacity-60"
                          disabled={busy}
                          onClick={() =>
                            void reviewApplication(application.id, "reject")
                          }
                          type="button"
                        >
                          Reject
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <section className="rounded-2xl border border-[#e0e7e2] bg-white p-6 sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Notifications</h2>
              <button
                className="text-sm font-medium text-[#315d49] hover:underline"
                onClick={() => void refresh()}
                type="button"
              >
                Refresh
              </button>
            </div>
            {data.notifications.length === 0 ? (
              <p className="mt-5 text-sm text-[#68756e]">
                You have no notifications.
              </p>
            ) : (
              <ul className="mt-5 divide-y divide-[#edf0ed]">
                {data.notifications.map((notification) => (
                  <li className="py-4 first:pt-0" key={notification.id}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-semibold">
                          {notification.title}
                        </h3>
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[#68756e]">
                          {notification.body}
                        </p>
                        <p className="mt-2 text-xs text-[#758078]">
                          {formatDate(notification.createdAt)}
                        </p>
                      </div>
                      {!notification.readAt && (
                        <button
                          className="shrink-0 text-xs font-medium text-[#315d49] hover:underline"
                          onClick={() =>
                            void markNotificationRead(notification.id)
                          }
                          type="button"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
