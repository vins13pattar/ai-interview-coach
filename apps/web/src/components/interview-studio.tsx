"use client";

import {
  type Difficulty,
  type InterviewTurnResult,
  type TranscriptTurn,
} from "@interview-coach/contracts";
import { useMemo, useRef, useState, useTransition } from "react";

type Stage = "setup" | "interview" | "report";

type Report = {
  title: string;
  recommendation: string;
  summary: string;
  scores: {
    confidence: number;
    communication: number;
    technicalDepth: number;
    pronunciation: number | null;
  };
  strengths: string[];
  risks: string[];
  disclaimer: string;
};

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
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isPending, startTransition] = useTransition();
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const focusAreas = useMemo(
    () =>
      focusText
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    [focusText],
  );

  const startInterview = () => {
    setError("");
    if (!role.trim() || focusAreas.length === 0) {
      setError("Add a role and at least one focus area.");
      return;
    }
    if (provider === "openai" && !apiKey.startsWith("sk-")) {
      setError("Add a valid OpenAI API key or use the local demo evaluator.");
      return;
    }
    setQuestion(
      `You are interviewing for a ${seniority} ${role} role. Tell me about the most consequential ${focusAreas[0]} decision you have made and how you measured its impact.`,
    );
    setStage("interview");
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
        const body = (await response.json()) as
          InterviewTurnResult | { error: string };
        if (!response.ok || "error" in body) {
          throw new Error(
            "error" in body ? body.error : "Interview turn failed.",
          );
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
          if (!reportResponse.ok) throw new Error("Report generation failed.");
          setReport((await reportResponse.json()) as Report);
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
              Keys stay in memory for this page and are not written to browser
              storage or application logs. Use a short-lived provider token
              where available.
            </span>
          </div>
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
            <label>
              OpenAI API key
              <input
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                name="openai-api-key"
                placeholder="sk-…"
                autoComplete="off"
                spellCheck={false}
                required
              />
            </label>
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
        <button
          className="button button-secondary"
          type="button"
          onClick={() => {
            setStage("setup");
            setTurns([]);
            setReport(null);
            setLastResult(null);
          }}
        >
          Start Another Interview
        </button>
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
