/**
 * Short explanations for KPI surfaces (tooltips). Wording matches in-app labels.
 */

export const KPI_HELP = {
  locked_in: {
    title: "Locked in",
    description:
      "Correct on the first try with no hint and no retry. This is the strictest signal—closest to how the real exam scores recall.",
  },
  recovered: {
    title: "Recovered (soft miss)",
    description:
      "You missed first, then got it right after a hint or a second attempt. Good for learning, but exam day rarely gives that backup.",
  },
  needs_review: {
    title: "Needs review (hard miss)",
    description:
      "Still wrong after support or both tries. Prioritize these topics in practice—they’re the highest-risk gaps.",
  },
  coached_practice: {
    title: "Coached",
    description:
      "Share of questions where you opened AI tutor chat. High use can mean engagement—or leaning on help instead of recall.",
  },
  first_try_mastery: {
    title: "First-try mastery",
    description:
      "Percent answered correctly on the very first try, before any hint or retry. This is your headline exam-readiness score.",
  },
  with_support: {
    title: "With support",
    description:
      "Percent you eventually got right using a hint or a second try. Shows reach, but doesn’t replace first-try strength.",
  },
  composition_ring: {
    title: "Outcome mix",
    description:
      "How this session splits: locked in (green), recovered after help (amber), needs review (red). The center is first-try mastery.",
  },
  exam_readiness: {
    title: "Exam readiness",
    description:
      "Compares first-try vs with-support performance to South Carolina’s pass line (70%). First-try is the tighter bar.",
  },
  readiness_first_try: {
    title: "First-try vs pass line",
    description:
      "Your first-try mastery against the bar—closest match to sitting cold on exam questions.",
  },
  readiness_with_support: {
    title: "With-support vs pass line",
    description:
      "Performance when hints and retries count. Useful context; the licensure exam weights first try more heavily.",
  },
  pass_prob_national: {
    title: "National pass probability",
    description:
      "Model estimate for clearing the national portion (70% bar) from your first-try stats in assessed sections.",
  },
  pass_prob_state: {
    title: "South Carolina pass probability",
    description:
      "Model estimate for clearing the SC state portion (70% bar) from assessed performance.",
  },
  pass_prob_combined: {
    title: "Combined probability",
    description:
      "Estimated chance you pass national and SC portions on the same sitting—stricter than either portion alone.",
  },
  mock_margin: {
    title: "Margin vs passing bar",
    description:
      "Points above or below this mock’s passing threshold. Positive means you cleared the bar.",
  },
  mock_balance: {
    title: "Sub-score balance",
    description:
      "Gap between national and SC percentages. A wide spread means one half of the exam needs targeted work.",
  },
  mock_hard_pulse: {
    title: "Hard-question pulse",
    description:
      "Accuracy on questions tagged hard. Gains here usually lift overall score more than polishing easy items.",
  },
  mock_avg_time: {
    title: "Avg time per question",
    description:
      "Pace across the mock. The real exam allows roughly 72 seconds per question—check if you rush or linger.",
  },
  mock_weak_sections: {
    title: "Sections below bar",
    description:
      "How many sections scored under the passing threshold here. Fixing the weakest sections often lifts score fastest.",
  },
  mistakes_fixed: {
    title: "Fixed",
    description:
      "Questions you used to miss elsewhere but answered correctly this run—your remediation is sticking.",
  },
  mistakes_leaking: {
    title: "Still leaking",
    description:
      "Missed again after resurfacing. Repeat these until they flip to Fixed.",
  },
  mistakes_hints: {
    title: "Hint usage",
    description:
      "How often you needed a hint before answering. Fewer hints usually mean stronger recall.",
  },
  mistakes_avg_time: {
    title: "Average time",
    description:
      "Typical time before submitting—helps spot pacing on remediation sets.",
  },
  mistakes_recovery_ring: {
    title: "Recovery ring",
    description:
      "Green = fixed this run. Red = still leaking. Center shows overall recovered percentage.",
  },
  mistakes_headline_recovered: {
    title: "Recovered rate",
    description:
      "Percent of resurfaced misses answered correctly today—how much this Mistakes session lifted old gaps.",
  },
  mistakes_headline_leaking: {
    title: "Still leaking",
    description:
      "Share of resurfaced questions missed again—those weaknesses are still open.",
  },
  practice_ring: {
    title: "Outcome mix",
    description:
      "Ring splits this run: locked in (green), recovered after coaching (amber), needs review (red). The center shows reach — mastered plus recovered.",
  },
  practice_headline_strict: {
    title: "First-try mastery",
    description:
      "Correct with no hint and no tutor chat on that question — strictest view of recall.",
  },
  practice_headline_reach: {
    title: "Reach",
    description:
      "Share that ended locked in or recovered after the AI follow-up — total progress inside this practice session.",
  },
} as const;

export type KpiHelpKey = keyof typeof KPI_HELP;
