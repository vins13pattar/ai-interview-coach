"use client";

import {
  type Difficulty,
  type InterviewTurnResult,
  type ProviderConnection,
  type RecruiterReport,
  type SessionDetail,
  type SessionSummary,
  type SessionTurnResponse,
  type TranscriptTurn,
} from "@interview-coach/contracts";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

type Stage = "setup" | "interview" | "report";

const initialQuestion =
  "Tell me about the most consequential system design decision you have made and how you measured its impact.";

const scoreLabels = {
  confidence: "Confidence",
  pronunciation: "Pronunciation",
  communication: "Communication",
  technicalDepth: "Technical depth",
} as const;

export function InterviewStudio() {
  const [stage, setStage] = useState<Stage>("setup");
  const [role, setRole] = useState("Software Engineer");
  const [seniority, setSeniority] = useState("Senior");
  const [focusText, setFocusText] = useState(
    "System design, distributed systems, leadership",
  );
  const [provider, setProvider] = useState<"demo" | "openai">("demo");
  const [apiKey, setApiKey] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("intermediate");
  const [question, setQuestion] = useState(initialQuestion);
  const [answer, setAnswer] = useState("");
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [lastResult, setLastResult] = useState<InterviewTurnResult | null>(
    null,
  );
  const [report, setReport] = useState<RecruiterReport | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [savedSessions, setSavedSessions] = useState<SessionSummary[]>([]);
  const [durableAvailable, setDurableAvailable] = useState(false);
  const [encryptedConnectionsAvailable, setEncryptedConnectionsAvailable] =
    useState(false);
  const [storedOpenAiConnected, setStoredOpenAiConnected] = useState(false);
  const [saveApiKey, setSaveApiKey] = useState(false);
  const [error, setError] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isPending, startTransition] = useTransition();
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);

  const focusAreas = useMemo(
    () =>
      focusText
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    [focusText],
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/sessions", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as { sessions: SessionSummary[] };
      })
      .then((body) => {
        if (cancelled || !body) return;
        setDurableAvailable(true);
        setSavedSessions(body.sessions);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/provider-connections", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as {
          available: boolean;
          connections: ProviderConnection[];
        };
      })
      .then((body) => {
        if (cancelled || !body) return;
        setEncryptedConnectionsAvailable(body.available);
        setStoredOpenAiConnected(
          body.connections.some(
            (connection) => connection.provider === "openai",
          ),
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const applySession = (session: SessionDetail) => {
    setSessionId(session.id);
    setRole(session.role);
    setSeniority(session.seniority);
    setFocusText(session.focusAreas.join(", "));
    setProvider(session.provider);
    setDifficulty(session.currentDifficulty);
    setQuestion(session.currentQuestion);
    setTurns(session.turns);
    setReport(session.report);
    setLastResult(null);
    setAnswer("");
    setStage(
      session.status === "completed" && session.report ? "report" : "interview",
    );
  };

  const refreshSavedSessions = async () => {
    const response = await fetch("/api/v1/sessions", { cache: "no-store" });
    if (!response.ok) return;
    const body = (await response.json()) as { sessions: SessionSummary[] };
    setSavedSessions(body.sessions);
  };

  const startInterview = () => {
    setError("");
    if (!role.trim() || focusAreas.length === 0) {
      setError("Add a role and at least one focus area.");
      return;
    }
    if (
      provider === "openai" &&
      !storedOpenAiConnected &&
      !apiKey.startsWith("sk-")
    ) {
      setError("Add a valid OpenAI API key or use the local demo evaluator.");
      return;
    }
    if (provider === "openai" && apiKey && !apiKey.startsWith("sk-")) {
      setError("The OpenAI API key must start with sk-.");
      return;
    }

    if (!durableAvailable) {
      setSessionId(null);
      setQuestion(
        `You are interviewing for a ${seniority} ${role} role. Tell me about the most consequential ${focusAreas[0]} decision you have made and how you measured its impact.`,
      );
      setStage("interview");
      return;
    }

    startTransition(async () => {
      try {
        if (provider === "openai" && apiKey && saveApiKey) {
          const connectionResponse = await fetch(
            "/api/v1/provider-connections",
            {
              method: "PUT",
              headers: {
                "content-type": "application/json",
                "x-interview-coach-client": "web",
              },
              body: JSON.stringify({ provider: "openai", apiKey }),
            },
          );
          if (!connectionResponse.ok) {
            const connectionBody = (await connectionResponse.json()) as {
              error?: string;
            };
            throw new Error(
              connectionBody.error ?? "Could not save the provider connection.",
            );
          }
          setStoredOpenAiConnected(true);
        }

        const response = await fetch("/api/v1/sessions", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-interview-coach-client": "web",
          },
          body: JSON.stringify({
            role,
            seniority,
            focusAreas,
            difficulty,
            provider,
          }),
        });
        const body = (await response.json()) as
          SessionDetail | { error: string };
        if (!response.ok || "error" in body) {
          throw new Error(
            "error" in body ? body.error : "Could not create the session.",
          );
        }
        applySession(body);
        await refreshSavedSessions();
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Could not start interview.",
        );
      }
    });
  };

  const removeStoredOpenAiConnection = () => {
    startTransition(async () => {
      try {
        const response = await fetch(
          "/api/v1/provider-connections?provider=openai",
          {
            method: "DELETE",
            headers: { "x-interview-coach-client": "web" },
          },
        );
        if (!response.ok) {
          const body = (await response.json()) as { error?: string };
          throw new Error(body.error ?? "Could not remove the connection.");
        }
        setStoredOpenAiConnected(false);
        setSaveApiKey(false);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Could not remove the connection.",
        );
      }
    });
  };

  const resumeSession = (savedSession: SessionSummary) => {
    startTransition(async () => {
      try {
        if (savedSession.status === "paused") {
          const resumeResponse = await fetch(
            `/api/v1/sessions/${savedSession.id}/resume`,
            {
              method: "POST",
              headers: { "x-interview-coach-client": "web" },
            },
          );
          if (!resumeResponse.ok) {
            const body = (await resumeResponse.json()) as { error?: string };
            throw new Error(body.error ?? "Could not resume the interview.");
          }
        }
        const response = await fetch(`/api/v1/sessions/${savedSession.id}`, {
          cache: "no-store",
        });
        const body = (await response.json()) as
          SessionDetail | { error: string };
        if (!response.ok || "error" in body) {
          throw new Error(
            "error" in body ? body.error : "Could not load the interview.",
          );
        }
        applySession(body);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Could not load interview.",
        );
      }
    });
  };

  const pauseInterview = () => {
    if (!sessionId) {
      setStage("setup");
      return;
    }
    startTransition(async () => {
      try {
        const response = await fetch(`/api/v1/sessions/${sessionId}/pause`, {
          method: "POST",
          headers: { "x-interview-coach-client": "web" },
        });
        if (!response.ok) {
          const body = (await response.json()) as { error?: string };
          throw new Error(body.error ?? "Could not pause the interview.");
        }
        await refreshSavedSessions();
        setStage("setup");
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Could not pause interview.",
        );
      }
    });
  };

  const deleteCurrentSession = () => {
    if (!sessionId) return;
    startTransition(async () => {
      try {
        const response = await fetch(`/api/v1/sessions/${sessionId}`, {
          method: "DELETE",
          headers: { "x-interview-coach-client": "web" },
        });
        if (!response.ok) {
          const body = (await response.json()) as { error?: string };
          throw new Error(body.error ?? "Could not delete the interview.");
        }
        setSessionId(null);
        setTurns([]);
        setReport(null);
        setLastResult(null);
        setStage("setup");
        await refreshSavedSessions();
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Could not delete interview.",
        );
      }
    });
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }
    const Recognition =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      setError(
        "Speech recognition is unavailable in this browser. You can type your answer or use current Chrome/Edge.",
      );
      return;
    }
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => {
      setIsListening(false);
      setError("Microphone transcription stopped. Check browser permission.");
    };
    recognition.onresult = (event) => {
      let transcript = "";
      for (
        let index = event.resultIndex;
        index < event.results.length;
        index += 1
      ) {
        transcript += event.results[index]?.[0]?.transcript ?? "";
      }
      if (transcript) {
        setAnswer((current) => `${current} ${transcript}`.trim());
      }
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  const submitAnswer = () => {
    setError("");
    if (answer.trim().length < 20) {
      setError(
        "Give the interviewer a little more signal—at least 20 characters.",
      );
      return;
    }

    startTransition(async () => {
      try {
        let body: InterviewTurnResult;
        let durableReport: RecruiterReport | null = null;

        if (sessionId) {
          idempotencyKeyRef.current ??= crypto.randomUUID();
          const response = await fetch(`/api/v1/sessions/${sessionId}/turns`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "idempotency-key": idempotencyKeyRef.current,
              "x-interview-coach-client": "web",
              ...(provider === "openai" && apiKey
                ? { "x-provider-api-key": apiKey }
                : {}),
            },
            body: JSON.stringify({ answer }),
          });
          const responseBody = (await response.json()) as
            SessionTurnResponse | { error: string };
          if (!response.ok || "error" in responseBody) {
            throw new Error(
              "error" in responseBody
                ? responseBody.error
                : "Interview turn failed.",
            );
          }
          body = responseBody.result;
          durableReport = responseBody.report;
          idempotencyKeyRef.current = null;
        } else {
          const response = await fetch("/api/interviews/turn", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              ...(provider === "openai" && apiKey
                ? { "x-provider-api-key": apiKey }
                : {}),
            },
            body: JSON.stringify({
              questionId: `q-${turns.length + 1}`,
              question,
              answer,
              role,
              seniority,
              focusAreas,
              difficulty,
              provider,
              turnNumber: turns.length + 1,
            }),
          });
          const responseBody = (await response.json()) as
            InterviewTurnResult | { error: string };
          if (!response.ok || "error" in responseBody) {
            throw new Error(
              "error" in responseBody
                ? responseBody.error
                : "Interview turn failed.",
            );
          }
          body = responseBody;
        }

        const completedTurn: TranscriptTurn = {
          id: `q-${turns.length + 1}`,
          question,
          answer,
          difficulty,
          evaluation: body.evaluation,
        };
        const nextTurns = [...turns, completedTurn];
        setTurns(nextTurns);
        setLastResult(body);
        setDifficulty(body.nextDifficulty);
        setQuestion(body.nextQuestion);
        setAnswer("");

        if (body.completed) {
          if (durableReport) {
            setReport(durableReport);
            await refreshSavedSessions();
          } else {
            const reportResponse = await fetch("/api/reports", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                role,
                seniority,
                focusAreas,
                turns: nextTurns,
              }),
            });
            if (!reportResponse.ok) {
              throw new Error("Report generation failed.");
            }
            setReport((await reportResponse.json()) as RecruiterReport);
          }
          setStage("report");
        }
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "Something went wrong.",
        );
      }
    });
  };

  if (stage === "setup") {
    return (
      <div className="studio-shell setup-grid">
        <div className="setup-copy">
          <span className="step-label">01 / Brief the interviewer</span>
          <h3 className="balanced-heading">What Are You Preparing For?</h3>
          <p>
            Tune the interview to the actual role. The coach will vary
            follow-ups and difficulty based on your answers.
          </p>
          <div className="privacy-note">
            <strong>BYOK privacy</strong>
            <span>
              Keys are tab-scoped by default and never written to browser
              storage or logs. A self-hoster can optionally enable encrypted
              server storage.
            </span>
          </div>
          {durableAvailable ? (
            <div className="saved-sessions">
              <div className="saved-sessions-heading">
                <strong>Private workspace</strong>
                <span>Saved in this self-hosted environment</span>
              </div>
              {savedSessions.length > 0 ? (
                <ul>
                  {savedSessions.slice(0, 4).map((savedSession) => (
                    <li key={savedSession.id}>
                      <button
                        type="button"
                        onClick={() => resumeSession(savedSession)}
                        disabled={isPending}
                      >
                        <span>
                          <strong>
                            {savedSession.seniority} {savedSession.role}
                          </strong>
                          <small>
                            {savedSession.turnCount} turns ·{" "}
                            {savedSession.status}
                          </small>
                        </span>
                        <i aria-hidden="true">→</i>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Your resumable interviews will appear here.</p>
              )}
            </div>
          ) : null}
        </div>
        <form
          className="setup-form"
          onSubmit={(event) => {
            event.preventDefault();
            startInterview();
          }}
        >
          <label>
            Target role
            <input
              value={role}
              onChange={(event) => setRole(event.target.value)}
              name="target-role"
              autoComplete="organization-title"
              minLength={2}
              required
            />
          </label>
          <div className="field-row">
            <label>
              Level
              <select
                value={seniority}
                onChange={(event) => setSeniority(event.target.value)}
                name="seniority"
                autoComplete="off"
              >
                <option>Entry-level</option>
                <option>Mid-level</option>
                <option>Senior</option>
                <option>Staff</option>
                <option>Principal</option>
              </select>
            </label>
            <label>
              Starting difficulty
              <select
                value={difficulty}
                onChange={(event) =>
                  setDifficulty(event.target.value as Difficulty)
                }
                name="difficulty"
                autoComplete="off"
              >
                <option value="foundation">Foundation</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
                <option value="expert">Expert</option>
              </select>
            </label>
          </div>
          <label>
            Focus areas
            <input
              value={focusText}
              onChange={(event) => setFocusText(event.target.value)}
              name="focus-areas"
              autoComplete="off"
              aria-describedby="focus-hint"
              required
            />
            <span id="focus-hint">Separate areas with commas.</span>
          </label>
          <fieldset>
            <legend>Evaluator</legend>
            <div className="provider-options">
              <label>
                <input
                  type="radio"
                  name="provider"
                  value="demo"
                  checked={provider === "demo"}
                  onChange={() => setProvider("demo")}
                />
                <span>
                  <strong>Local demo</strong>
                  <small>No key · deterministic</small>
                </span>
              </label>
              <label>
                <input
                  type="radio"
                  name="provider"
                  value="openai"
                  checked={provider === "openai"}
                  onChange={() => setProvider("openai")}
                />
                <span>
                  <strong>OpenAI</strong>
                  <small>Bring your own key</small>
                </span>
              </label>
            </div>
          </fieldset>
          {provider === "openai" ? (
            <div className="provider-key-field">
              <label htmlFor="openai-api-key">OpenAI API key</label>
              <input
                id="openai-api-key"
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                name="openai-api-key"
                placeholder={
                  storedOpenAiConnected ? "Stored connection available" : "sk-…"
                }
                autoComplete="off"
                spellCheck={false}
                required={!storedOpenAiConnected}
              />
              {storedOpenAiConnected ? (
                <span className="connection-status">
                  Encrypted OpenAI connection is ready.
                  <button
                    type="button"
                    onClick={removeStoredOpenAiConnection}
                    disabled={isPending}
                  >
                    Remove
                  </button>
                </span>
              ) : null}
              {encryptedConnectionsAvailable && apiKey ? (
                <label className="connection-opt-in">
                  <input
                    type="checkbox"
                    checked={saveApiKey}
                    onChange={(event) => setSaveApiKey(event.target.checked)}
                  />
                  <span>
                    Encrypt and save this key on this self-hosted server
                  </span>
                </label>
              ) : null}
            </div>
          ) : null}
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <button className="button button-primary" type="submit">
            Begin Interview <span aria-hidden="true">→</span>
          </button>
        </form>
      </div>
    );
  }

  if (stage === "report" && report) {
    return (
      <div className="studio-shell report-shell">
        <div className="report-kicker">
          <span>Interview complete</span>
          <span>{turns.length} adaptive turns</span>
        </div>
        <h3 className="balanced-heading">{report.title}</h3>
        <p className="recommendation">{report.recommendation}</p>
        <p className="report-summary">{report.summary}</p>
        <ScorePanel scores={report.scores} />
        <div className="report-columns">
          <div>
            <h4>Evidence-backed strengths</h4>
            <ul>
              {report.strengths.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4>Validation risks</h4>
            <ul>
              {report.risks.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
        <p className="report-disclaimer">{report.disclaimer}</p>
        <div className="report-actions">
          {sessionId ? (
            <a
              className="button button-secondary"
              href={`/api/v1/sessions/${sessionId}/export`}
              download
            >
              Export my data <span aria-hidden="true">↓</span>
            </a>
          ) : null}
          <button
            className="button button-secondary"
            type="button"
            onClick={() => {
              setStage("setup");
              setSessionId(null);
              setTurns([]);
              setReport(null);
              setLastResult(null);
            }}
          >
            Start Another Interview
          </button>
          {sessionId ? (
            <button
              className="button button-danger"
              type="button"
              onClick={deleteCurrentSession}
              disabled={isPending}
            >
              Delete session
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="studio-shell interview-shell">
      <div className="interview-header">
        <div>
          <span className="live-pill">
            <i aria-hidden="true" /> Interview in progress
          </span>
          <p>
            {role} · {seniority}
          </p>
        </div>
        <div className="turn-counter">
          <span>Turn {turns.length + 1} / 5</span>
          <strong>{difficulty}</strong>
        </div>
        <button
          className="session-action"
          type="button"
          onClick={pauseInterview}
          disabled={isPending}
        >
          {sessionId ? "Pause & save" : "Exit practice"}
        </button>
      </div>

      <div className="question-block">
        <span>Interviewer</span>
        <h3 className="balanced-heading">{question}</h3>
      </div>

      {lastResult ? (
        <div className="coach-strip" aria-live="polite">
          <span>
            {lastResult.evaluation.shouldInterrupt ? "Redirect" : "Coach note"}
          </span>
          <p>{lastResult.coachNote}</p>
        </div>
      ) : null}

      <div className="answer-area">
        <label htmlFor="candidate-answer">Your answer</label>
        <textarea
          id="candidate-answer"
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          placeholder="Speak naturally or type here. Explain the decision, trade-offs, and result…"
          rows={7}
          disabled={isPending}
        />
        <div className="answer-toolbar">
          <button
            className={`mic-button ${isListening ? "is-listening" : ""}`}
            type="button"
            onClick={toggleListening}
            aria-pressed={isListening}
          >
            <span aria-hidden="true">{isListening ? "■" : "●"}</span>
            {isListening ? "Stop listening" : "Use microphone"}
          </button>
          <span>
            {answer.trim() ? answer.trim().split(/\s+/).length : 0} words
          </span>
        </div>
      </div>

      {lastResult ? <ScorePanel scores={lastResult.evaluation.scores} /> : null}

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <button
        className="button button-primary submit-answer"
        type="button"
        onClick={submitAnswer}
        disabled={isPending}
      >
        {isPending ? "Analyzing Evidence…" : "Submit Answer"}
        <span aria-hidden="true">↗</span>
      </button>
    </div>
  );
}

function ScorePanel({
  scores,
}: {
  scores: {
    confidence: number;
    pronunciation: number | null;
    communication: number;
    technicalDepth: number;
  };
}) {
  return (
    <div className="score-panel" aria-label="Interview scores">
      {Object.entries(scores).map(([key, value]) => (
        <div className="score-row" key={key}>
          <span>{scoreLabels[key as keyof typeof scoreLabels]}</span>
          <div className="score-bar" aria-hidden="true">
            <i style={{ width: `${value ?? 0}%` }} />
          </div>
          <strong>{value === null ? "N/A" : value}</strong>
        </div>
      ))}
    </div>
  );
}

declare global {
  interface Window {
    SpeechRecognition?: typeof SpeechRecognition;
    webkitSpeechRecognition?: typeof SpeechRecognition;
  }

  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start(): void;
    stop(): void;
    onstart: (() => void) | null;
    onend: (() => void) | null;
    onerror: (() => void) | null;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
  }

  interface SpeechRecognitionEvent extends Event {
    resultIndex: number;
    results: {
      length: number;
      [index: number]: {
        [index: number]: { transcript: string };
      };
    };
  }

  const SpeechRecognition: {
    new (): SpeechRecognition;
  };
}
