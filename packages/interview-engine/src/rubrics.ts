import {
  InterviewRubricSchema,
  type InterviewRubric,
  type InterviewTurn,
  type RoleFamily,
  type RubricDimension,
} from "@interview-coach/contracts";

export const RUBRIC_REGISTRY_VERSION = "1.0.0";

type RoleRubricDefinition = {
  roleFamily: RoleFamily;
  rolePatterns: RegExp[];
  competencies: string[];
  technicalEvidence: string[];
  disqualifyingInsufficiencies: string[];
  followUpRules: string[];
  limitations: string[];
};

function anchors(
  dimension: RubricDimension["dimension"],
): RubricDimension["anchors"] {
  const descriptions = {
    confidence: [
      "Claims are unsupported, evasive, or expressed with unjustified certainty.",
      "States a position but leaves assumptions and ownership materially unclear.",
      "States decisions, assumptions, uncertainty, and personal contribution clearly.",
      "Calibrates certainty precisely and revises a position when evidence changes.",
    ],
    communication: [
      "The response is off-topic, contradictory, or too incomplete to assess.",
      "The main point is present but structure, relevance, or concision is inconsistent.",
      "The response is structured, relevant, concise, and adapted to the audience.",
      "The response makes complex trade-offs easy to inspect without hiding uncertainty.",
    ],
    technicalDepth: [
      "No assessable technical reasoning, constraints, or failure analysis is present.",
      "Names relevant concepts but provides limited causal reasoning or validation.",
      "Connects constraints, alternatives, trade-offs, failure modes, and validation.",
      "Anticipates second-order effects and defends decisions with measurable evidence.",
    ],
    pronunciation: [
      "Acoustic evidence is unavailable or insufficient; no score may be produced.",
      "Acoustic evidence requires calibrated specialist review before interpretation.",
      "Acoustic evidence meets a validated intelligibility rubric for the target context.",
      "Acoustic evidence is consistently intelligible across the validated test conditions.",
    ],
  }[dimension];
  return [
    {
      level: "insufficient" as const,
      scoreRange: [0, 39] as [number, number],
      description: descriptions[0]!,
      observableSignals: ["Missing or contradictory assessable evidence"],
    },
    {
      level: "developing" as const,
      scoreRange: [40, 59] as [number, number],
      description: descriptions[1]!,
      observableSignals: ["Some relevant evidence with material gaps"],
    },
    {
      level: "proficient" as const,
      scoreRange: [60, 79] as [number, number],
      description: descriptions[2]!,
      observableSignals: ["Clear evidence connected to the question"],
    },
    {
      level: "advanced" as const,
      scoreRange: [80, 100] as [number, number],
      description: descriptions[3]!,
      observableSignals: [
        "Specific evidence with uncertainty and second-order effects",
      ],
    },
  ];
}

function dimensions(technicalEvidence: string[]): RubricDimension[] {
  return [
    {
      dimension: "confidence",
      weight: 0.25,
      requiredEvidence: [
        "A clear decision or position",
        "Explicit ownership or contribution",
        "Calibrated uncertainty",
      ],
      anchors: anchors("confidence"),
    },
    {
      dimension: "communication",
      weight: 0.3,
      requiredEvidence: [
        "A direct answer to the question",
        "A coherent sequence of reasoning",
        "Relevant detail without unnecessary repetition",
      ],
      anchors: anchors("communication"),
    },
    {
      dimension: "technicalDepth",
      weight: 0.45,
      requiredEvidence: technicalEvidence,
      anchors: anchors("technicalDepth"),
    },
  ];
}

const roleDefinitions: RoleRubricDefinition[] = [
  {
    roleFamily: "frontend-engineer",
    rolePatterns: [/\bfront[\s-]?end\b/i, /\bui engineer\b/i],
    competencies: [
      "browser architecture",
      "accessibility",
      "performance",
      "state management",
      "testing",
    ],
    technicalEvidence: [
      "Browser or rendering constraints",
      "Accessibility and interaction behavior",
      "Measured performance or reliability outcomes",
      "Testing and rollout strategy",
    ],
    disqualifyingInsufficiencies: [
      "Treats accessibility as optional polish",
      "Claims performance improvement without measurement",
    ],
    followUpRules: [
      "Probe browser constraints when only framework names are given",
      "Request an accessibility validation method",
    ],
    limitations: [
      "Does not execute or visually inspect the candidate's frontend code.",
    ],
  },
  {
    roleFamily: "backend-engineer",
    rolePatterns: [/\bback[\s-]?end\b/i, /\bserver engineer\b/i],
    competencies: [
      "data modelling",
      "distributed systems",
      "reliability",
      "API design",
      "observability",
    ],
    technicalEvidence: [
      "Data consistency and ownership constraints",
      "Failure modes and recovery behavior",
      "Capacity, latency, or throughput evidence",
      "Observability and safe rollout strategy",
    ],
    disqualifyingInsufficiencies: [
      "Ignores failure recovery for a production design",
      "Claims scale without a workload or capacity assumption",
    ],
    followUpRules: [
      "Probe consistency and failure behavior before increasing difficulty",
      "Request workload numbers when scale is asserted",
    ],
    limitations: ["Does not benchmark or execute the proposed backend design."],
  },
  {
    roleFamily: "full-stack-engineer",
    rolePatterns: [/\bfull[\s-]?stack\b/i],
    competencies: [
      "end-to-end architecture",
      "API contracts",
      "user experience",
      "data integrity",
      "delivery",
    ],
    technicalEvidence: [
      "A traced user-to-data flow",
      "Frontend and backend contract trade-offs",
      "Data integrity and failure handling",
      "Deployment and verification evidence",
    ],
    disqualifyingInsufficiencies: [
      "Discusses only one application tier",
      "Omits data integrity from a state-changing workflow",
    ],
    followUpRules: [
      "Ask the candidate to trace one request across application tiers",
      "Probe recovery when client and server state diverge",
    ],
    limitations: [
      "Breadth signals may not establish specialist depth in every application tier.",
    ],
  },
  {
    roleFamily: "technical-lead",
    rolePatterns: [
      /\btechnical lead\b/i,
      /\btech lead\b/i,
      /\blead engineer\b/i,
    ],
    competencies: [
      "technical direction",
      "delivery leadership",
      "risk management",
      "decision facilitation",
      "mentoring",
    ],
    technicalEvidence: [
      "A consequential technical decision",
      "Stakeholder constraints and dissent",
      "Risk reduction or delivery outcome",
      "A mechanism that improved team decision quality",
    ],
    disqualifyingInsufficiencies: [
      "Describes team output without personal leadership evidence",
      "Equates consensus with technical correctness",
    ],
    followUpRules: [
      "Separate personal contribution from team outcome",
      "Probe how dissent and irreversible risk were handled",
    ],
    limitations: [
      "A practice transcript cannot independently verify leadership impact.",
    ],
  },
  {
    roleFamily: "principal-engineer",
    rolePatterns: [/\bprincipal\b/i, /\bdistinguished\b/i, /\bstaff\+?\b/i],
    competencies: [
      "organizational architecture",
      "cross-team influence",
      "long-term leverage",
      "risk governance",
      "technical strategy",
    ],
    technicalEvidence: [
      "Organization-scale constraints and competing incentives",
      "A decision mechanism spanning multiple teams",
      "Long-term operational or business impact",
      "Explicit second-order effects and reversibility",
    ],
    disqualifyingInsufficiencies: [
      "Offers local optimization for an organization-scale problem",
      "Claims influence without a durable decision mechanism",
    ],
    followUpRules: [
      "Probe second-order organizational effects",
      "Ask what evidence would cause the strategy to change",
    ],
    limitations: [
      "Organizational influence claims require independent corroboration.",
    ],
  },
  {
    roleFamily: "genai-engineer",
    rolePatterns: [
      /\bgen(?:erative)?\s*ai\b/i,
      /\bllm\b/i,
      /\bmachine learning engineer\b/i,
    ],
    competencies: [
      "evaluation",
      "retrieval and grounding",
      "model reliability",
      "safety",
      "latency and cost",
    ],
    technicalEvidence: [
      "A versioned evaluation method and failure taxonomy",
      "Grounding, safety, or structured-output controls",
      "Latency, token, or cost measurements",
      "Fallback and human-oversight behavior",
    ],
    disqualifyingInsufficiencies: [
      "Uses anecdotal prompt quality as the only evaluation",
      "Treats model output as trusted application policy",
    ],
    followUpRules: [
      "Request a concrete evaluation dataset and metric",
      "Probe fallback behavior for invalid or unsafe model output",
    ],
    limitations: [
      "Model-specific expertise can drift faster than the rubric release cycle.",
    ],
  },
];

export const interviewRubrics: InterviewRubric[] = roleDefinitions.map(
  (definition) =>
    InterviewRubricSchema.parse({
      id: `${definition.roleFamily}-interview`,
      version: RUBRIC_REGISTRY_VERSION,
      roleFamily: definition.roleFamily,
      supportedSeniorities: [
        "Entry-level",
        "Mid-level",
        "Senior",
        "Staff",
        "Principal",
      ],
      competencies: definition.competencies,
      dimensions: dimensions(definition.technicalEvidence),
      disqualifyingInsufficiencies: definition.disqualifyingInsufficiencies,
      followUpRules: definition.followUpRules,
      confidenceCalculation:
        "Confidence combines evidence sufficiency, answer relevance, and agreement between independently scored dimensions; it is not candidate personality confidence.",
      limitations: [
        ...definition.limitations,
        "Pronunciation is unavailable without validated acoustic evidence.",
        "The rubric supports coaching and structured human review, not autonomous hiring.",
      ],
    }),
);

const fallbackRoleFamily: RoleFamily = "backend-engineer";

export function resolveRoleFamily(role: string): RoleFamily {
  return (
    roleDefinitions.find((definition) =>
      definition.rolePatterns.some((pattern) => pattern.test(role)),
    )?.roleFamily ?? fallbackRoleFamily
  );
}

export function resolveInterviewRubric(
  turn: Pick<InterviewTurn, "role">,
): InterviewRubric {
  const roleFamily = resolveRoleFamily(turn.role);
  const rubric = interviewRubrics.find(
    (candidate) => candidate.roleFamily === roleFamily,
  );
  if (!rubric) throw new Error(`RUBRIC_NOT_FOUND:${roleFamily}`);
  return rubric;
}
