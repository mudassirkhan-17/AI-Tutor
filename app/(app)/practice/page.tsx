import { ModeIntro } from "@/components/runner/mode-intro";
import { MODES } from "@/lib/constants";

export default function PracticeIntro() {
  const m = MODES.practice;
  return (
    <ModeIntro
      mode="practice"
      title="Practice. Hint. Retry. Master."
      blurb={m.blurb}
      questionCount={m.questionCount}
      startHref="/practice"
      startPath="/practice/start"
      bullets={[
        "110 random questions drawn from the full pool.",
        "Tap Hint anytime you're unsure.",
        "Get a wrong answer once? Same question returns with a hint.",
        "Miss it twice? We show the explanation and log it in your Mistakes pool.",
      ]}
    />
  );
}
