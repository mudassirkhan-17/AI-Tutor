export type QuestionRow = {
  id: string;
  section_code: string;
  topic_id: string | null;
  concept_id: string | null;
  level: "easy" | "medium" | "hard";
  prompt: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: "A" | "B" | "C" | "D";
  hint: string | null;
  explanation: string | null;
  source: string | null;
};

export type ConceptRow = {
  id: string;
  section_code: string;
  title: string;
  order_index: number;
};

export type ConceptMasteryRow = {
  user_id: string;
  concept_id: string;
  section_code: string;
  total: number;
  correct: number;
  soft_miss: number;
  hard_miss: number;
  mastered: number;
  accuracy: number;
};

export type ResultLabel = "mastered" | "soft_miss" | "hard_miss";

export type SessionRow = {
  id: string;
  user_id: string;
  mode: "assessment" | "practice" | "mistakes" | "mock" | "final";
  started_at: string;
  finished_at: string | null;
  score_pct: number | null;
  duration_ms: number | null;
  config: Record<string, unknown> | null;
  status: "in_progress" | "finished" | "abandoned";
};

export type AttemptRow = {
  id: string;
  user_id: string;
  session_id: string;
  question_id: string;
  mode: SessionRow["mode"];
  user_answer: "A" | "B" | "C" | "D" | null;
  is_correct: boolean;
  hinted: boolean;
  retried: boolean;
  time_spent_ms: number;
  attempt_number: number;
  result_label: ResultLabel | null;
  created_at: string;
};

export type MasteryRow = {
  user_id: string;
  section_code: string;
  total: number;
  correct: number;
  accuracy: number;
};
