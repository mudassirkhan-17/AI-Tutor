import { Suspense } from "react";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { AuthForm } from "@/components/auth/auth-form";

function AuthFormSkeleton() {
  return (
    <div
      className="h-[min(24rem,50vh)] animate-pulse rounded-2xl border border-border bg-elevated/50"
      aria-hidden
    />
  );
}

export default function SignupPage() {
  return (
    <AuthSplitLayout>
      <Suspense fallback={<AuthFormSkeleton />}>
        <AuthForm mode="signup" />
      </Suspense>
    </AuthSplitLayout>
  );
}
