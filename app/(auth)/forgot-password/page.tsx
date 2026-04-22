"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/callback?next=/settings`,
    });
    setPending(false);
    if (error) return toast.error(error.message);
    setSent(true);
    toast.success("Reset email sent.");
  }

  return (
    <AuthSplitLayout>
      <div className="space-y-6">
        <div>
          <h2 className="font-serif text-3xl font-semibold">Reset password</h2>
          <p className="mt-1.5 text-sm text-ink-muted">
            We&apos;ll email you a link to set a new password.
          </p>
        </div>
        {sent ? (
          <p className="rounded-xl border border-border bg-elevated p-4 text-sm">
            If an account exists for <b>{email}</b>, a reset link has been sent.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@domain.com"
              />
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={pending}>
              {pending ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        )}
        <p className="text-center text-sm text-ink-muted">
          <Link href="/login" className="font-medium text-primary hover:underline">
            Back to log in
          </Link>
        </p>
      </div>
    </AuthSplitLayout>
  );
}
