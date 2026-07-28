import { z } from "zod";

const OpenAiClientSecretResponseSchema = z.object({
  value: z.string().min(1),
  expires_at: z.number().int().positive(),
});

const RuntimeOptionSchema = z
  .string()
  .regex(/^[a-zA-Z0-9._-]+$/)
  .max(100);

export function buildOpenAiRealtimeSessionRequest(input: {
  model: string;
  voice: string;
  role: string;
  seniority: string;
  focusAreas: string[];
}): Record<string, unknown> {
  const model = RuntimeOptionSchema.parse(input.model);
  const voice = RuntimeOptionSchema.parse(input.voice);
  return {
    session: {
      type: "realtime",
      model,
      instructions: [
        `Run a respectful ${input.seniority} ${input.role} practice interview.`,
        `Focus on ${input.focusAreas.join(", ")}.`,
        "The application controls question progression and scoring.",
        "Only speak when the application sends a response.create event.",
        "Never make an employment decision or infer protected traits.",
      ].join(" "),
      output_modalities: ["audio"],
      audio: {
        input: {
          noise_reduction: { type: "near_field" },
          transcription: {
            model: "gpt-4o-mini-transcribe",
            language: "en",
            prompt:
              "Technical interview answer with software engineering terms.",
          },
          turn_detection: {
            type: "semantic_vad",
            eagerness: "medium",
            create_response: false,
            interrupt_response: true,
          },
        },
        output: {
          voice,
          speed: 1,
        },
      },
    },
  };
}

export function parseOpenAiClientSecretResponse(input: unknown): {
  value: string;
  expiresAt: number;
} {
  const parsed = OpenAiClientSecretResponseSchema.parse(input);
  return {
    value: parsed.value,
    expiresAt: parsed.expires_at,
  };
}
