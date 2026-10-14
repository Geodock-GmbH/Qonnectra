/**
 * Load-test dashboard: polls the runner state, shows the setup checks and the
 * seeded test data, starts seed and purge jobs, and lists finished runs.
 */

const STATUS_POLL_MS = 3000;
const JOB_POLL_MS = 1000;

const $ = (/** @type {string} */ id) =>
  /** @type {HTMLElement} */ (document.getElementById(id));

/**
 * @typedef {object} Runner
 * @property {string} state - Locust's runner state, e.g. `ready`, `running`, `stopped`.
 * @property {number} users - Users running now.
 * @property {boolean} ready - Whether the current run was prepared.
 * @property {string | null} error - Why the last run could not start.
 * @property {string[]} notes - Warnings about the current run.
 * @property {string | null} last_run - Folder name of the last finished run.
 */

/**
 * @typedef {object} CheckAction
 * @property {string} state - Target state of the Postgres statistics, `on` or `off`.
 * @property {string} label - Button text.
 */

/**
 * @typedef {object} Job
 * @property {string} label - What the job does, e.g. `Seed small`.
 * @property {string} state - `running`, `done` or `failed`.
 * @property {string[]} lines - Output so far.
 */

/** @type {string | null} */
let lastRunner = null;
/** @type {string | null} */
let lastJobState = null;
/** @type {Set<string>} */
const selectedRuns = new Set();

/**
 * Fetches JSON from the dashboard API and throws with the server's message on errors.
 * @param {string} path - Path below the dashboard, e.g. `api/status`.
 * @param {RequestInit} [init] - Method and body for POSTs; a GET without it.
 * @returns {Promise<any>} The parsed JSON answer.
 */
async function api(path, init) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (response.status === 401) {
    window.location.reload();
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
  return body;
}

/**
 * Creates an element with text content and optional class.
 * @param {string} tag - Element name, e.g. `td`.
 * @param {string} [text] - Text content; empty for none.
 * @param {string} [className] - CSS classes; empty for none.
 * @returns {HTMLElement} The new, detached element.
 */
function el(tag, text = "", className = "") {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

/**
 * Formats a number with thousands separators, `–` for missing values.
 * @param {number | null | undefined} value - Number to show; missing values become `–`.
 * @param {number} [digits] - Decimal places.
 * @returns {string} The formatted number.
 */
function num(value, digits = 0) {
  if (value === null || value === undefined) return "–";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/**
 * Shows the runner state and the current run's messages.
 * @param {Runner} runner - Runner part of `api/status`.
 */
function renderRunner(runner) {
  const state = $("runner-state");
  state.textContent = runner.state;
  state.className = `pill ${runner.state}`;
  const running = runner.state === "running" || runner.state === "spawning";
  $("runner-detail").textContent = running
    ? `${runner.users} users running`
    : runner.last_run
      ? `Last run: ${runner.last_run}`
      : "No run in this session yet";

  const messages = $("runner-messages");
  messages.replaceChildren();
  if (runner.error)
    messages.append(
      el("div", `Run could not start: ${runner.error}`, "message fail"),
    );
  for (const note of runner.notes || [])
    messages.append(el("div", note, "message"));

  /** @type {HTMLButtonElement} */ ($("purge")).disabled = running;
  /** @type {HTMLButtonElement} */ (
    $("seed-form").querySelector("button[type=submit]")
  ).disabled = running;

  if (lastRunner && lastRunner !== runner.state && runner.state === "stopped")
    loadRuns();
  lastRunner = runner.state;
}

/**
 * Shows the last seed or purge job with its log.
 * @param {Job | null} job - The current or last job, or null when none ran yet.
 */
function renderJob(job) {
  const box = $("job");
  if (!job) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  $("job-label").textContent = job.label;
  const state = $("job-state");
  state.textContent = job.state;
  state.className = `pill ${job.state}`;
  const log = $("job-log");
  log.textContent = job.lines.join("\n") || "…";
  log.scrollTop = log.scrollHeight;
  if (lastJobState === "running" && job.state !== "running") {
    loadData(true);
    loadChecks(true);
  }
  lastJobState = job.state;
}

/** Polls runner and job state; faster while a job runs. */
async function pollStatus() {
  let delay = STATUS_POLL_MS;
  try {
    const status = await api("api/status");
    renderRunner(status.runner);
    renderJob(status.job);
    if (status.job?.state === "running") delay = JOB_POLL_MS;
  } catch (error) {
    $("runner-state").textContent = "unreachable";
    $("runner-detail").textContent = String(error);
  }
  setTimeout(pollStatus, delay);
}

/**
 * Creates the button that switches the Postgres statistics after a confirmation.
 * @param {CheckAction} action - Target state and button text from the check.
 * @returns {HTMLButtonElement} The detached button.
 */
function statisticsButton(action) {
  const button = /** @type {HTMLButtonElement} */ (
    el("button", action.label, "button check-action")
  );
  button.type = "button";
  button.addEventListener("click", async () => {
    if (
      !confirm(
        "This restarts the database container: Qonnectra is unavailable for a few seconds. Continue?",
      )
    )
      return;
    try {
      renderJob(
        await api("api/postgres-statistics", {
          method: "POST",
          body: JSON.stringify({ state: action.state }),
        }),
      );
    } catch (error) {
      alert(String(error));
    }
  });
  return button;
}

/**
 * Loads and shows the setup checks.
 * @param {boolean} [fresh] - Recompute instead of using the cached result.
 */
async function loadChecks(fresh = false) {
  const list = $("checks");
  try {
    const checks = await api(`api/checks${fresh ? "?fresh=1" : ""}`);
    list.replaceChildren(
      ...checks.map((/** @type {any} */ check) => {
        const item = el("li");
        item.append(el("span", "", `dot ${check.state}`), el("b", check.name));
        item.append(el("span", check.detail, "check-detail"));
        if (check.action) item.append(statisticsButton(check.action));
        return item;
      }),
    );
  } catch (error) {
    list.replaceChildren(el("li", String(error), "muted"));
  }
}

/**
 * Loads and shows the seeded projects, user count and presets.
 * @param {boolean} [fresh] - Recompute instead of using the cached result.
 */
async function loadData(fresh = false) {
  const target = $("projects");
  try {
    const data = await api(`api/data${fresh ? "?fresh=1" : ""}`);
    $("users").textContent = `${num(data.users)} load-test users`;

    const select = /** @type {HTMLSelectElement} */ ($("preset"));
    if (!select.options.length) {
      for (const [name, km] of Object.entries(data.presets || {})) {
        const option = /** @type {HTMLOptionElement} */ (
          el("option", `${name} · ${km} km`)
        );
        option.value = name;
        if (name === "small") option.selected = true;
        select.append(option);
      }
    }

    if (data.error) {
      target.replaceChildren(el("p", data.error, "message fail"));
      return;
    }
    if (!data.projects.length) {
      target.replaceChildren(el("p", "No test data yet.", "muted"));
      return;
    }
    const table = el("table");
    const head = el("tr");
    for (const title of ["Project", "Trenches", "Addresses", "Nodes"])
      head.append(el("th", title));
    table.append(head);
    for (const project of data.projects) {
      const row = el("tr");
      row.append(
        el("td", `${project.name} (#${project.id})`),
        el("td", num(project.trenches)),
        el("td", num(project.addresses)),
        el("td", num(project.nodes)),
      );
      table.append(row);
    }
    target.replaceChildren(table);
  } catch (error) {
    target.replaceChildren(el("p", String(error), "message fail"));
  }
}

/** Enables Compare when exactly two runs are ticked. */
function updateCompare() {
  /** @type {HTMLButtonElement} */ ($("compare")).disabled =
    selectedRuns.size !== 2;
}

/** Loads and shows the finished runs. */
async function loadRuns() {
  const body = /** @type {HTMLTableSectionElement} */ (
    $("runs").querySelector("tbody")
  );
  try {
    const runs = await api("api/runs");
    if (!runs.length) {
      const row = el("tr");
      const cell = el("td", "No runs yet. Start one in the runner.", "muted");
      cell.setAttribute("colspan", "9");
      row.append(cell);
      body.replaceChildren(row);
      return;
    }
    body.replaceChildren(
      ...runs.map((/** @type {any} */ run) => {
        const row = el("tr");
        const box = /** @type {HTMLInputElement} */ (el("input"));
        box.type = "checkbox";
        box.checked = selectedRuns.has(run.name);
        box.addEventListener("change", () => {
          if (box.checked) selectedRuns.add(run.name);
          else selectedRuns.delete(run.name);
          updateCompare();
        });
        const pick = el("td");
        pick.append(box);
        const link = /** @type {HTMLAnchorElement} */ (el("a", run.name));
        link.href = `runs/${encodeURIComponent(run.name)}/`;
        const name = el("td");
        name.append(link);
        row.append(
          pick,
          name,
          el("td", run.shape || "–"),
          el("td", num(run.users)),
          el("td", num(run.requests)),
          el("td", num(run.rps, 1)),
          el("td", num(run.p95)),
          el(
            "td",
            run.fail_pct === undefined ? "–" : `${num(run.fail_pct, 2)} %`,
          ),
          el("td", (run.personas || []).join(", ")),
        );
        return row;
      }),
    );
  } catch (error) {
    const row = el("tr");
    row.append(el("td", String(error), "muted"));
    body.replaceChildren(row);
  }
}

$("recheck").addEventListener("click", () => loadChecks(true));

$("seed-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const preset = /** @type {HTMLSelectElement} */ ($("preset")).value;
  const projects = Number(
    /** @type {HTMLInputElement} */ ($("project-count")).value,
  );
  try {
    renderJob(
      await api("api/seed", {
        method: "POST",
        body: JSON.stringify({ preset, projects }),
      }),
    );
  } catch (error) {
    alert(String(error));
  }
});

$("purge").addEventListener("click", async () => {
  if (!confirm("Delete all loadtest-NN projects and load-test users?")) return;
  try {
    renderJob(await api("api/purge", { method: "POST" }));
  } catch (error) {
    alert(String(error));
  }
});

$("compare").addEventListener("click", () => {
  const [newer, older] = [...selectedRuns].sort().reverse();
  window.location.href = `compare?before=${encodeURIComponent(older)}&after=${encodeURIComponent(newer)}`;
});

pollStatus();
loadChecks();
loadData();
loadRuns();
