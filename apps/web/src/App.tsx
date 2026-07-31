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
  listTasks,
  setTaskStatus,
  updateTaskContent,
  type Task,
  type TaskStatus,
} from "./api/tasks";

type Screen =
  | "loading"
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
  const [screen, setScreen] = useState<Screen>("loading");
  const [requestState, setRequestState] = useState<RequestState>("idle");
  const [taskListLoadFailed, setTaskListLoadFailed] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [taskUpdateFailed, setTaskUpdateFailed] = useState(false);
  const [taskEditDraft, setTaskEditDraft] = useState<TaskEditDraft | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    void listTasks(controller.signal)
      .then((savedTasks) => {
        setTasks(savedTasks);
        setTaskListLoadFailed(false);
        setScreen("capture");
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

    setScreen("saved");
    setRequestState("idle");
    try {
      setTasks(await listTasks());
      setTaskListLoadFailed(false);
    } catch {
      setTaskListLoadFailed(true);
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
    setScreen("capture");
    setRequestState("idle");
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
            <div className="success-actions">
              <button
                type="button"
                className="primary-button"
                onClick={startAnotherCapture}
              >
                Add another brain dump
              </button>
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
                Next, Weavance can use this list to choose one manageable place to start.
              </p>
              <button
                type="button"
                className="primary-button"
                onClick={startAnotherCapture}
              >
                Back to brain dump
              </button>
            </div>
          </div>
        )}
      </section>

      <p className="footer-note">One step at a time.</p>
    </main>
  );
}
