export type VoiceStatus =
  | "idle"
  | "requesting_permission"
  | "connecting"
  | "ready"
  | "listening"
  | "speaking"
  | "recovering"
  | "closed"
  | "error";

export type VoiceErrorCode =
  | "permission_denied"
  | "device_missing"
  | "device_busy"
  | "connection_failed"
  | "playback_blocked"
  | "provider_error"
  | "unsupported";

export type VoiceEvent =
  | { type: "status.changed"; status: VoiceStatus }
  | { type: "speech.started"; atMs: number }
  | { type: "speech.stopped"; atMs: number }
  | { type: "transcript.final"; text: string; itemId: string }
  | { type: "interviewer.started"; responseId: string }
  | { type: "interviewer.transcript.delta"; delta: string }
  | { type: "interviewer.transcript.final"; transcript: string }
  | { type: "interviewer.stopped"; responseId: string; cancelled: boolean }
  | { type: "interruption.requested"; reason: string }
  | { type: "latency.measured"; name: "question_to_audio"; durationMs: number }
  | {
      type: "error";
      code: VoiceErrorCode;
      message: string;
      recoverable: boolean;
    };

export type VoiceSessionConfig = {
  clientSecret: string;
  model: string;
  initialQuestion: string;
  deviceId?: string;
};

export type VoiceEventListener = (event: VoiceEvent) => void;

export interface VoiceAdapter {
  readonly status: VoiceStatus;
  connect(config: VoiceSessionConfig): Promise<void>;
  speakQuestion(question: string): void;
  setMicrophoneMuted(muted: boolean): void;
  resumeOutput(): Promise<void>;
  close(): void;
}

export type AudioInputDevice = {
  deviceId: string;
  label: string;
};
