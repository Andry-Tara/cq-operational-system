import { LoginForm } from "@/components/login-form";

export default function Page() {
  return (
    <main className="relative min-h-svh overflow-hidden bg-[#f6f5f2]">
      {/* subtle background decoration */}
      <div className="pointer-events-none absolute left-1/2 top-[-180px] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-red-100/30 blur-3xl" />

      <div className="relative mx-auto flex min-h-svh w-full items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-[500px]">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
