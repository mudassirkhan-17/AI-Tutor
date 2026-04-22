import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { AuthForm } from "@/components/auth/auth-form";

export default function LoginPage() {
  return (
    <AuthSplitLayout>
      <AuthForm mode="login" />
    </AuthSplitLayout>
  );
}
