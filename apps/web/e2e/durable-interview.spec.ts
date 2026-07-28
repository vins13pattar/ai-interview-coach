import { expect, test } from "@playwright/test";

const candidateAnswer =
  "First, I would define the availability and latency objectives, then test the database and queue failure modes. In a previous system, that process reduced p95 latency by 38 percent while preserving an idempotent recovery path.";

test("persists, resumes, completes, exports, and deletes an interview", async ({
  page,
}) => {
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
  await expect(page.getByText("Turn 2 / 5")).toBeVisible();

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
      await expect(page.getByText(`Turn ${turn + 1} / 5`)).toBeVisible();
    }
  }

  await expect(page.getByText("Interview complete")).toBeVisible();
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
