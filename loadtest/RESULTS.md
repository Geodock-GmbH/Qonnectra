# Load test results

One line per run worth keeping. Copy the numbers from the run's report on the dashboard. Keep the run folder itself (`loadtest/runs/`, git-ignored) on the server for as long as you might want to compare against it.

- **users @ SLO**: the highest user count in the timeline where tile p95 stayed under 1 s and errors under 1 %.
- **top SQL**: the first rows of "Top SQL by total time", given as percentage of DB time and a short name.

| date | version | host | dataset | profile + options | users @ SLO | tile p95 | db avg CPU | top SQL | notes |
| ---- | ------- | ---- | ------- | ----------------- | ----------- | -------- | ---------- | ------- | ----- |
