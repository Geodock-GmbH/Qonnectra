# Load test results

One line per run worth keeping. Copy the numbers from the run's `report.md`. Keep the run directory itself (git-ignored) on the VPS for as long as you might want to `--compare` against it.

- **users @ SLO**: the highest user count in the timeline where tile p95 stayed under 1 s and errors under 1 %.
- **top SQL**: the first rows of "Top SQL by total time", given as percentage of DB time and a short name.

| date | git | host | dataset | profile + args | users @ SLO | tile p95 | db avg CPU | top SQL | notes |
| ---- | --- | ---- | ------- | -------------- | ----------- | -------- | ---------- | ------- | ----- |
