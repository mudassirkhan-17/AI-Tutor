"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export function SettingsForm({
  initialFullName,
  initialTargetDate,
  email,
}: {
  initialFullName: string;
  initialTargetDate: string;
  email: string;
}) {
  const [fullName, setFullName] = React.useState(initialFullName);
  const [targetDate, setTargetDate] = React.useState(initialTargetDate ?? "");
  const [pending, setPending] = React.useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const supabase = createClient();
    const { data: user } = await supabase.auth.getUser();
    const uid = user.user?.id;
    if (!uid) {
      toast.error("You're signed out.");
      setPending(false);
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        target_exam_date: targetDate || null,
      })
      .eq("id", uid);
    setPending(false);
    if (error) toast.error(error.message);
    else toast.success("Saved.");
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={email} disabled />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fullName">Full name</Label>
        <Input
          id="fullName"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Jane Appleseed"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="targetDate">Target exam date</Label>
        <Input
          id="targetDate"
          type="date"
          value={targetDate ?? ""}
          onChange={(e) => setTargetDate(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
