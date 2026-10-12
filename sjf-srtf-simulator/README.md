# SCHEDULAB — SJF & SRTF CPU Scheduling Simulator

A responsive, browser-based Operating Systems SLA website for comparing Non-Preemptive Shortest Job First (SJF) and Preemptive Shortest Job First / Shortest Remaining Time First (SRTF).

## Features

- Editable process IDs, arrival times and burst times
- Run Non-Preemptive SJF, SRTF, or compare both
- Gantt chart with execution intervals and idle time
- Per-process CT, TAT, WT and RT tables
- Average waiting, turnaround and response time
- CPU utilization
- CSV export of the computed process metrics
- SJF/SRTF concepts, pseudocode, research paper summary, system architecture, scope and references
- Responsive layout for desktop, tablet and mobile
- No backend, build tool, package manager or API keys required

## Run locally

1. Extract this folder.
2. Open `index.html` in a modern browser (Chrome, Edge, Firefox or Safari).
3. Edit the input processes and select an algorithm.
4. Click **Run simulation**.

All simulation and CSV-export processing happens in the browser. The main content does not require a server. Google Fonts are loaded from an external URL when internet access is available; the page uses fallback fonts if not.

## Publish for a shareable website link (GitHub Pages)

1. Sign in to GitHub and create a new public repository, for example `sjf-srtf-simulator`.
2. Upload `index.html`, `styles.css`, `script.js`, and `README.md` from this folder to the repository's root (not a nested folder).
3. Open the repository's **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select branch `main` and folder `/ (root)`, then save.
6. Wait until GitHub Pages reports the site is published. The provided URL will look like `https://YOUR-USERNAME.github.io/sjf-srtf-simulator/`.

GitHub's interface may change. If your repository uses a different default branch name, choose that branch instead. The repository must contain `index.html` at the published root.

## Scheduling rules and assumptions

- Time values are non-negative integers; burst time must be at least 1.
- Up to 30 processes are accepted for this educational simulator.
- In SJF, choose among arrived and unfinished processes by original burst time.
- In SRTF, choose among arrived and unfinished processes by remaining time. If remaining time ties, keep the currently running process where possible; otherwise earlier arrival and input order break ties.
- When no process is ready, an idle interval is included in the Gantt chart.
- Waiting time = turnaround time − burst time.
- Turnaround time = completion time − arrival time.
- Response time = first CPU start time − arrival time.
- CPU utilization is calculated as total burst time divided by the finish time measured from time zero. This includes initial idle time, when present.
- Context-switch duration is not modelled.

## Research references

1. González-Rodríguez, M., Otero-Cerdeira, L., González-Rufino, E., & Rodríguez-Martínez, F. J. (2024). *Study and Evaluation of CPU Scheduling Algorithms*. Heliyon, 10(9), e29959. https://doi.org/10.1016/j.heliyon.2024.e29959
2. Pachipala, Y., Sureddy, K. S., Kaitepalli, A. B. S. S., Pagadala, N., Nalabothu, S. S., & Iniganti, M. (2024). *Optimizing Task Scheduling in Cloud Computing: An Enhanced Shortest Job First Algorithm*. Procedia Computer Science, 233, 604–613. https://doi.org/10.1016/j.procs.2024.03.250
