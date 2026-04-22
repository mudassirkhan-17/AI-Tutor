/* eslint-disable no-console */
/**
 * Import questions + concepts from a CSV into Supabase.
 *
 * Usage:
 *   npm run import
 *   tsx scripts/import-questions.ts [path/to/questions.csv]
 *
 * Default path resolution (first match wins):
 *   1. Path passed as argv[2]
 *   2. ./data/questions_labeled.csv (merged questions + concepts from data/)
 *   3. ./questions_labeled_v2.csv
 *   4. ./questions_labeled.csv
 *   5. ./data/questions.csv
 *
 * Required env (in .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Behavior:
 * - Auto-detects ; or , delimiter.
 * - Accepts both legacy (subject) and v2 (concept_id) formats.
 * - Derives section_code from concept_id prefix when present
 *   ("A4.foo" → "A4"). Falls back to subject parsing.
 * - Upserts questions by id (so re-running is safe).
 * - Auto-populates the `concepts` table from unique concept_ids.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "csv-parse/sync";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const candidates = [
  process.argv[2],
  "data/questions_labeled.csv",
  "questions_labeled_v2.csv",
  "questions_labeled.csv",
  "data/questions.csv",
].filter(Boolean) as string[];

const csvPath = (() => {
  for (const c of candidates) {
    const p = resolve(c);
    if (existsSync(p)) return p;
  }
  return null;
})();

if (!csvPath) {
  console.error(
    "CSV not found. Looked for:\n  " + candidates.map((c) => "- " + c).join("\n  "),
  );
  process.exit(1);
}

console.log(`Using CSV: ${csvPath}`);

const VALID_SECTIONS = new Set([
  "A1","A2","A3","A4","A5","A6",
  "B1","B2","B3","B4","B5","B6",
]);

const Row = z.object({
  section: z.string().trim().regex(/^[AB][1-9]$/i).transform((s) => s.toUpperCase()),
  level: z
    .string()
    .trim()
    .toLowerCase()
    .default("medium")
    .transform((v) => (["easy", "medium", "hard"].includes(v) ? v : "medium")),
  prompt: z.string().trim().min(3),
  option_a: z.string().trim().min(1),
  option_b: z.string().trim().min(1),
  option_c: z.string().trim().min(1),
  option_d: z.string().trim().min(1),
  correct: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => ["A", "B", "C", "D"].includes(v), "correct must be A/B/C/D"),
  hint: z.string().trim().optional().nullable(),
  explanation: z.string().trim().optional().nullable(),
  source: z.string().trim().optional().nullable(),
  pool: z
    .string()
    .trim()
    .toLowerCase()
    .default("standard")
    .transform((v) => (v === "final_holdout" ? "final_holdout" : "standard")),
  id: z.string().uuid().optional(),
  concept_id: z.string().trim().optional().nullable(),
});

function detectDelimiter(raw: string): "," | ";" {
  const line = raw.split(/\r?\n/).find((l) => l.trim()) ?? "";
  const semi = (line.match(/;/g) ?? []).length;
  const comma = (line.match(/,/g) ?? []).length;
  return semi > comma ? ";" : ",";
}

function extractSectionFromConceptId(cid: string): string | null {
  const m = cid.trim().match(/^([AB][1-9])\./i);
  return m && VALID_SECTIONS.has(m[1].toUpperCase()) ? m[1].toUpperCase() : null;
}

function extractSectionFromSubject(subject: string): string | null {
  const m = subject.trim().match(/^([AB][1-9])(?:\s|$)/i);
  return m && VALID_SECTIONS.has(m[1].toUpperCase()) ? m[1].toUpperCase() : null;
}

function norm(s: string) {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

function resolveCorrectLetter(
  raw: string,
  opts: { option_a: string; option_b: string; option_c: string; option_d: string },
): "A" | "B" | "C" | "D" | null {
  const t = raw.trim();
  const u = t.toUpperCase();
  if (u.length === 1 && ["A", "B", "C", "D"].includes(u)) return u as "A" | "B" | "C" | "D";
  const nt = norm(t);
  if (norm(opts.option_a) === nt) return "A";
  if (norm(opts.option_b) === nt) return "B";
  if (norm(opts.option_c) === nt) return "C";
  if (norm(opts.option_d) === nt) return "D";
  for (const letter of ["A", "B", "C", "D"] as const) {
    const o = opts[`option_${letter.toLowerCase()}` as keyof typeof opts];
    if (o && (nt.includes(norm(o)) || norm(o).includes(nt))) return letter;
  }
  return null;
}

function normalizeKeys(row: Record<string, string>) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    const key = k
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "_")
      .replace(/^option\s*(a|b|c|d)$/i, "option_$1");
    out[key] = typeof v === "string" ? v : String(v ?? "");
  }
  if (out.correct_option && !out.correct) out.correct = out.correct_option;
  if (out.answer && !out.correct) out.correct = out.answer;
  if (out.question && !out.prompt) out.prompt = out.question;
  if (out.question_text && !out.prompt) out.prompt = out.question_text;
  if (out["option a"]) out.option_a = out["option a"];
  if (out["option b"]) out.option_b = out["option b"];
  if (out["option c"]) out.option_c = out["option c"];
  if (out["option d"]) out.option_d = out["option d"];
  if (out.feedback && !out.explanation) out.explanation = out.feedback;
  if (out.level_label && !out.level) out.level = out.level_label;

  // Section: prefer concept_id prefix, fall back to subject parse
  let section: string | null = null;
  if (out.concept_id) section = extractSectionFromConceptId(out.concept_id);
  if (!section && out.subject) section = extractSectionFromSubject(out.subject);
  if (section) out.section = section;

  return out;
}

function enrichCorrect(out: Record<string, string>) {
  if (out.correct_answer && !out.correct && out.option_a && out.option_b && out.option_c && out.option_d) {
    const letter = resolveCorrectLetter(out.correct_answer, {
      option_a: out.option_a,
      option_b: out.option_b,
      option_c: out.option_c,
      option_d: out.option_d,
    });
    if (letter) out.correct = letter;
  }
}

function humanizeConceptTitle(cid: string): string {
  const tail = cid.split(".").slice(1).join(".") || cid;
  let t = tail
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bOldcar\b/g, "OLDCAR")
    .replace(/\bSc\b/g, "SC")
    .replace(/\bPmi\b/g, "PMI")
    .replace(/\bCcrs\b/g, "CC&Rs")
    .replace(/\bRespa\b/g, "RESPA")
    .replace(/\bTila\b/g, "TILA")
    .replace(/\bEcoa\b/g, "ECOA")
    .replace(/\bAda\b/g, "ADA")
    .replace(/\bArms\b/g, "ARMs")
    .replace(/\bLtv\b/g, "LTV")
    .replace(/\bFha\b/g, "FHA")
    .replace(/\bVa\b/g, "VA")
    .replace(/\bUsda\b/g, "USDA")
    .replace(/\bPud\b/g, "PUD")
    .replace(/\bHoa\b/g, "HOA")
    .replace(/\bApr\b/g, "APR")
    .replace(/\bIrs\b/g, "IRS")
    .replace(/\bCma\b/g, "CMA")
    .replace(/\bCe\b/g, "CE")
    .replace(/\bMgmt\b/g, "Mgmt")
    .replace(/\bVs\b/g, "vs.")
    .replace(/\bJt Tic Tbe\b/g, "JT/TIC/TBE")
    .replace(/\bCondos Coops Pud\b/g, "Condos, Co-ops & PUDs")
    .replace(/\bCalc\b/g, "Calc.")
    .replace(/\bFund\b/g, "Fund")
    .replace(/\b(And|Of|In|The|To|For|By|Vs)\b/g, (m) => m.toLowerCase())
    .replace(/^./, (c) => c.toUpperCase());
  return t;
}

async function main() {
  const raw = readFileSync(csvPath!, "utf8");
  const delimiter = detectDelimiter(raw);
  console.log(`Delimiter: "${delimiter}"`);

  const rows: Record<string, string>[] = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    trim: true,
    relax_column_count: true,
    delimiter,
  });

  console.log(`Parsed ${rows.length} rows`);

  const records: Record<string, unknown>[] = [];
  const errors: { row: number; issue: string }[] = [];
  const conceptsSeen = new Map<string, { section: string; order: number }>();

  for (let i = 0; i < rows.length; i++) {
    const normalized = normalizeKeys(rows[i]);
    enrichCorrect(normalized);

    const withId: Record<string, string> = { ...normalized };
    if (withId.id && !z.string().uuid().safeParse(withId.id).success) {
      delete withId.id;
    }

    const parsed = Row.safeParse(withId);
    if (!parsed.success) {
      errors.push({
        row: i + 2,
        issue: parsed.error.issues
          .map((x) => `${x.path.join(".")}: ${x.message}`)
          .join("; "),
      });
      continue;
    }

    const conceptId = parsed.data.concept_id?.trim() || null;
    if (conceptId) {
      const sec = extractSectionFromConceptId(conceptId);
      if (sec && !conceptsSeen.has(conceptId)) {
        conceptsSeen.set(conceptId, {
          section: sec,
          order: conceptsSeen.size,
        });
      }
    }

    const rec: Record<string, unknown> = {
      section_code: parsed.data.section,
      level: parsed.data.level,
      prompt: parsed.data.prompt,
      option_a: parsed.data.option_a,
      option_b: parsed.data.option_b,
      option_c: parsed.data.option_c,
      option_d: parsed.data.option_d,
      correct_option: parsed.data.correct,
      hint: parsed.data.hint || null,
      explanation: parsed.data.explanation || null,
      source: parsed.data.source || null,
      pool: parsed.data.pool,
      concept_id: conceptId,
    };
    if (parsed.data.id) rec.id = parsed.data.id;
    records.push(rec);
  }

  if (errors.length) {
    console.warn(`Skipping ${errors.length} invalid rows:`);
    errors.slice(0, 15).forEach((e) => console.warn(` - row ${e.row}: ${e.issue}`));
    if (errors.length > 15) console.warn(` ...and ${errors.length - 15} more`);
  }

  if (!records.length) {
    console.error("No valid records to insert.");
    process.exit(1);
  }

  const supabase = createClient(URL!, KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // -- 1. Upsert concepts catalog --
  if (conceptsSeen.size) {
    const conceptRows = Array.from(conceptsSeen.entries()).map(([id, meta]) => ({
      id,
      section_code: meta.section,
      title: humanizeConceptTitle(id),
      order_index: meta.order,
    }));
    console.log(`Upserting ${conceptRows.length} concepts…`);
    const { error: cErr } = await supabase
      .from("concepts")
      .upsert(conceptRows, { onConflict: "id" });
    if (cErr) {
      console.error("Concepts upsert failed:", cErr.message);
      console.error("Tip: did you run supabase/migrations/0002_assessment_v2.sql?");
      process.exit(1);
    }
  } else {
    console.log("No concept_id column found — skipping concepts table.");
  }

  // -- 2. Upsert questions in batches --
  const BATCH = 500;
  let upserted = 0;
  for (let i = 0; i < records.length; i += BATCH) {
    const chunk = records.slice(i, i + BATCH);
    const onConflict = chunk.every((r) => r.id) ? "id" : undefined;
    const { error } = await supabase.from("questions").upsert(chunk, {
      onConflict,
      ignoreDuplicates: false,
    });
    if (error) {
      console.error("Upsert error on batch", i / BATCH, error.message);
      process.exit(1);
    }
    upserted += chunk.length;
    console.log(`Upserted ${upserted}/${records.length}`);
  }

  console.log(`Done. ${upserted} questions imported / updated.`);
  console.log(`Concepts: ${conceptsSeen.size}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
