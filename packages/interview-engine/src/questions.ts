import type {
  AnswerEvaluation,
  Difficulty,
  InterviewTurn,
} from "@interview-coach/contracts";

const QUESTION_FRAMES: Record<Difficulty, string[]> = {
  foundation: [
    "Explain the core responsibilities of a {role} when working with {focus}.",
    "Walk me through how you would approach a straightforward {focus} task.",
  ],
  intermediate: [
    "Describe a real {focus} decision you made, the alternatives, and the outcome.",
    "How would you diagnose a production issue involving {focus}?",
  ],
  advanced: [
    "Design a production-grade solution for {focus}. Make the failure modes and trade-offs explicit.",
    "Tell me about a difficult {focus} incident. How did your technical judgment change the result?",
  ],
  expert: [
    "You inherit a critical {focus} platform with ambiguous ownership. What do you change first, and why?",
    "Challenge a commonly accepted {focus} best practice. Under what constraints does it become the wrong choice?",
  ],
};

const LEADERSHIP_FRAMES: Record<Difficulty, string> = {
  foundation:
    "How do you create clear ownership and expectations when leading technical work?",
  intermediate:
    "Describe a leadership decision that changed a technical outcome. How did you measure the result?",
  advanced:
    "Several teams disagree on a high-risk technical direction. How do you drive a decision without hiding the trade-offs?",
  expert:
    "You inherit an organization with recurring reliability failures and unclear ownership. What do you change first, and how do you know it worked?",
};

export function buildNextQuestion(
  turn: InterviewTurn,
  evaluation: AnswerEvaluation,
  nextDifficulty: Difficulty,
): string {
  const rawFocus =
    turn.focusAreas[turn.turnNumber % turn.focusAreas.length] ??
    "system design";
  const focus = rawFocus.charAt(0).toLocaleLowerCase() + rawFocus.slice(1);
  const isLeadershipFocus =
    /\b(leadership|management|mentoring|people)\b/i.test(focus);
  const frames = QUESTION_FRAMES[nextDifficulty];
  const base = isLeadershipFocus
    ? LEADERSHIP_FRAMES[nextDifficulty]
    : (
        frames[turn.turnNumber % frames.length] ??
        frames[0] ??
        "Explain how you would approach {focus} for a {role} role."
      )
        .replaceAll("{role}", turn.role)
        .replaceAll("{focus}", focus);

  if (evaluation.improvements.some((item) => item.includes("trade-offs"))) {
    return `${base} I will ask you to defend one trade-off.`;
  }
  if (evaluation.improvements.some((item) => item.includes("concrete"))) {
    return `${base} Use one specific example and quantify the impact.`;
  }
  return base;
}

export function openingQuestion(
  role: string,
  focusArea: string,
  seniority: string,
): string {
  return `You are interviewing for a ${seniority} ${role} role. Tell me about the most consequential ${focusArea} decision you have made and how you measured its impact.`;
}
