import { FormEvent, useState } from "react";

const examples = [
  "Update my resume, apply to two jobs, and do laundry",
  "I need to make a phone call I've been avoiding",
  "Everything feels like too much today",
];

export function App() {
  const [capture, setCapture] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!capture.trim()) return;
    setSubmitted(true);
  }

  return (
    <main className="shell">
      <section className="card" aria-labelledby="page-title">
        <p className="eyebrow">Weavance · working prototype</p>
        <h1 id="page-title">What’s occupying your mind?</h1>
        <p className="lede">
          Put it here without organizing it. We’ll find one place to begin.
        </p>

        {!submitted ? (
          <form onSubmit={handleSubmit}>
            <label htmlFor="capture" className="sr-only">
              Brain dump
            </label>
            <textarea
              id="capture"
              value={capture}
              onChange={(event) => setCapture(event.target.value)}
              placeholder={examples[0]}
              rows={7}
              autoFocus
            />
            <button type="submit">Help me choose</button>
          </form>
        ) : (
          <div className="recommendation" aria-live="polite">
            <p className="eyebrow">A manageable beginning</p>
            <h2>Take two minutes to pick the first item that has a real consequence.</h2>
            <p>
              This temporary planner keeps the interaction testable while the capture and
              recommendation APIs are built.
            </p>
            <div className="actions">
              <button type="button">Start</button>
              <button type="button" className="secondary">
                Make it smaller
              </button>
              <button type="button" className="quiet" onClick={() => setSubmitted(false)}>
                Not right now
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
