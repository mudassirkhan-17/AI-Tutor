import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * One-click demo login.
 *
 * Uses the service-role key to ensure a single pre-confirmed demo user exists,
 * then returns its credentials so the client can `signInWithPassword`.
 *
 * Why this works:
 *   - admin.createUser bypasses Supabase's signup rate limit.
 *   - email_confirm: true skips the email-send step entirely (no per-IP email
 *     rate limit hit), which is what was blocking testing.
 *   - signInWithPassword for an existing user is on a separate, much higher
 *     limit than signup/email.
 *
 * Disable in production by setting NEXT_PUBLIC_ENABLE_DEMO_LOGIN=false.
 */
export async function POST() {
  if (process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN === "false") {
    return NextResponse.json({ error: "Demo login disabled." }, { status: 403 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      {
        error:
          "Demo login needs SUPABASE_SERVICE_ROLE_KEY in .env.local. Add it from Supabase → Settings → API.",
      },
      { status: 500 },
    );
  }

  const email = process.env.DEMO_EMAIL || "demo@tutor.local";
  const password = process.env.DEMO_PASSWORD || "demo-tutor-1234";

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: list, error: listErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listErr) {
    return NextResponse.json({ error: listErr.message }, { status: 500 });
  }

  const existing = list.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );

  if (existing) {
    // Re-assert the password + confirm flag so testing always works.
    const { error: updErr } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: {
        ...(existing.user_metadata ?? {}),
        full_name: existing.user_metadata?.full_name ?? "Demo Student",
      },
    });
    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }
  } else {
    const { error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Demo Student" },
    });
    if (createErr) {
      return NextResponse.json({ error: createErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ email, password });
}
