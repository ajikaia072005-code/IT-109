# Department Digital Document Management and Archiving System

DDMS is being developed as a separate Next.js frontend and a single NestJS
modular-monolith API, backed by one PostgreSQL database through Prisma.

## Requirements

- Node.js 20.9 or later
- npm
- PostgreSQL

## Local development

1. Copy `apps/api/.env.example` to `apps/api/.env` and
   `apps/web/.env.example` to `apps/web/.env.local`.
2. Replace the API JWT placeholder with a random secret of at least 32 bytes.
   Configure the PostgreSQL URL, Cloudflare Turnstile keys, and SMTP settings.
3. Install dependencies from the repository root:

   ```sh
   npm install
   ```

4. Apply the database migration and seed the role/permission baseline:

   ```sh
   npm run db:migrate
   npm run db:seed
   ```

5. Start the API and frontend in separate terminals:

   ```sh
   npm run dev:api
   npm run dev:web
   ```

The API health endpoint is `http://localhost:4000/api/health`. The frontend
checks this endpoint and reports whether the API is reachable.

## Authentication and first administrator

The API implements CAPTCHA-verified registration and login, hashed passwords,
email verification, HttpOnly JWT cookies, origin checks, rate limits, and
database-backed single-role permissions. Registration is currently restricted
to `gmail.com`, as confirmed for this project; this proves mailbox ownership,
not institutional affiliation.

After a user registers and verifies their email, set
`ADMIN_BOOTSTRAP_EMAIL` in `apps/api/.env` to that account and run:

```sh
npm run admin:bootstrap
```

The bootstrap command refuses to run if a System Admin is already assigned.
It does not create or set a password.

## Role applications and notifications

Verified Viewers can request any other defined role, including System Admin.
Only active System Admins with the `role_applications.review` permission can
list, approve, or reject pending applications. An applicant cannot review their
own request; approval replaces their Viewer role and invalidates existing
sessions. Decisions, audit records, and in-app notification outbox records are
written in one PostgreSQL transaction.

Authenticated users can list and mark their own notifications as read. Email
delivery uses the persisted notification outbox with leases and exponential
retry; external SMTP sending occurs after database commits.

The workspace UI now includes the Viewer application form, System Admin review
queue, and per-user notifications at `/dashboard`.

## Workspace commands

- `npm run build` builds both applications.
- `npm run lint` lints both applications.
- `npm test` runs the API unit tests.
- `npm run test:e2e` runs the API end-to-end tests.
- `npm run db:generate` generates the Prisma client.
- `npm run db:migrate` applies pending Prisma migrations to the configured database.
- `npm run db:seed` seeds the six roles and the explicitly approved permission baseline.
- `npm run admin:bootstrap` performs the one-time System Admin assignment.

## Folder structure

```text
DDMS/
├── apps/
│   ├── api/
│   │   ├── prisma/
│   │   │   └── migrations/
│   │   │       ├── 20261109195000_auth_roles_init/
│   │   │       └── 20261109203000_role_application_notifications/
│   │   ├── scripts/
│   │   ├── src/
│   │   │   ├── application/
│   │   │   │   ├── auth/
│   │   │   │   ├── notifications/
│   │   │   │   └── role-applications/
│   │   │   ├── database/
│   │   │   └── persistence/
│   │   └── test/
│   └── web/
│       ├── public/
│       └── src/
│           ├── app/
│           │   ├── auth/verify-email/
│           │   ├── dashboard/
│           │   ├── login/
│           │   ├── register/
│           │   └── resend-verification/
│           ├── components/
│           │   └── ui/
│           └── lib/
├── node_modules/                 (installed dependencies; generated)
├── package.json
├── package-lock.json
└── README.md
```

### What the folders contain

- `apps/` — the npm workspace applications.
- `apps/api/` — the NestJS backend, its environment template, configuration,
  and API-specific documentation.
- `apps/api/prisma/` — the PostgreSQL data model (`schema.prisma`), role and
  permission seed script, and schema migration history.
- `apps/api/prisma/migrations/` — ordered SQL changes to create and evolve the
  database. Each dated child folder is one migration.
- `apps/api/scripts/` — operational scripts, including the one-time
  System Admin bootstrap.
- `apps/api/src/` — backend runtime source code.
- `apps/api/src/application/` — HTTP controllers, business services, DTOs,
  guards, and Nest modules, grouped by feature.
- `apps/api/src/application/auth/` — registration, login, verification,
  authentication and authorization.
- `apps/api/src/application/notifications/` — notification endpoints and the
  email outbox delivery/retry worker.
- `apps/api/src/application/role-applications/` — role application submission
  and administrator review endpoints and business rules.
- `apps/api/src/database/` — database module and Prisma client lifecycle
  service.
- `apps/api/src/persistence/` — Prisma-backed repositories that read and write
  application data.
- `apps/api/test/` — API end-to-end tests and their test environment setup.
- `apps/web/` — the Next.js frontend, its environment template, and
  frontend-specific configuration.
- `apps/web/public/` — static assets served directly by the frontend.
- `apps/web/src/app/` — Next.js App Router pages and shared global layout and
  styles. Each route folder maps to a browser path, such as `login/` to
  `/login`.
- `apps/web/src/app/auth/verify-email/` — the email verification page.
- `apps/web/src/app/dashboard/` — the signed-in dashboard page.
- `apps/web/src/app/login/`, `register/`, and `resend-verification/` — the
  corresponding account pages.
- `apps/web/src/components/` — reusable interface components and feature
  components such as authentication forms and the dashboard.
- `apps/web/src/components/ui/` — shared low-level UI primitives.
- `apps/web/src/lib/` — frontend utilities shared by components and pages.
- `node_modules/` — dependencies installed by npm; generated locally and not
  application source.

At the repository root, `package.json` defines the workspace and common
commands, `package-lock.json` records dependency versions, and `README.md`
contains setup and project documentation. Build output and framework caches
may also appear locally; they are generated and are not source folders.

The first migrations contain the account, role, permission, audit, notification
and role-application tables. They have not been applied to a live PostgreSQL
database in this workspace. Document storage, approval workflows,
department/organization membership, archives, and search are not yet
implemented.

## Pending policy decisions

Before implementing affected business rules, confirm department and
organization membership rules, document approval routing and status lifecycle,
file limits, retention, and S3-compatible storage configuration.
