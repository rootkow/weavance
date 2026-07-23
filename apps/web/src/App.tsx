import { FormEvent, useState } from "react";

import { createCapture } from "./api/captures";

type SubmissionState = "idle" | "submitting" | "success" | "error";

export function App() {
  const [capture, setCapture] = useState("");
  const [submissionState, setSubmissionState] = useState<SubmissionState>("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!capture.trim() || submissionState === "submitting") return;

    setSubmissionState("submitting");

    try {
      await createCapture(capture);
      setSubmissionState("success");
    } catch {
      setSubmissionState("error");
    }
  }

  function handleCaptureChange(value: string) {
    setCapture(value);
    if (submissionState === "error") {
      setSubmissionState("idle");
    }
  }

  function startAnotherCapture() {
    setCapture("");
    setSubmissionState("idle");
  }

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />

      <header className="site-header" aria-label="Weavance">
        <span className="brand-mark" aria-hidden="true">
          W
        </span>
        <span>Weavance</span>
      </header>

      <section className="capture-card" aria-labelledby="page-title">
        {submissionState === "success" ? (
          <div className="success-state" aria-live="polite">
            <div className="success-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" role="img">
                <path d="m6.75 12.75 3.1 3.1 7.4-7.7" />
              </svg>
            </div>
            <p className="eyebrow">Captured</p>
            <h1 id="page-title">Your thoughts are saved.</h1>
            <p className="lede">
              They’re ready for the next step. You can add another brain dump whenever it
              would be useful.
            </p>
            <button type="button" className="primary-button" onClick={startAnotherCapture}>
              Add another brain dump
            </button>
          </div>
        ) : (
          <>
            <div className="intro">
              <p className="eyebrow">A clear place to begin</p>
              <h1 id="page-title">What’s taking up space right now?</h1>
              <p className="lede">
                Write it as it comes—full sentences, fragments, or a list. We’ll help shape
                it into one manageable place to begin.
              </p>
            </div>

            <form className="capture-form" onSubmit={handleSubmit}>
              <div className="field-heading">
                <label htmlFor="capture">Brain dump</label>
                <span>Anything that comes to you</span>
              </div>
              <textarea
                id="capture"
                value={capture}
                onChange={(event) => handleCaptureChange(event.target.value)}
                placeholder={"Reply to the recruiter\nSchedule a dentist appointment\nFigure out dinner"}
                rows={9}
                disabled={submissionState === "submitting"}
                aria-describedby={
                  submissionState === "error"
                    ? "capture-guidance capture-error"
                    : "capture-guidance"
                }
                autoFocus
              />
              <div className="form-footer">
                <p id="capture-guidance">Fragments, lists, and full sentences all work.</p>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={!capture.trim() || submissionState === "submitting"}
                >
                  {submissionState === "submitting" ? (
                    <>
                      <span className="spinner" aria-hidden="true" />
                      Saving…
                    </>
                  ) : submissionState === "error" ? (
                    "Try saving again"
                  ) : (
                    <>
                      Save brain dump
                      <span className="button-arrow" aria-hidden="true">
                        →
                      </span>
                    </>
                  )}
                </button>
              </div>

              {submissionState === "error" && (
                <div id="capture-error" className="error-message" role="alert">
                  <span className="error-icon" aria-hidden="true">
                    !
                  </span>
                  <div>
                    <strong>Your words are still here.</strong>
                    <p>We couldn’t save them just yet. Try again when you’re ready.</p>
                  </div>
                </div>
              )}
            </form>

            <div className="preservation-note">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 10V8a4 4 0 0 1 8 0v2m-9 0h10v9H7z" />
              </svg>
              <span>Your original words are saved exactly as you write them.</span>
            </div>
          </>
        )}
      </section>

      <p className="footer-note">One step at a time.</p>
    </main>
  );
}
