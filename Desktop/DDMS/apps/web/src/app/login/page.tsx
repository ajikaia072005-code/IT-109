import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#f7f8f6] px-5 py-12">
      <Link className="mb-8 text-sm font-semibold text-[#315d49]" href="/">
        DDMS
      </Link>
      <AuthForm mode="login" />
    </main>
  );
}
