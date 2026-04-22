export const SECTIONS = [
  { code: "A1", title: "Property Ownership", group: "National" },
  { code: "A2", title: "Land Use Controls & Regulations", group: "National" },
  { code: "A3", title: "Valuation & Market Analysis", group: "National" },
  { code: "A4", title: "Financing", group: "National" },
  { code: "A5", title: "General Principles of Agency", group: "National" },
  { code: "A6", title: "Property Disclosures", group: "National" },
  { code: "B1", title: "SC License Law & Commission Rules", group: "State" },
  { code: "B2", title: "SC Agency Relationships", group: "State" },
  { code: "B3", title: "SC Contracts & Purchase Agreements", group: "State" },
  { code: "B4", title: "SC Property Management & Leasing", group: "State" },
  { code: "B5", title: "SC Fair Housing & Ethics", group: "State" },
  { code: "B6", title: "SC Closing, Settlement & Escrow", group: "State" },
] as const;

export type SectionCode = (typeof SECTIONS)[number]["code"];

export const MODES = {
  assessment: {
    key: "assessment",
    label: "Assessment",
    blurb:
      "Diagnostic across every section, with a 2-chance flow and AI hints. Choose Quick or Deep.",
    questionCount: 0, // user picks length × sections at start
    timed: false,
  },
  practice: {
    key: "practice",
    label: "Practice",
    blurb:
      "110 questions: SC national/state mix, weighted by your section mastery. Miss one and the AI writes a fresh same-concept question as a free extra try.",
    questionCount: 110,
    timed: false,
  },
  mistakes: {
    key: "mistakes",
    label: "Mistakes Test",
    blurb: "Re-drill the questions you got wrong until they stick.",
    questionCount: 110,
    timed: false,
  },
  mock: {
    key: "mock",
    label: "Mock Exam",
    blurb: "SC format: 120 questions, 240 minutes, 70% to pass.",
    questionCount: 120,
    timed: true,
    durationMin: 240,
    passPct: 70,
  },
  final: {
    key: "final",
    label: "Final Test",
    blurb: "Held-out questions. Your true readiness check.",
    questionCount: 120,
    timed: true,
    durationMin: 240,
    passPct: 75,
    unlocksAfter: "mock",
  },
} as const;

export type ModeKey = keyof typeof MODES;
