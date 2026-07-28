# Accessibility Baseline

Status: implementation review only; not a WCAG certification.

Implemented:

- semantic labels for setup, answer, consent, device, and report controls;
- visible keyboard focus;
- text input remains available during voice sessions;
- text equivalents for listening, processing, interruption, and errors;
- `aria-live`/status regions for dynamic voice and degraded-provider states;
- reduced-motion CSS;
- responsive single-column layouts;
- pronunciation displayed as `N/A`/not assessed.

Verified in automated Chromium journeys:

- setup and durable text completion;
- report export and deletion;
- explicit voice consent remains disabled until both required choices are made.
- voice transcripts remain editable before scoring, with keyboard-accessible
  mute, leave, reconnect, and text fallback controls.

Still pending:

- full keyboard-only journey and focus-order assertions;
- screen-reader testing with VoiceOver/NVDA;
- automated and manual contrast audit;
- 200%/400% zoom and reflow;
- real-provider caption timing and transcript-correction usability;
- reconnect announcement validation with assistive technology;
- touch target review on real mobile devices;
- independent WCAG 2.2 AA audit.
