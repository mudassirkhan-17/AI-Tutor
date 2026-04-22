import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { AuthForm } from "@/components/auth/auth-form";

export default function SignupPage() {
  return (
    <AuthSplitLayout>
      <AuthForm mode="signup" />
    </AuthSplitLayout>
  );
}
