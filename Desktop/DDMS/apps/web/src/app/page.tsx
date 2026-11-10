import Link from "next/link";
import { ApiStatus } from "@/components/api-status";

const milestones = [
  {
    number: "01",
    title: "Secure foundation",
    description:
      "Identity, access controls, and the shared data model are being prepared.",
  },
  {
    number: "02",
    title: "Document lifecycle",
    description:
      "Submission, review, version history, and archiving will be built on confirmed department policies.",
  },
  {
    number: "03",
    title: "Connected services",
    description:
      "Private object storage, email, and verification integrations will be configured for deployment.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f7f8f6] text-[#17211d]">
      <header className="border-b border-[#e3e8e4] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
          <Link className="flex items-center gap-3" href="/" aria-label="DDMS home">
            <span className="grid size-10 place-items-center rounded-xl bg-[#164a3a] text-sm font-bold tracking-wide text-white">
              D
            </span>
            <span>
              <span className="block text-sm font-semibold tracking-wide">
                DDMS
              </span>
              <span className="block text-xs text-[#68756e]">
                Department records
              </span>
            </span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link
              className="text-sm font-medium text-[#315d49] hover:underline"
              href="/login"
            >
              Sign in
            </Link>
            <Link
              className="rounded-lg bg-[#164a3a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#103b2e]"
              href="/register"
            >
              Register
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-12 px-6 pb-20 pt-16 lg:grid-cols-[1.15fr_0.85fr] lg:px-10 lg:pb-28 lg:pt-24">
        <div className="max-w-3xl">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-[#47715c]">
            Department Digital Document Management and Archiving System
          </p>
          <h1 className="max-w-2xl text-4xl font-semibold leading-tight tracking-tight text-[#17211d] sm:text-5xl lg:text-6xl">
            A considered foundation for trusted department records.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-[#59675f] sm:text-lg">
            DDMS is being developed as a secure, role-aware home for department
            documents and their complete lifecycle. Core workflows will be
            enabled as approved policies and integrations are confirmed.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <a
              className="rounded-lg bg-[#164a3a] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#103b2e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#164a3a]"
              href="#system-status"
            >
              View system status
            </a>
            <span className="text-sm text-[#68756e]">
              Account access requires configured CAPTCHA and email services.
            </span>
          </div>
        </div>

        <aside
          id="system-status"
          className="self-center rounded-2xl border border-[#e0e7e2] bg-white p-6 shadow-[0_12px_36px_-28px_rgba(23,33,29,0.35)] sm:p-8"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#68756e]">
            System status
          </p>
          <h2 className="mt-2 text-xl font-semibold">Service connectivity</h2>
          <ApiStatus />
          <div className="mt-7 border-t border-[#edf0ed] pt-5">
            <p className="text-sm font-medium text-[#34443b]">
              Approved architecture
            </p>
            <p className="mt-2 text-sm leading-6 text-[#68756e]">
              Next.js frontend · NestJS modular monolith · PostgreSQL and
              Prisma
            </p>
          </div>
        </aside>
      </section>

      <section className="border-y border-[#e3e8e4] bg-white">
        <div className="mx-auto max-w-7xl px-6 py-14 lg:px-10 lg:py-16">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#47715c]">
              Development roadmap
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              Built in deliberate, verifiable steps.
            </h2>
          </div>
          <div className="mt-9 grid gap-4 md:grid-cols-3">
            {milestones.map((milestone) => (
              <article
                key={milestone.number}
                className="rounded-xl border border-[#e6ebe7] bg-[#fbfcfb] p-5"
              >
                <span className="text-xs font-semibold tracking-[0.12em] text-[#47715c]">
                  {milestone.number}
                </span>
                <h3 className="mt-4 text-base font-semibold">
                  {milestone.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#68756e]">
                  {milestone.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-7 text-xs text-[#758078] sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <span>DDMS · Department records, carefully managed.</span>
        <span>Core services are under development.</span>
      </footer>
    </main>
  );
}
