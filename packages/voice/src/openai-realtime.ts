import { z } from "zod";

import { classifyMediaError } from "./devices";
import type {
  VoiceAdapter,
  VoiceEventListener,
  VoiceSessionConfig,
  VoiceStatus,
} from "./types";

const RealtimeEventSchema = z
  .object({
    type: z.string(),
    item_id: z.string().optional(),
    response_id: z.string().optional(),
    transcript: z.string().optional(),
    delta: z.string().optional(),
    error: z
      .object({
        message: z.string().optional(),
      })
      .optional(),
    response: z
      .object({
        id: z.string().optional(),
        status: z.string().optional(),
      })
      .optional(),
  })
  .passthrough();

const connectionTimeoutMs = 15_000;

export class OpenAiRealtimeWebRtcAdapter implements VoiceAdapter {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private localStream: MediaStream | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private responseInProgress = false;
  private questionRequestedAt: number | null = null;
  private firstAudioObserved = false;
  private currentStatus: VoiceStatus = "idle";

  constructor(private readonly onEvent: VoiceEventListener) {}

  get status(): VoiceStatus {
    return this.currentStatus;
  }

  private setStatus(status: VoiceStatus): void {
    this.currentStatus = status;
    this.onEvent({ type: "status.changed", status });
  }

  async connect(config: VoiceSessionConfig): Promise<void> {
    if (
      !globalThis.RTCPeerConnection ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      this.setStatus("error");
      this.onEvent({
        type: "error",
        code: "unsupported",
        message:
          "This browser does not support secure WebRTC microphone sessions.",
        recoverable: false,
      });
      return;
    }

    this.close();
    this.setStatus("requesting_permission");
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(config.deviceId ? { deviceId: { exact: config.deviceId } } : {}),
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      this.setStatus("connecting");
      const peerConnection = new RTCPeerConnection();
      this.peerConnection = peerConnection;
      this.audioElement = new Audio();
      this.audioElement.autoplay = true;

      peerConnection.ontrack = (event) => {
        const stream = event.streams[0];
        if (!stream || !this.audioElement) return;
        this.audioElement.srcObject = stream;
        void this.audioElement.play().catch(() => {
          this.onEvent({
            type: "error",
            code: "playback_blocked",
            message: "Select Enable audio to hear the interviewer.",
            recoverable: true,
          });
        });
      };
      peerConnection.onconnectionstatechange = () => {
        if (
          peerConnection.connectionState === "failed" ||
          peerConnection.connectionState === "disconnected"
        ) {
          this.setStatus("recovering");
          this.onEvent({
            type: "error",
            code: "connection_failed",
            message:
              "The voice connection was interrupted. Retry or continue with text.",
            recoverable: true,
          });
        }
        if (peerConnection.connectionState === "connected") {
          this.setStatus("ready");
        }
      };

      for (const track of this.localStream.getTracks()) {
        peerConnection.addTrack(track, this.localStream);
      }

      const dataChannel = peerConnection.createDataChannel("oai-events");
      this.dataChannel = dataChannel;
      dataChannel.onmessage = (event) => this.handleServerEvent(event.data);

      const dataChannelReady = new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(
          () => reject(new Error("VOICE_CONNECTION_TIMEOUT")),
          connectionTimeoutMs,
        );
        dataChannel.onopen = () => {
          window.clearTimeout(timeout);
          resolve();
        };
        dataChannel.onerror = () => {
          window.clearTimeout(timeout);
          reject(new Error("VOICE_DATA_CHANNEL_FAILED"));
        };
      });

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      const response = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${config.clientSecret}`,
          "Content-Type": "application/sdp",
        },
      });
      if (!response.ok) {
        throw new Error(`VOICE_PROVIDER_${response.status}`);
      }
      await peerConnection.setRemoteDescription({
        type: "answer",
        sdp: await response.text(),
      });
      await dataChannelReady;
      this.setStatus("ready");
      this.speakQuestion(config.initialQuestion);
    } catch (error) {
      const mediaError = classifyMediaError(error);
      this.close();
      this.setStatus("error");
      this.onEvent({ type: "error", ...mediaError });
    }
  }

  speakQuestion(question: string): void {
    if (!this.dataChannel || this.dataChannel.readyState !== "open") return;
    this.firstAudioObserved = false;
    this.questionRequestedAt = performance.now();
    this.dataChannel.send(
      JSON.stringify({
        type: "response.create",
        response: {
          output_modalities: ["audio"],
          instructions: [
            "You are the interviewer voice.",
            "Read the supplied question exactly once, naturally and concisely.",
            "Do not answer the question and do not add commentary.",
            `Question: ${question}`,
          ].join(" "),
        },
      }),
    );
  }

  setMicrophoneMuted(muted: boolean): void {
    for (const track of this.localStream?.getAudioTracks() ?? []) {
      track.enabled = !muted;
    }
  }

  async resumeOutput(): Promise<void> {
    if (!this.audioElement) return;
    this.audioElement.muted = false;
    await this.audioElement.play();
  }

  close(): void {
    for (const track of this.localStream?.getTracks() ?? []) track.stop();
    this.localStream = null;
    this.dataChannel?.close();
    this.dataChannel = null;
    this.peerConnection?.close();
    this.peerConnection = null;
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.srcObject = null;
    }
    this.audioElement = null;
    this.responseInProgress = false;
    if (this.currentStatus !== "idle") this.setStatus("closed");
  }

  private send(event: Record<string, unknown>): void {
    if (this.dataChannel?.readyState === "open") {
      this.dataChannel.send(JSON.stringify(event));
    }
  }

  private handleServerEvent(raw: unknown): void {
    let value: unknown = raw;
    if (typeof raw === "string") {
      try {
        value = JSON.parse(raw) as unknown;
      } catch {
        return;
      }
    }
    const parsed = RealtimeEventSchema.safeParse(value);
    if (!parsed.success) return;
    const event = parsed.data;

    switch (event.type) {
      case "input_audio_buffer.speech_started":
        this.setStatus("listening");
        this.onEvent({ type: "speech.started", atMs: performance.now() });
        if (this.responseInProgress) {
          if (this.audioElement) this.audioElement.muted = true;
          this.send({ type: "response.cancel" });
          this.send({ type: "output_audio_buffer.clear" });
          this.onEvent({
            type: "interruption.requested",
            reason:
              "Candidate started speaking during the interviewer response.",
          });
        }
        break;
      case "input_audio_buffer.speech_stopped":
        this.onEvent({ type: "speech.stopped", atMs: performance.now() });
        break;
      case "conversation.item.input_audio_transcription.completed":
        if (event.transcript?.trim()) {
          this.onEvent({
            type: "transcript.final",
            text: event.transcript.trim(),
            itemId: event.item_id ?? crypto.randomUUID(),
          });
        }
        break;
      case "response.created":
        this.responseInProgress = true;
        this.setStatus("speaking");
        this.onEvent({
          type: "interviewer.started",
          responseId: event.response?.id ?? event.response_id ?? "unknown",
        });
        break;
      case "response.output_audio_transcript.delta":
        if (!this.firstAudioObserved && this.questionRequestedAt !== null) {
          this.firstAudioObserved = true;
          this.onEvent({
            type: "latency.measured",
            name: "question_to_audio",
            durationMs: Math.round(
              performance.now() - this.questionRequestedAt,
            ),
          });
        }
        if (event.delta) {
          this.onEvent({
            type: "interviewer.transcript.delta",
            delta: event.delta,
          });
        }
        break;
      case "response.output_audio_transcript.done":
        this.onEvent({
          type: "interviewer.transcript.final",
          transcript: event.transcript ?? "",
        });
        break;
      case "response.done": {
        this.responseInProgress = false;
        if (this.audioElement) this.audioElement.muted = false;
        this.setStatus("ready");
        const status = event.response?.status;
        this.onEvent({
          type: "interviewer.stopped",
          responseId: event.response?.id ?? event.response_id ?? "unknown",
          cancelled: status === "cancelled",
        });
        break;
      }
      case "error":
        this.onEvent({
          type: "error",
          code: "provider_error",
          message:
            event.error?.message ??
            "The voice provider reported a recoverable error.",
          recoverable: true,
        });
        break;
      default:
        break;
    }
  }
}
