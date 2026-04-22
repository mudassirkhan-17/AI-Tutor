import { ModeIntro } from "@/components/runner/mode-intro";
import { MODES } from "@/lib/constants";

export default function MockExamIntro() {
  const m = MODES.mock;
  return (
    <ModeIntro
      mode="mock"
      title="Simulate the real thing."
      blurb={m.blurb}
      questionCount={m.questionCount}
      durationMin={m.durationMin}
      passPct={m.passPct}
      startHref="/mock-exam"
      startPath="/mock-exam/start"
      bullets={[
        "120 questions: 80 National + 40 South Carolina specific.",
        "240-minute timer. Pass at 70%.",
        "No hints, no AI chat during the exam.",
        "Flag questions for review and use the navigator to jump around.",
        "Auto-submits when time runs out.",
      ]}
    />
  );
}
