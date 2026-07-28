import type { AudioInputDevice, VoiceErrorCode } from "./types";

export async function listAudioInputDevices(): Promise<AudioInputDevice[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((device) => device.kind === "audioinput")
    .map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label || `Microphone ${index + 1}`,
    }));
}

export function classifyMediaError(error: unknown): {
  code: VoiceErrorCode;
  message: string;
  recoverable: boolean;
} {
  const name =
    typeof error === "object" && error && "name" in error
      ? String(error.name)
      : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return {
      code: "permission_denied",
      message:
        "Microphone permission was denied. Allow access or continue with text.",
      recoverable: true,
    };
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return {
      code: "device_missing",
      message:
        "The selected microphone is unavailable. Choose another device or use text.",
      recoverable: true,
    };
  }
  if (name === "NotReadableError" || name === "AbortError") {
    return {
      code: "device_busy",
      message:
        "The microphone is busy or could not start. Close other audio apps and retry.",
      recoverable: true,
    };
  }
  return {
    code: "connection_failed",
    message: "Live voice could not start. Retry or continue with text.",
    recoverable: true,
  };
}
