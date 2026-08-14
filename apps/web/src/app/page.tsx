import { AccountControls } from "@/components/account-controls";
import { InterviewStudio } from "@/components/interview-studio";

const scoreDimensions = [
  ["01", "Confidence", "How decisively you frame choices and outcomes."],
  ["02", "Communication", "Structure, clarity, relevance, and concision."],
  [
    "03",
    "Technical depth",
    "Reasoning, constraints, trade-offs, and evidence.",
  ],
  [
    "04",
    "Pronunciation",
    "Acoustic clarity when a speech provider is enabled.",
  ],
] as const;

export default function Home() {
  return (
    <main id="main-content">
      <a className="skip-link" href="#studio">
        Skip to Practice Room
      </a>
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="Interview Coach home">
          <span className="wordmark-dot" aria-hidden="true" />
          Interview Coach
        </a>
        <nav aria-label="Primary navigation">
          <a href="#method">Method</a>
          <a href="#studio">Practice</a>
          <a
            href="https://github.com/vins13pattar/ai-interview-coach"
            target="_blank"
            rel="noreferrer"
          >
            GitHub ↗
          </a>
        </nav>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">Open source · Adaptive · Evidence-backed</p>
          <h1 className="balanced-heading">
            The interview
            <span>that listens back.</span>
          </h1>
          <p className="hero-lede">
            Speak naturally. Get challenged. Watch the interview change
            difficulty as you answer—and leave with a report a serious recruiter
            could use.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="#studio">
              Enter the practice room
              <span aria-hidden="true">↘</span>
            </a>
            <a className="text-link" href="#method">
              See how scoring works
            </a>
          </div>
        </div>
        <div
          className="signal-card"
          aria-label="Example live interview signals"
        >
          <div className="signal-topline">
            <span className="live-pill">
              <i aria-hidden="true" /> Live interview
            </span>
            <span>07:42</span>
          </div>
          <blockquote>
            “Why choose an event stream here instead of a simpler queue?”
          </blockquote>
          <div className="waveform" aria-hidden="true">
            {Array.from({ length: 31 }, (_, index) => (
              <i
                key={index}
                style={{
                  height: `${18 + ((index * 17) % 48)}%`,
                  animationDelay: `${index * -47}ms`,
                }}
              />
            ))}
          </div>
          <div className="difficulty-track">
            <span>Difficulty changed</span>
            <strong>Advanced ↑</strong>
          </div>
          <p className="interrupt-note">
            <span>Coach interruption</span>
            “Pause there. What failed first under load?”
          </p>
        </div>
      </section>

      <section className="proof-strip" aria-label="Product qualities">
        <p>Not a question playlist.</p>
        <p>Not a keyword counter.</p>
        <p>Not a black-box score.</p>
      </section>

      <section className="method" id="method">
        <div className="section-intro">
          <p className="eyebrow">A better signal</p>
          <h2 className="balanced-heading">Every Score Needs Receipts.</h2>
          <p>
            We separate what the model can observe from what it cannot.
            Text-only sessions never fabricate pronunciation scores. Every
            assessment links back to a moment in the interview.
          </p>
        </div>
        <div className="score-grid">
          {scoreDimensions.map(([number, title, description]) => (
            <article key={number}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="studio-section" id="studio">
        <div className="studio-heading">
          <p className="eyebrow">Practice room / BYOK alpha</p>
          <h2 className="balanced-heading">Start Before You Feel Ready.</h2>
          <p>
            The demo evaluator runs without an API key. Bring an OpenAI key for
            model-backed assessment; it is held in this browser tab and sent
            only for the request.
          </p>
        </div>
        <AccountControls />
        <InterviewStudio />
      </section>

      <footer>
        <div>
          <span className="wordmark-dot" aria-hidden="true" />
          Built in the open.
        </div>
        <p>
          Decision support—not an automated hiring decision. Candidate consent
          is a product requirement.
        </p>
      </footer>
    </main>
  );
}
