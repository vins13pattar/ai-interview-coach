import type {
  AnswerEvaluation,
  Difficulty,
  FollowUpReason,
  InterviewTurn,
} from "@interview-coach/contracts";

import { isEquivalentQuestion } from "./policy";

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
  followUpReason?: FollowUpReason,
  questionHistory: string[] = [],
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

  let candidate = base;
  if (followUpReason === "request_evidence") {
    candidate = `${base} Use one specific example and quantify the impact.`;
  } else if (followUpReason === "probe_tradeoff") {
    candidate = `${base} Defend one rejected alternative and its trade-off.`;
  } else if (followUpReason === "test_failure_mode") {
    candidate = `${base} What fails first, and how would you detect and recover from it?`;
  } else if (followUpReason === "resolve_contradiction") {
    candidate = `${base} Reconcile that answer with your earlier constraint before choosing.`;
  } else if (followUpReason === "clarify") {
    candidate = `${base} Start with the decision you personally owned.`;
  } else if (
    !followUpReason &&
    evaluation.improvements.some((item) => item.includes("trade-offs"))
  ) {
    candidate = `${base} Defend one rejected alternative and its trade-off.`;
  } else if (
    !followUpReason &&
    evaluation.improvements.some((item) => item.includes("concrete"))
  ) {
    candidate = `${base} Use one specific example and quantify the impact.`;
  }

  const history = [...turn.questionHistory, ...questionHistory, turn.question];
  if (isEquivalentQuestion(candidate, history)) {
    return `For ${focus}, identify the riskiest assumption you have not yet tested and design a measurable validation plan.`;
  }
  return candidate;
}

export function openingQuestion(
  role: string,
  focusArea: string,
  seniority: string,
): string {
  return `You are interviewing for a ${seniority} ${role} role. Tell me about the most consequential ${focusArea} decision you have made and how you measured its impact.`;
}
