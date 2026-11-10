# DDMS API

The API is one NestJS application and is the backend deployment boundary for
all DDMS modules. Its local development port is `4000`; the configured global
route prefix is `/api`.

## Local development

1. Copy `.env.example` to `.env`, replace the JWT placeholder with a random
   secret of at least 32 bytes, and configure `DATABASE_URL`, Turnstile, and
   SMTP values before using authentication.
2. From the repository root, install dependencies with `npm install`.
3. Start the API with `npm run dev:api`.

`GET /api/health` reports API process availability only. It does not indicate
database or external-service readiness.

## Database setup

The Prisma migrations create accounts, the six roles, permissions, role
applications, audit logs, notifications, and email verification tokens. They
also add a durable notification email outbox.
From the repository root:

```sh
npm run db:migrate
npm run db:seed
```

The migration has not been applied to a live database in this workspace.

## Authentication

The API exposes `POST /api/auth/register`, `POST /api/auth/login`,
`POST /api/auth/verify-email`, `POST /api/auth/resend-verification`,
`POST /api/auth/logout`, and `GET /api/auth/me`. Mutating requests require the
configured frontend `Origin`. CAPTCHA and SMTP settings must be configured
before registration is usable. Registration is restricted to `gmail.com` per
the current project decision.

For deployments where the frontend and API are on different sites, configure
`AUTH_COOKIE_SAME_SITE=none` and `AUTH_COOKIE_SECURE=true`; keep
`FRONTEND_URL` set to the exact frontend origin.

After an account verifies its email, set `ADMIN_BOOTSTRAP_EMAIL` to that
account in `.env` and run `npm run admin:bootstrap` from the repository root.
The command is one-time and refuses to replace an existing System Admin.

## Role applications and notifications

- `POST /api/role-applications` submits a Viewer application.
- `GET /api/role-applications` returns the authenticated user's applications.
- `GET /api/role-applications/pending` lists applications for authorized admins.
- `POST /api/role-applications/:id/approve` approves a request.
- `POST /api/role-applications/:id/reject` rejects a request.
- `GET /api/notifications` lists the authenticated user's notifications;
  `PATCH /api/notifications/:id/read` and
  `POST /api/notifications/read-all` update only that user's records.

Application decisions update the user's single assigned role, invalidate old
sessions, write audit and in-app notification records atomically, and queue
email delivery for retry after commit. The SMTP notification worker retries
failed sends with backoff.

Department/organization membership and document workflows remain gated until
their policies are confirmed.
