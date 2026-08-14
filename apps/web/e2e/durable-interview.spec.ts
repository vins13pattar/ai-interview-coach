import { expect, test } from "@playwright/test";

const candidateAnswer =
  "First, I would define the availability and latency objectives, then test the database and queue failure modes. In a previous system, that process reduced p95 latency by 38 percent while preserving an idempotent recovery path.";

const reportEvaluation = {
  scores: {
    confidence: 75,
    pronunciation: null,
    communication: 78,
    technicalDepth: 80,
  },
  evidence: ["The candidate described a measurable production outcome."],
  strengths: ["Connected the decision to evidence."],
  improvements: ["Explain the rejected alternative."],
  shouldInterrupt: false,
  interruptionReason: null,
  demonstratedConcepts: ["reliability"],
};

test("security: read-only discovery does not create a guest identity", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const sessions = await context.request.get("/api/v1/sessions");
  const connections = await context.request.get("/api/v1/provider-connections");

  expect(sessions.ok()).toBeTruthy();
  expect(connections.ok()).toBeTruthy();
  expect(sessions.headers()["set-cookie"]).toBeUndefined();
  expect(connections.headers()["set-cookie"]).toBeUndefined();
  await expect(sessions.json()).resolves.toMatchObject({ sessions: [] });
  await expect(connections.json()).resolves.toMatchObject({ connections: [] });
  await context.close();
});

test("security: retention cron rejects unauthenticated requests", async ({
  request,
}) => {
  const response = await request.get("/api/cron/retention");
  expect(response.status()).toBe(401);
  await expect(response.json()).resolves.toEqual({ error: "Unauthorized." });
});

test("registers, recovers, rotates, and deletes a pseudonymous account", async ({
  page,
}) => {
  await page.goto("/");
  const registrationPromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/account") &&
      response.request().method() === "POST",
  );
  await page.getByLabel("Display name").fill("Browser candidate");
  await page.getByRole("button", { name: "Get recovery kit" }).click();
  const registration = await registrationPromise;
  expect(registration.status()).toBe(201);
  const firstKit = (await registration.json()) as {
    profile: { accountHandle: string };
    recoveryCode: string;
  };
  await expect(
    page.getByText("Save this once-only recovery kit"),
  ).toBeVisible();
  await expect(
    page.getByRole("status").getByText(firstKit.profile.accountHandle),
  ).toBeVisible();

  await page.reload();
  await expect(page.getByText("Signed in as")).toBeVisible();
  const signOut = await page.request.post("/api/v1/account/sign-out", {
    headers: { "x-interview-coach-client": "web" },
  });
  expect(signOut.status()).toBe(204);
  await page.reload();
  await page.getByLabel("Account handle").fill(firstKit.profile.accountHandle);
  await page.getByLabel("Recovery code").fill(firstKit.recoveryCode);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Signed in as")).toBeVisible();

  const rotationPromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/account/recovery") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Rotate recovery code" }).click();
  const rotation = await rotationPromise;
  expect(rotation.ok()).toBeTruthy();
  const rotatedKit = (await rotation.json()) as { recoveryCode: string };
  expect(rotatedKit.recoveryCode).not.toBe(firstKit.recoveryCode);

  const deleted = await page.request.delete("/api/v1/account", {
    headers: { "x-interview-coach-client": "web" },
    data: {
      recoveryCode: rotatedKit.recoveryCode,
      confirmation: "DELETE MY ACCOUNT",
    },
  });
  expect(deleted.status()).toBe(204);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Register this workspace" }),
  ).toBeVisible();
});

test("security: oversized recruiter reports are rejected before parsing", async ({
  request,
}) => {
  const oversizedAnswer = "A".repeat(250_000);
  const response = await request.post("/api/reports", {
    headers: { "x-interview-coach-client": "web" },
    data: {
      role: "Platform Engineer",
      seniority: "Senior",
      focusAreas: ["reliability"],
      turns: Array.from({ length: 5 }, (_, index) => ({
        id: `q-${index + 1}`,
        question: "How did you validate the design under failure?",
        answer: oversizedAnswer,
        difficulty: "advanced",
        evaluation: reportEvaluation,
      })),
    },
  });

  expect(response.status()).toBe(413);
});

test("security: text dictation requires consent and stops on pause", async ({
  page,
}) => {
  await page.addInitScript(() => {
    class ControlledSpeechRecognition {
      continuous = false;
      interimResults = false;
      lang = "";
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onresult: (() => void) | null = null;

      start() {
        const state = window as typeof window & { dictationStarts?: number };
        state.dictationStarts = (state.dictationStarts ?? 0) + 1;
        this.onstart?.();
      }

      stop() {
        const state = window as typeof window & { dictationStops?: number };
        state.dictationStops = (state.dictationStops ?? 0) + 1;
        this.onend?.();
      }
    }

    Object.defineProperty(window, "SpeechRecognition", {
      configurable: true,
      value: ControlledSpeechRecognition,
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: /Begin Interview/ }).click();
  await page.getByRole("button", { name: "Use microphone" }).click();

  await expect(
    page.getByText("Consent before browser dictation"),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as typeof window & { dictationStarts?: number })
            .dictationStarts ?? 0,
      ),
    )
    .toBe(0);

  const agreeButton = page.getByRole("button", {
    name: "Agree & start dictation",
  });
  await expect(agreeButton).toBeDisabled();
  await page
    .getByLabel(/browser or operating-system speech service processing/i)
    .check();
  await page.getByLabel(/place the resulting transcript in my answer/i).check();
  await expect(agreeButton).toBeEnabled();
  await agreeButton.click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as typeof window & { dictationStarts?: number })
            .dictationStarts ?? 0,
      ),
    )
    .toBe(1);

  await page.getByRole("button", { name: "Pause & save" }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as typeof window & { dictationStops?: number })
            .dictationStops ?? 0,
      ),
    )
    .toBe(1);
});

test("persists, resumes, completes, exports, and deletes an interview", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "What Are You Preparing For?" }),
  ).toBeVisible();
  await expect(page.getByText("Private workspace")).toBeVisible();

  await page.getByLabel("Target role").fill("Platform Reliability Engineer");
  await page.getByLabel("Level").selectOption({ label: "Senior" });
  await page.getByRole("button", { name: /Begin Interview/ }).click();

  await expect(page.getByText("Interview in progress")).toBeVisible();
  await page.getByLabel("Your answer").fill(candidateAnswer);
  await page.getByRole("button", { name: /Submit Answer/ }).click();
  await expect(page.getByText("Turn 2 / 5")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Pause & save" }).click();
  await expect(
    page.getByRole("heading", { name: "What Are You Preparing For?" }),
  ).toBeVisible();
  await expect(page.getByText("1 turns · paused")).toBeVisible();

  await page.reload();
  await expect(page.getByText("1 turns · paused")).toBeVisible();
  await page
    .getByRole("button", { name: /Senior Platform Reliability Engineer/ })
    .click();
  await expect(page.getByText("Turn 2 / 5")).toBeVisible();

  for (let turn = 2; turn <= 5; turn += 1) {
    await page
      .getByLabel("Your answer")
      .fill(`${candidateAnswer} This is adaptive turn ${turn}.`);
    await page.getByRole("button", { name: /Submit Answer/ }).click();
    if (turn < 5) {
      await expect(page.getByText(`Turn ${turn + 1} / 5`)).toBeVisible({
        timeout: 15_000,
      });
    }
  }

  await expect(page.getByText("Interview complete")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText("5 adaptive turns")).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: /Export my data/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(
    /^interview-[0-9a-f-]{36}\.json$/,
  );

  await page.getByRole("button", { name: "Delete session" }).click();
  await expect(
    page.getByRole("heading", { name: "What Are You Preparing For?" }),
  ).toBeVisible();
  await expect(
    page.getByText("Your resumable interviews will appear here."),
  ).toBeVisible();
});

test("requires explicit consent before enabling live voice", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Target role").fill("Staff Platform Engineer");
  await page.getByRole("radio", { name: /Live voice beta/ }).check();
  await page
    .getByLabel("OpenAI API key")
    .fill("sk-test-browser-only-voice-consent-fixture");

  const sessionResponsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/sessions") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: /Begin Interview/ }).click();
  const session = (await (await sessionResponsePromise).json()) as {
    id: string;
  };

  await expect(
    page.getByText("Consent before microphone access"),
  ).toBeVisible();
  await expect(page.getByText(/does not retain raw audio/i)).toBeVisible();
  await expect(
    page.getByText(/Pronunciation is not acoustically scored/i),
  ).toBeVisible();

  const agreeButton = page.getByRole("button", { name: "Agree & start" });
  await expect(agreeButton).toBeDisabled();
  await page.getByLabel("I agree to OpenAI processing my live audio.").check();
  await expect(agreeButton).toBeDisabled();
  await page.getByLabel(/retain the transcript for scoring/).check();
  await expect(agreeButton).toBeEnabled();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(
    page.getByText("Consent before microphone access"),
  ).not.toBeVisible();

  const deleted = await page.request.delete(`/api/v1/sessions/${session.id}`, {
    headers: { "x-interview-coach-client": "web" },
  });
  expect(deleted.ok()).toBeTruthy();
});
