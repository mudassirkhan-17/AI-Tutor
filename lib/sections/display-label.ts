import { SECTIONS } from "@/lib/constants";

/** Maps PSI-style section group to user-facing portion prefix (UI + PDF only). */
function portionPrefix(group: string): string {
  return group === "National" ? "National" : "South Carolina";
}

/**
 * Full section label for learners — e.g. "National — Property Ownership".
 * Unknown codes fall back to the raw code (legacy / edge data).
 */
export function formatSectionDisplayLabel(sectionCode: string): string {
  const row = SECTIONS.find((s) => s.code === sectionCode);
  if (!row) return sectionCode;
  return `${portionPrefix(row.group)} — ${row.title}`;
}
