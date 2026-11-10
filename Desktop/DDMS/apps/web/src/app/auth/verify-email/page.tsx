import Link from "next/link";
import { EmailVerification } from "@/components/email-verification";

export default function VerifyEmailPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#f7f8f6] px-5 py-12">
      <Link className="mb-8 text-sm font-semibold text-[#315d49]" href="/">
        DDMS
      </Link>
      <EmailVerification />
    </main>
  );
}
