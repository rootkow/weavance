import { FormEvent, useEffect, useState } from "react";

import { createCapture, MAX_CAPTURE_CHARACTERS, type Capture } from "./api/captures";
import {
  confirmInterpretation,
  createInterpretation,
  type Interpretation,
  type ReviewedTask,
  type TaskProposal,
} from "./api/interpretations";
import {
  createRecommendation,
  getCurrentRecommendation,
  MAX_REENTRY_POINT_CHARACTERS,
  recordRecommendationEvent,
  type EpisodeEventType,
  type Recommendation,
  type ReentryCheckpoint,
} from "./api/recommendations";
import {
  listTasks,
  setTaskStatus,
  updateTaskContent,
  type Task,
  type TaskStatus,
} from "./api/tasks";

type Screen =
  | "loading"
  | "recommendation"
  | "active-commitment"
  | "checkpoint"
  | "outcome"
  | "capture"
  | "interpreting"
  | "review"
  | "saved"
  | "task-list";
type RequestState = "idle" | "submitting" | "error";
interface TaskEditDraft {
  taskId: string;
  actionId: string;
  title: string;
  actionDescription: string;
}

function toReviewedTask(task: TaskProposal): ReviewedTask {
  return {
    id: task.id,
    title: task.title,
    action_id: task.actions[0].id,
    action_description: task.actions[0].description,
  };
}

export function App() {
  const [captureText, setCaptureText] = useState("");
  const [capture, setCapture] = useState<Capture | null>(null);
  const [interpretation, setInterpretation] = useState<Interpretation | null>(null);
  const [reviewedTasks, setReviewedTasks] = useState<ReviewedTask[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [lastEpisodeEvent, setLastEpisodeEvent] = useState<EpisodeEventType | null>(null);
  const [recommendationRequestState, setRecommendationRequestState] =
    useState<RequestState>("idle");
  const [recommendationLoadFailed, setRecommendationLoadFailed] = useState(false);
  const [recommendationFollowsReview, setRecommendationFollowsReview] =
    useState(false);
  const [reentryPoint, setReentryPoint] = useState("");
  const [savedCheckpoint, setSavedCheckpoint] =
    useState<ReentryCheckpoint | null>(null);
  const [screen, setScreen] = useState<Screen>("loading");
  const [requestState, setRequestState] = useState<RequestState>("idle");
  const [taskListLoadFailed, setTaskListLoadFailed] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [taskUpdateFailed, setTaskUpdateFailed] = useState(false);
  const [taskEditDraft, setTaskEditDraft] = useState<TaskEditDraft | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    void listTasks(controller.signal)
      .then(async (savedTasks) => {
        setTasks(savedTasks);
        setTaskListLoadFailed(false);
        if (
          !savedTasks.some(
            (task) =>
              task.status === "active" &&
              task.actions.some((action) => action.status === "active"),
          )
        ) {
          setScreen("capture");
          return;
        }

        try {
          const current =
            (await getCurrentRecommendation(controller.signal)) ??
            (await createRecommendation(controller.signal));
          setRecommendation(current);
          setRecommendationLoadFailed(false);
          setScreen(
            current.state === "accepted" ? "active-commitment" : "recommendation",
          );
        } catch (error: unknown) {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setRecommendationLoadFailed(true);
          setScreen("capture");
        }
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setTaskListLoadFailed(true);
        setScreen("capture");
      });

    return () => controller.abort();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!captureText.trim() || requestState === "submitting") return;

    setRequestState("submitting");
    try {
      const savedCapture = await createCapture(captureText);
      setCapture(savedCapture);
      setScreen("interpreting");
      setRequestState("idle");
      await interpretCapture(savedCapture);
    } catch {
      setRequestState("error");
    }
  }

  async function interpretCapture(savedCapture: Capture) {
    setScreen("interpreting");
    setRequestState("submitting");
    try {
      const proposal = await createInterpretation(savedCapture);
      setInterpretation(proposal);
      setReviewedTasks(proposal.proposal.tasks.map(toReviewedTask));
      setScreen("review");
      setRequestState("idle");
    } catch {
      setRequestState("error");
    }
  }

  async function handleConfirmation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (interpretation === null || requestState === "submitting") return;

    setRequestState("submitting");
    try {
      await confirmInterpretation(interpretation, reviewedTasks);
    } catch {
      setRequestState("error");
      return;
    }

    setRequestState("idle");
    let savedTasks: Task[];
    try {
      savedTasks = await listTasks();
      setTasks(savedTasks);
      setTaskListLoadFailed(false);
    } catch {
      setTaskListLoadFailed(true);
      setScreen("saved");
      return;
    }

    if (reviewedTasks.length === 0) {
      setScreen("saved");
      return;
    }

    try {
      const nextRecommendation = await createRecommendation();
      setRecommendation(nextRecommendation);
      setRecommendationFollowsReview(true);
      setRecommendationLoadFailed(false);
      setScreen("recommendation");
    } catch {
      setRecommendationLoadFailed(true);
      setScreen("saved");
    }
  }

  function updateReviewedTask(
    taskId: string,
    field: "title" | "action_description",
    value: string,
  ) {
    setReviewedTasks((tasks) =>
      tasks.map((task) => (task.id === taskId ? { ...task, [field]: value } : task)),
    );
    if (requestState === "error") setRequestState("idle");
  }

  function removeReviewedTask(taskId: string) {
    setReviewedTasks((tasks) => tasks.filter((task) => task.id !== taskId));
    if (requestState === "error") setRequestState("idle");
  }

  function addReviewedTask() {
    setReviewedTasks((tasks) => [
      ...tasks,
      {
        id: crypto.randomUUID(),
        title: "",
        action_id: crypto.randomUUID(),
        action_description: "",
      },
    ]);
    if (requestState === "error") setRequestState("idle");
  }

  function startAnotherCapture() {
    setCaptureText("");
    setCapture(null);
    setInterpretation(null);
    setReviewedTasks([]);
    setRecommendationFollowsReview(false);
    setReentryPoint("");
    setSavedCheckpoint(null);
    setScreen("capture");
    setRequestState("idle");
  }

  async function respondToRecommendation(
    eventType: EpisodeEventType,
    checkpointEntryPoint?: string,
  ) {
    if (recommendation === null || recommendationRequestState === "submitting") return;

    setRecommendationRequestState("submitting");
    setRecommendationLoadFailed(false);
    try {
      const transition = await recordRecommendationEvent(
        recommendation.id,
        eventType,
        checkpointEntryPoint === undefined
          ? {}
          : { reentry_point: checkpointEntryPoint.trim() },
      );
      setLastEpisodeEvent(eventType);
      setSavedCheckpoint(transition.checkpoint);
      setRecommendationFollowsReview(false);
      if (transition.replacement !== null) {
        setRecommendation(transition.replacement);
        setScreen("recommendation");
      } else if (eventType === "accepted") {
        setRecommendation(transition.episode);
        setScreen("active-commitment");
      } else {
        setRecommendation(transition.episode);
        setScreen("outcome");
      }
      setRecommendationRequestState("idle");
    } catch {
      setRecommendationRequestState("error");
      setRecommendationLoadFailed(true);
    }
  }

  function beginProgressReport() {
    setReentryPoint("");
    setSavedCheckpoint(null);
    setRecommendationLoadFailed(false);
    setScreen("checkpoint");
  }

  function saveProgressCheckpoint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reentryPoint.trim()) return;
    void respondToRecommendation("progress_made", reentryPoint);
  }

  async function chooseAnotherRecommendation() {
    if (recommendationRequestState === "submitting") return;

    setRecommendationRequestState("submitting");
    setRecommendationLoadFailed(false);
    try {
      const nextRecommendation = await createRecommendation();
      setRecommendation(nextRecommendation);
      setLastEpisodeEvent(null);
      setSavedCheckpoint(null);
      setScreen(
        nextRecommendation.state === "accepted"
          ? "active-commitment"
          : "recommendation",
      );
      setRecommendationRequestState("idle");
    } catch {
      setRecommendationRequestState("error");
      setRecommendationLoadFailed(true);
    }
  }

  async function changeTaskStatus(task: Task, status: TaskStatus) {
    if (updatingTaskId !== null) return;
    setUpdatingTaskId(task.id);
    setTaskUpdateFailed(false);
    try {
      const updatedTask = await setTaskStatus(task.id, status);
      setTasks((currentTasks) =>
        updatedTask.status === "archived"
          ? currentTasks.filter((currentTask) => currentTask.id !== updatedTask.id)
          : currentTasks.map((currentTask) =>
              currentTask.id === updatedTask.id ? updatedTask : currentTask,
            ),
      );
      if (
        recommendation?.task_id === updatedTask.id &&
        recommendation.state === "proposed" &&
        updatedTask.status !== "active"
      ) {
        setRecommendation(null);
      }
    } catch {
      setTaskUpdateFailed(true);
    } finally {
      setUpdatingTaskId(null);
    }
  }

  function beginTaskEdit(task: Task) {
    const firstAction = task.actions[0];
    setTaskEditDraft({
      taskId: task.id,
      actionId: firstAction.id,
      title: task.title,
      actionDescription: firstAction.description,
    });
    setTaskUpdateFailed(false);
  }

  function updateTaskEditDraft(
    field: "title" | "actionDescription",
    value: string,
  ) {
    setTaskEditDraft((draft) => (draft === null ? null : { ...draft, [field]: value }));
    setTaskUpdateFailed(false);
  }

  async function saveTaskContent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      taskEditDraft === null ||
      updatingTaskId !== null ||
      !taskEditDraft.title.trim() ||
      !taskEditDraft.actionDescription.trim()
    ) {
      return;
    }

    setUpdatingTaskId(taskEditDraft.taskId);
    setTaskUpdateFailed(false);
    try {
      const updatedTask = await updateTaskContent(
        taskEditDraft.taskId,
        taskEditDraft.actionId,
        taskEditDraft.title,
        taskEditDraft.actionDescription,
      );
      setTasks((currentTasks) =>
        currentTasks.map((task) => (task.id === updatedTask.id ? updatedTask : task)),
      );
      setTaskEditDraft(null);
    } catch {
      setTaskUpdateFailed(true);
    } finally {
      setUpdatingTaskId(null);
    }
  }

  const confirmedTasks = tasks;
  const reviewIsValid = reviewedTasks.every(
    (task) => task.title.trim() && task.action_description.trim(),
  );
  const isOverwhelmedRecommendation =
    recommendation?.explanation_factors.some(
      (factor) =>
        factor.kind === "explicit_response" && factor.value === "overwhelmed",
    ) ?? false;
  const isReentryRecommendation =
    recommendation?.explanation_factors.some(
      (factor) => factor.kind === "reentry_checkpoint",
    ) ?? false;

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

      <section
        className={`capture-card ${screen === "review" ? "review-workspace" : ""}`}
        aria-labelledby="page-title"
      >
        {screen === "loading" && (
          <div className="processing-state" aria-live="polite">
            <div className="processing-orbit" aria-hidden="true">
              <span />
            </div>
            <p className="eyebrow">Picking up where you left off</p>
            <h1 id="page-title">Loading your task list…</h1>
          </div>
        )}

        {screen === "recommendation" && recommendation !== null && (
          <div className="recommendation-view" aria-live="polite">
            <div className="recommendation-intro">
              <div>
                <p className="eyebrow">
                  {isReentryRecommendation
                    ? "Pick up where you left off"
                    : recommendationFollowsReview
                      ? "That’s added. Here’s one place to begin"
                      : "Ready when you are"}
                </p>
                <h1 id="page-title">{recommendation.entry_point}</h1>
                <p className="recommendation-parent">
                  <span>For</span>
                  {recommendation.task_title}
                </p>
              </div>
              <span className="bounded-label">
                {isOverwhelmedRecommendation
                  ? "Only a preparation step"
                  : isReentryRecommendation
                    ? "A saved way back"
                    : "One bounded step"}
              </span>
            </div>

            <div className="stopping-card">
              <span>You’re done when</span>
              <p>{recommendation.stopping_condition}</p>
            </div>

            <div className="recommendation-reason">
              <span aria-hidden="true">i</span>
              <div>
                <strong>Why this?</strong>
                <p>{recommendation.reason}</p>
              </div>
            </div>

            {recommendationLoadFailed && (
              <div className="error-message" role="alert">
                <span className="error-icon" aria-hidden="true">
                  !
                </span>
                <div>
                  <strong>I couldn’t save that response.</strong>
                  <p>The recommendation has not changed. Try again when you’re ready.</p>
                </div>
              </div>
            )}

            <button
              type="button"
              className="primary-button recommendation-start"
              disabled={recommendationRequestState === "submitting"}
              onClick={() => void respondToRecommendation("accepted")}
            >
              {recommendationRequestState === "submitting" ? (
                <>
                  <span className="spinner" aria-hidden="true" />
                  Saving…
                </>
              ) : (
                <>
                  Start
                  <span className="button-arrow" aria-hidden="true">
                    →
                  </span>
                </>
              )}
            </button>

            {isOverwhelmedRecommendation ? (
              <button
                type="button"
                className="overwhelmed-button"
                disabled={recommendationRequestState === "submitting"}
                onClick={() => void respondToRecommendation("deferred")}
              >
                Pause here
              </button>
            ) : (
              <>
                <div
                  className="recommendation-alternatives"
                  role="group"
                  aria-label="Other responses"
                >
                  <button
                    type="button"
                    className="text-button"
                    disabled={recommendationRequestState === "submitting"}
                    onClick={() => void respondToRecommendation("resized")}
                  >
                    Make it smaller
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    disabled={recommendationRequestState === "submitting"}
                    onClick={() => void respondToRecommendation("swapped")}
                  >
                    Different task
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    disabled={recommendationRequestState === "submitting"}
                    onClick={() => void respondToRecommendation("deferred")}
                  >
                    Not right now
                  </button>
                </div>

                <button
                  type="button"
                  className="overwhelmed-button"
                  disabled={recommendationRequestState === "submitting"}
                  onClick={() => void respondToRecommendation("overwhelmed")}
                >
                  I’m overwhelmed
                </button>

                <div className="recommendation-navigation">
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setScreen("task-list")}
                  >
                    View all tasks
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    onClick={startAnotherCapture}
                  >
                    Add a brain dump
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {screen === "active-commitment" && recommendation !== null && (
          <div className="commitment-view" aria-live="polite">
            <p className="eyebrow">Your commitment</p>
            <h1 id="page-title">{recommendation.entry_point}</h1>
            <p className="recommendation-parent">
              <span>For</span>
              {recommendation.task_title}
            </p>

            <div className="stopping-card active-stopping-card">
              <span>You’re done when</span>
              <p>{recommendation.stopping_condition}</p>
            </div>

            <div className="outcome-prompt">
              <h2>What happened?</h2>
              <p>
                Choose only when you’re ready. Until then, Weavance won’t assume an
                outcome.
              </p>
            </div>

            {recommendationLoadFailed && (
              <div className="error-message" role="alert">
                <span className="error-icon" aria-hidden="true">
                  !
                </span>
                <div>
                  <strong>I couldn’t save that outcome.</strong>
                  <p>Your commitment is still here. Nothing was inferred.</p>
                </div>
              </div>
            )}

            <div className="outcome-grid">
              <button
                type="button"
                className="outcome-button outcome-button-primary"
                disabled={recommendationRequestState === "submitting"}
                onClick={() => void respondToRecommendation("done_for_now")}
              >
                <strong>Done for now</strong>
                <span>I reached this stopping point</span>
              </button>
              <button
                type="button"
                className="outcome-button"
                disabled={recommendationRequestState === "submitting"}
                onClick={beginProgressReport}
              >
                <strong>I made some progress</strong>
                <span>I started but stopped before the boundary</span>
              </button>
              <button
                type="button"
                className="outcome-button"
                disabled={recommendationRequestState === "submitting"}
                onClick={() => void respondToRecommendation("did_not_start")}
              >
                <strong>I didn’t get started</strong>
                <span>Record that honestly and choose again</span>
              </button>
              <button
                type="button"
                className="outcome-button"
                disabled={recommendationRequestState === "submitting"}
                onClick={() => void respondToRecommendation("keep_going")}
              >
                <strong>I want to keep going</strong>
                <span>Create another bounded commitment</span>
              </button>
            </div>

            <p className="commitment-note">
              Reporting an outcome does not mark “{recommendation.task_title}” complete.
            </p>
          </div>
        )}

        {screen === "checkpoint" && recommendation !== null && (
          <div className="checkpoint-view" aria-live="polite">
            <p className="eyebrow">Make returning easier</p>
            <h1 id="page-title">Where should you pick this back up?</h1>
            <p className="lede">
              Save one visible next move while it’s still fresh. This is optional—we
              won’t guess if you skip it.
            </p>

            {recommendationLoadFailed && (
              <div className="error-message" role="alert">
                <span className="error-icon" aria-hidden="true">
                  !
                </span>
                <div>
                  <strong>I couldn’t save your progress.</strong>
                  <p>Your note is still here. Nothing has been recorded yet.</p>
                </div>
              </div>
            )}

            <form className="checkpoint-form" onSubmit={saveProgressCheckpoint}>
              <div className="field-heading">
                <label htmlFor="reentry-point">Next place to begin</label>
                <span>Optional checkpoint</span>
              </div>
              <textarea
                id="reentry-point"
                value={reentryPoint}
                onChange={(event) => {
                  setReentryPoint(event.target.value);
                  if (recommendationRequestState === "error") {
                    setRecommendationRequestState("idle");
                    setRecommendationLoadFailed(false);
                  }
                }}
                placeholder="Open the draft and revise the next paragraph"
                rows={4}
                maxLength={MAX_REENTRY_POINT_CHARACTERS}
                disabled={recommendationRequestState === "submitting"}
                autoFocus
              />
              <p className="checkpoint-guidance">
                Keep it concrete and small. Up to {MAX_REENTRY_POINT_CHARACTERS} characters.
              </p>
              <div className="checkpoint-actions">
                <button
                  type="submit"
                  className="primary-button"
                  disabled={
                    !reentryPoint.trim() ||
                    recommendationRequestState === "submitting"
                  }
                >
                  {recommendationRequestState === "submitting"
                    ? "Saving…"
                    : "Save my place"}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={recommendationRequestState === "submitting"}
                  onClick={() => void respondToRecommendation("progress_made")}
                >
                  Skip for now
                </button>
              </div>
              <button
                type="button"
                className="text-button checkpoint-back"
                disabled={recommendationRequestState === "submitting"}
                onClick={() => {
                  setRecommendationLoadFailed(false);
                  setRecommendationRequestState("idle");
                  setScreen("active-commitment");
                }}
              >
                Back to outcome choices
              </button>
            </form>
          </div>
        )}

        {screen === "outcome" && recommendation !== null && lastEpisodeEvent !== null && (
          <div className="outcome-state" aria-live="polite">
            <div className="success-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="m6 12 4 4 8-8" />
              </svg>
            </div>
            <p className="eyebrow">Response saved</p>
            <h1 id="page-title">
              {lastEpisodeEvent === "done_for_now"
                ? "You met this stopping point."
                : lastEpisodeEvent === "progress_made"
                  ? savedCheckpoint === null
                    ? "Your progress is recorded."
                    : "Your way back is saved."
                  : lastEpisodeEvent === "did_not_start"
                    ? "Thanks for saying what happened."
                    : lastEpisodeEvent === "deferred"
                      ? "Okay. This can wait."
                      : "There isn’t another active task to offer."}
            </h1>
            <p className="lede">
              {lastEpisodeEvent === "done_for_now"
                ? `“Done for now” applies to this bounded commitment. “${recommendation.task_title}” remains open until you explicitly complete it.`
                : lastEpisodeEvent === "progress_made"
                  ? savedCheckpoint === null
                    ? `“${recommendation.task_title}” stays open. We won’t treat partial progress as completion.`
                    : `“${recommendation.task_title}” stays open. Next time, we’ll offer “${savedCheckpoint.entry_point}” as a way back in.`
                  : lastEpisodeEvent === "did_not_start"
                    ? "Nothing is counted as progress or failure. You can choose a different way in."
                    : lastEpisodeEvent === "deferred"
                      ? "This suggestion has been set aside without recording failure."
                      : "You can add another task, return to the current list, or pause here."}
            </p>

            {recommendationLoadFailed && (
              <div className="error-message" role="alert">
                <span className="error-icon" aria-hidden="true">
                  !
                </span>
                <div>
                  <strong>I couldn’t choose another starting point.</strong>
                  <p>Your saved response is still intact.</p>
                </div>
              </div>
            )}

            <div className="success-actions">
              <button
                type="button"
                className="primary-button"
                disabled={recommendationRequestState === "submitting"}
                onClick={() => void chooseAnotherRecommendation()}
              >
                {recommendationRequestState === "submitting"
                  ? "Choosing…"
                  : "Choose another starting point"}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setScreen("task-list")}
              >
                View all tasks
              </button>
              <button type="button" className="text-button" onClick={startAnotherCapture}>
                Add a brain dump
              </button>
            </div>
          </div>
        )}

        {screen === "capture" && (
          <>
            <div className="intro">
              <p className="eyebrow">A clear place to begin</p>
              <h1 id="page-title">What’s taking up space right now?</h1>
              <p className="lede">
                Write it as it comes—full sentences, fragments, or a list. We’ll help shape
                it into one manageable place to begin.
              </p>
            </div>

            {confirmedTasks.length > 0 && (
              <div className="existing-tasks-note">
                <div>
                  <strong>
                    {confirmedTasks.length} existing{" "}
                    {confirmedTasks.length === 1 ? "task is" : "tasks are"} safely stored.
                  </strong>
                  <p>This brain dump will add to them after your review.</p>
                </div>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setScreen("task-list")}
                >
                  View all tasks
                </button>
              </div>
            )}

            {recommendationLoadFailed && confirmedTasks.length > 0 && (
              <div className="error-message" role="alert">
                <span className="error-icon" aria-hidden="true">
                  !
                </span>
                <div>
                  <strong>I couldn’t choose a starting point just yet.</strong>
                  <p>Your saved tasks are still available, and you can add anything new.</p>
                </div>
              </div>
            )}

            {taskListLoadFailed && (
              <div className="error-message" role="alert">
                <span className="error-icon" aria-hidden="true">
                  !
                </span>
                <div>
                  <strong>I couldn’t load your saved task list.</strong>
                  <p>You can still save this brain dump, but earlier tasks may be hidden.</p>
                </div>
              </div>
            )}

            <form className="capture-form" onSubmit={handleSubmit}>
              <div className="field-heading">
                <label htmlFor="capture">Brain dump</label>
                <span>Anything that comes to you</span>
              </div>
              <textarea
                id="capture"
                value={captureText}
                onChange={(event) => {
                  setCaptureText(event.target.value);
                  if (requestState === "error") setRequestState("idle");
                }}
                placeholder={"Reply to the recruiter\nSchedule a dentist appointment\nFigure out dinner"}
                rows={9}
                maxLength={MAX_CAPTURE_CHARACTERS}
                disabled={requestState === "submitting"}
                aria-describedby={
                  requestState === "error"
                    ? "capture-guidance capture-error"
                    : "capture-guidance"
                }
                autoFocus
              />
              <div className="form-footer">
                <p id="capture-guidance">
                  Fragments, lists, and full sentences all work. Up to{" "}
                  {MAX_CAPTURE_CHARACTERS.toLocaleString()} characters.
                </p>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={!captureText.trim() || requestState === "submitting"}
                >
                  {requestState === "submitting" ? (
                    <>
                      <span className="spinner" aria-hidden="true" />
                      Saving…
                    </>
                  ) : requestState === "error" ? (
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

              {requestState === "error" && (
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

        {screen === "interpreting" && (
          <div className="processing-state" aria-live="polite">
            <div className="processing-orbit" aria-hidden="true">
              <span />
            </div>
            <p className="eyebrow">Your thoughts are saved</p>
            <h1 id="page-title">Making a first pass…</h1>
            <p className="lede">
              I’m separating what you wrote into a few things you can quickly review.
            </p>
            {requestState === "error" && capture !== null && (
              <div className="processing-error">
                <div className="error-message" role="alert">
                  <span className="error-icon" aria-hidden="true">
                    !
                  </span>
                  <div>
                    <strong>Your brain dump is safe.</strong>
                    <p>I couldn’t organize it just yet.</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => void interpretCapture(capture)}
                >
                  Try organizing again
                </button>
              </div>
            )}
          </div>
        )}

        {screen === "review" && interpretation !== null && capture !== null && (
          <form className="review-form" onSubmit={handleConfirmation}>
            <div className="review-intro">
              <div>
                <p className="eyebrow">A quick check together</p>
                <h1 id="page-title">Here’s what I pulled out.</h1>
                <p className="lede">
                  These are the new tasks from this brain dump. Change anything that
                  doesn’t sound right, or remove anything that isn’t actually a task.
                </p>
                {confirmedTasks.length > 0 && (
                  <p className="existing-review-note">
                    Your {confirmedTasks.length} existing{" "}
                    {confirmedTasks.length === 1 ? "task stays" : "tasks stay"} on your
                    list while you review these.
                  </p>
                )}
              </div>
              <span className="task-count">
                {reviewedTasks.length} {reviewedTasks.length === 1 ? "task" : "tasks"}
              </span>
            </div>

            <div className="review-list">
              {reviewedTasks.map((task, index) => {
                const sourceTask = interpretation.proposal.tasks.find(
                  (proposalTask) => proposalTask.id === task.id,
                );
                const duration = sourceTask?.actions[0].duration;
                return (
                  <article className="task-card" key={task.id}>
                    <div className="task-card-heading">
                      <span className="task-number">{String(index + 1).padStart(2, "0")}</span>
                      <button
                        type="button"
                        className="remove-button"
                        onClick={() => removeReviewedTask(task.id)}
                        aria-label={`Remove ${task.title || `task ${index + 1}`}`}
                      >
                        Remove
                      </button>
                    </div>
                    <label>
                      <span>What needs attention</span>
                      <input
                        aria-label={`Task ${index + 1} title`}
                        value={task.title}
                        onChange={(event) =>
                          updateReviewedTask(task.id, "title", event.target.value)
                        }
                        disabled={requestState === "submitting"}
                      />
                    </label>
                    <label>
                      <span>A possible place to start</span>
                      <input
                        aria-label={`Task ${index + 1} starting point`}
                        value={task.action_description}
                        onChange={(event) =>
                          updateReviewedTask(
                            task.id,
                            "action_description",
                            event.target.value,
                          )
                        }
                        disabled={requestState === "submitting"}
                      />
                    </label>
                    {(sourceTask?.deadline || duration) && (
                      <div className="task-signals" aria-label="Interpreted details">
                        {sourceTask.deadline && (
                          <span>Due {sourceTask.deadline.date}</span>
                        )}
                        {duration && (
                          <span>
                            {duration.minimum_minutes === duration.maximum_minutes
                              ? `${duration.minimum_minutes} min`
                              : `${duration.minimum_minutes}–${duration.maximum_minutes} min`}
                          </span>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}

              {reviewedTasks.length === 0 && (
                <div className="empty-review">
                  <strong>Nothing actionable here is okay.</strong>
                  <p>
                    Save the empty review if this brain dump was something you only needed
                    to get out of your head.
                  </p>
                </div>
              )}
            </div>

            <button type="button" className="add-task-button" onClick={addReviewedTask}>
              <span aria-hidden="true">+</span>
              Add another task
            </button>

            <details className="original-capture">
              <summary>View your original words</summary>
              <p>{capture.raw_text}</p>
            </details>

            {requestState === "error" && (
              <div className="error-message" role="alert">
                <span className="error-icon" aria-hidden="true">
                  !
                </span>
                <div>
                  <strong>Your edits are still here.</strong>
                  <p>I couldn’t save this review yet. Try again when you’re ready.</p>
                </div>
              </div>
            )}

            <div className="review-footer">
              <p>You can always make a new interpretation later. This version stays intact.</p>
              <button
                type="submit"
                className="primary-button"
                disabled={!reviewIsValid || requestState === "submitting"}
              >
                {requestState === "submitting" ? (
                  <>
                    <span className="spinner" aria-hidden="true" />
                    Saving review…
                  </>
                ) : (
                  <>
                    Looks right
                    <span className="button-arrow" aria-hidden="true">
                      →
                    </span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {screen === "saved" && (
          <div className="success-state" aria-live="polite">
            <div className="success-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="m6 12 4 4 8-8" />
              </svg>
            </div>
            <p className="eyebrow">Review saved</p>
            <h1 id="page-title">That’s safely added.</h1>
            <p className="lede">
              {reviewedTasks.length === 0
                ? "Nothing actionable was added, and your original words are still preserved."
                : `${reviewedTasks.length} ${
                    reviewedTasks.length === 1 ? "task was" : "tasks were"
                  } added without changing anything you saved earlier.`}
            </p>
            {taskListLoadFailed && (
              <div className="error-message" role="alert">
                <span className="error-icon" aria-hidden="true">
                  !
                </span>
                <div>
                  <strong>Your review is saved, but I couldn’t refresh the task list.</strong>
                  <p>The saved task will appear after the list loads successfully.</p>
                </div>
              </div>
            )}
            {recommendationLoadFailed && !taskListLoadFailed && (
              <div className="error-message" role="alert">
                <span className="error-icon" aria-hidden="true">
                  !
                </span>
                <div>
                  <strong>Your review is saved, but I couldn’t choose a starting point.</strong>
                  <p>You can try again without changing anything you just added.</p>
                </div>
              </div>
            )}
            <div className="success-actions">
              {recommendationLoadFailed && confirmedTasks.length > 0 ? (
                <>
                  <button
                    type="button"
                    className="primary-button"
                    disabled={recommendationRequestState === "submitting"}
                    onClick={() => void chooseAnotherRecommendation()}
                  >
                    {recommendationRequestState === "submitting"
                      ? "Choosing…"
                      : "Choose a starting point"}
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    onClick={startAnotherCapture}
                  >
                    Add another brain dump
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="primary-button"
                  onClick={startAnotherCapture}
                >
                  Add another brain dump
                </button>
              )}
              {confirmedTasks.length > 0 && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setScreen("task-list")}
                >
                  View all tasks
                </button>
              )}
            </div>
          </div>
        )}

        {screen === "task-list" && (
          <div className="task-list-view" aria-live="polite">
            <div className="task-list-intro">
              <div>
                <p className="eyebrow">Your current picture</p>
                <h1 id="page-title">Here’s what’s on your plate.</h1>
                <p className="lede">
                  Each reviewed brain dump adds to this list. Nothing from an earlier
                  capture is replaced.
                </p>
              </div>
              <span className="task-count">
                {confirmedTasks.length}{" "}
                {confirmedTasks.length === 1 ? "task" : "tasks"}
              </span>
            </div>

            {taskListLoadFailed && (
              <div className="error-message" role="alert">
                <span className="error-icon" aria-hidden="true">
                  !
                </span>
                <div>
                  <strong>Some saved tasks may be missing.</strong>
                  <p>I couldn’t refresh the complete list just yet.</p>
                </div>
              </div>
            )}

            <div className="current-task-list">
              {confirmedTasks.map((task, index) => {
                const firstAction = task.actions[0];
                const duration = firstAction.duration;
                return (
                  <article
                    className="current-task-card"
                    key={task.id}
                  >
                    <span className="task-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {taskEditDraft?.taskId === task.id ? (
                      <form className="canonical-task-edit" onSubmit={saveTaskContent}>
                        <label>
                          <span>Task</span>
                          <input
                            value={taskEditDraft.title}
                            onChange={(event) =>
                              updateTaskEditDraft("title", event.target.value)
                            }
                            disabled={updatingTaskId !== null}
                            autoFocus
                          />
                        </label>
                        <label>
                          <span>Starting action</span>
                          <input
                            value={taskEditDraft.actionDescription}
                            onChange={(event) =>
                              updateTaskEditDraft(
                                "actionDescription",
                                event.target.value,
                              )
                            }
                            disabled={updatingTaskId !== null}
                          />
                        </label>
                        <div className="task-edit-actions">
                          <button
                            type="submit"
                            className="secondary-button"
                            disabled={
                              updatingTaskId !== null ||
                              !taskEditDraft.title.trim() ||
                              !taskEditDraft.actionDescription.trim()
                            }
                          >
                            {updatingTaskId === task.id ? "Saving…" : "Save changes"}
                          </button>
                          <button
                            type="button"
                            className="text-button"
                            disabled={updatingTaskId !== null}
                            onClick={() => setTaskEditDraft(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div>
                        <h2>{task.title}</h2>
                        {task.status === "completed" && (
                          <span className="task-status">Completed</span>
                        )}
                        <p>
                          <span>Start with</span>
                          {firstAction.description}
                        </p>
                        {(task.deadline || duration) && (
                          <div className="task-signals" aria-label="Task details">
                            {task.deadline && <span>Due {task.deadline.date}</span>}
                            {duration && (
                              <span>
                                {duration.minimum_minutes === duration.maximum_minutes
                                  ? `${duration.minimum_minutes} min`
                                  : `${duration.minimum_minutes}–${duration.maximum_minutes} min`}
                              </span>
                            )}
                          </div>
                        )}
                        <div className="task-lifecycle-actions">
                          <button
                            type="button"
                            className="secondary-button"
                            disabled={updatingTaskId !== null}
                            onClick={() =>
                              void changeTaskStatus(
                                task,
                                task.status === "completed" ? "active" : "completed",
                              )
                            }
                          >
                            {updatingTaskId === task.id
                              ? "Saving…"
                              : task.status === "completed"
                                ? "Reopen"
                                : "Mark complete"}
                          </button>
                          <button
                            type="button"
                            className="text-button"
                            disabled={updatingTaskId !== null}
                            onClick={() => beginTaskEdit(task)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="archive-button"
                            disabled={updatingTaskId !== null}
                            onClick={() => void changeTaskStatus(task, "archived")}
                          >
                            Archive
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}

              {confirmedTasks.length === 0 && (
                <div className="empty-review">
                  <strong>Nothing actionable is on your list yet.</strong>
                  <p>Your reviewed brain dump is still preserved in interpretation history.</p>
                </div>
              )}
            </div>

            {taskUpdateFailed && (
              <div className="error-message" role="alert">
                <span className="error-icon" aria-hidden="true">
                  !
                </span>
                <div>
                  <strong>I couldn’t update that task.</strong>
                  <p>Nothing else changed. Try again when you’re ready.</p>
                </div>
              </div>
            )}

            <div className="task-list-footer">
              <p>
                The full list stays available without becoming the default place to work.
              </p>
              <button
                type="button"
                className="primary-button"
                disabled={recommendationRequestState === "submitting"}
                onClick={() => {
                  if (recommendation?.state === "accepted") {
                    setScreen("active-commitment");
                  } else if (recommendation?.state === "proposed") {
                    setScreen("recommendation");
                  } else {
                    void chooseAnotherRecommendation();
                  }
                }}
              >
                {recommendation?.state === "accepted"
                  ? "Back to commitment"
                  : recommendation?.state === "proposed"
                    ? "Back to starting point"
                    : "Choose a starting point"}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={startAnotherCapture}
              >
                Add a brain dump
              </button>
            </div>
          </div>
        )}
      </section>

      <p className="footer-note">One step at a time.</p>
    </main>
  );
}
