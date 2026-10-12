(() => {
  'use strict';

  const SAMPLE = [
    { id: 'P1', arrival: 0, burst: 7 },
    { id: 'P2', arrival: 2, burst: 4 },
    { id: 'P3', arrival: 3, burst: 1 },
    { id: 'P4', arrival: 4, burst: 2 }
  ];
  const COLORS = ['#c6bdff', '#a7edf3', '#d8f48b', '#ffdab4', '#f7b8d7', '#b9d1ff', '#c5e7d0', '#f4c6a1'];
  const els = {
    inputs: document.getElementById('processInputs'),
    add: document.getElementById('addProcessBtn'),
    reset: document.getElementById('resetSampleBtn'),
    run: document.getElementById('runBtn'),
    validation: document.getElementById('validationMessage'),
    status: document.getElementById('engineStatus'),
    resultGrid: document.getElementById('resultGrid'),
    resultsEmpty: document.getElementById('resultsEmpty'),
    summary: document.getElementById('comparisonSummary'),
    comparisonPanel: document.getElementById('comparisonPanel'),
    comparison: document.getElementById('metricComparison'),
    export: document.getElementById('exportCsvBtn'),
    progress: document.getElementById('topProgress')
  };
  let selectedMode = 'both';
  let lastResults = null;
  let processCounter = 5;

  const number = (value) => Number(value);
  const fmt = (value) => Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  const average = (processes, key) => processes.reduce((sum, p) => sum + p[key], 0) / processes.length;
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

  function addInputRow(process = { id: `P${processCounter++}`, arrival: 0, burst: 1 }) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input class="id-input" type="text" aria-label="Process ID" maxlength="12" value="${escapeHtml(process.id)}" autocomplete="off"></td>
      <td><input type="number" aria-label="Arrival time" min="0" max="10000" step="1" value="${process.arrival}" inputmode="numeric"></td>
      <td><input type="number" aria-label="Burst time" min="1" max="10000" step="1" value="${process.burst}" inputmode="numeric"></td>
      <td><button type="button" class="remove-row" aria-label="Remove ${escapeHtml(process.id)}" title="Remove process">×</button></td>`;
    tr.querySelector('.remove-row').addEventListener('click', () => {
      if (els.inputs.children.length <= 1) {
        showError('Keep at least one process in the workload.');
        return;
      }
      tr.remove();
      hideError();
    });
    tr.querySelector('.id-input').addEventListener('input', (event) => {
      tr.querySelector('.remove-row').setAttribute('aria-label', `Remove ${event.target.value || 'process'}`);
    });
    els.inputs.appendChild(tr);
  }

  function setInputs(rows) {
    els.inputs.innerHTML = '';
    processCounter = Math.max(rows.length + 1, 5);
    rows.forEach((row) => addInputRow(row));
  }

  function readInputs() {
    const rows = [...els.inputs.querySelectorAll('tr')];
    if (!rows.length) throw new Error('Add at least one process before running the simulation.');
    if (rows.length > 30) throw new Error('For this educational simulator, use 30 processes or fewer.');
    const seen = new Set();
    const processes = rows.map((row, index) => {
      const fields = row.querySelectorAll('input');
      const id = fields[0].value.trim();
      const arrivalRaw = fields[1].value;
      const burstRaw = fields[2].value;
      if (!id) throw new Error(`Process row ${index + 1}: enter a process ID.`);
      const idKey = id.toLowerCase();
      if (seen.has(idKey)) throw new Error(`Process ID “${id}” is duplicated. Each process ID must be unique.`);
      seen.add(idKey);
      if (arrivalRaw.trim() === '' || !Number.isFinite(number(arrivalRaw))) throw new Error(`Process ${id}: enter a valid arrival time.`);
      if (burstRaw.trim() === '' || !Number.isFinite(number(burstRaw))) throw new Error(`Process ${id}: enter a valid burst time.`);
      const arrival = number(arrivalRaw);
      const burst = number(burstRaw);
      if (!Number.isInteger(arrival) || arrival < 0 || arrival > 10000) throw new Error(`Process ${id}: arrival time must be an integer from 0 to 10,000.`);
      if (!Number.isInteger(burst) || burst < 1 || burst > 10000) throw new Error(`Process ${id}: burst time must be an integer from 1 to 10,000.`);
      return { id, arrival, burst, remaining: burst, order: index, firstStart: null, completion: null };
    });
    const totalBurst = processes.reduce((sum, process) => sum + process.burst, 0);
    if (totalBurst > 50000) throw new Error('The total burst time exceeds the simulator limit of 50,000 units.');
    return processes;
  }

  function addSegment(segments, id, start, end) {
    if (end <= start) return;
    const last = segments[segments.length - 1];
    if (last && last.id === id && last.end === start) last.end = end;
    else segments.push({ id, start, end });
  }

  function finishMetrics(processes, segments, algorithm) {
    const results = processes.map((p) => {
      const turnaround = p.completion - p.arrival;
      const waiting = turnaround - p.burst;
      const response = p.firstStart - p.arrival;
      return { id: p.id, arrival: p.arrival, burst: p.burst, completion: p.completion, turnaround, waiting, response, firstStart: p.firstStart, order: p.order };
    });
    const totalBurst = results.reduce((sum, p) => sum + p.burst, 0);
    const endTime = Math.max(...results.map((p) => p.completion));
    const idleTime = segments.filter((s) => s.id === null).reduce((sum, s) => sum + (s.end - s.start), 0);
    const preemptions = algorithm === 'srtf' ? segments.filter((segment) => {
      if (segment.id === null) return false;
      const proc = results.find((p) => p.id === segment.id);
      return segment.end < proc.completion;
    }).length : 0;
    return {
      algorithm,
      processes: results,
      segments,
      avgWaiting: average(results, 'waiting'),
      avgTurnaround: average(results, 'turnaround'),
      avgResponse: average(results, 'response'),
      cpuUtilization: endTime > 0 ? (totalBurst / endTime) * 100 : 0,
      throughput: endTime > 0 ? results.length / endTime : 0,
      endTime,
      idleTime,
      preemptions
    };
  }

  function simulateNonPreemptive(input) {
    const processes = input.map((p) => ({ ...p, remaining: p.burst, firstStart: null, completion: null }));
    const segments = [];
    let time = 0;
    let completed = 0;
    while (completed < processes.length) {
      const ready = processes.filter((p) => p.completion === null && p.arrival <= time);
      if (!ready.length) {
        const nextArrival = Math.min(...processes.filter((p) => p.completion === null).map((p) => p.arrival));
        addSegment(segments, null, time, nextArrival);
        time = nextArrival;
        continue;
      }
      ready.sort((a, b) => a.burst - b.burst || a.arrival - b.arrival || a.order - b.order);
      const chosen = ready[0];
      chosen.firstStart = time;
      const start = time;
      time += chosen.burst;
      chosen.completion = time;
      chosen.remaining = 0;
      completed += 1;
      addSegment(segments, chosen.id, start, time);
    }
    return finishMetrics(processes, segments, 'np');
  }

  function simulateSRTF(input) {
    const processes = input.map((p) => ({ ...p, remaining: p.burst, firstStart: null, completion: null }));
    const segments = [];
    let time = 0;
    let completed = 0;
    let currentId = null;
    while (completed < processes.length) {
      const ready = processes.filter((p) => p.arrival <= time && p.remaining > 0);
      if (!ready.length) {
        const nextArrival = Math.min(...processes.filter((p) => p.remaining > 0).map((p) => p.arrival));
        addSegment(segments, null, time, nextArrival);
        time = nextArrival;
        currentId = null;
        continue;
      }
      ready.sort((a, b) => a.remaining - b.remaining || (a.id === currentId ? -1 : b.id === currentId ? 1 : 0) || a.arrival - b.arrival || a.order - b.order);
      const chosen = ready[0];
      if (chosen.firstStart === null) chosen.firstStart = time;
      const start = time;
      chosen.remaining -= 1;
      time += 1;
      addSegment(segments, chosen.id, start, time);
      currentId = chosen.id;
      if (chosen.remaining === 0) {
        chosen.completion = time;
        completed += 1;
      }
    }
    return finishMetrics(processes, segments, 'srtf');
  }

  function showError(message) {
    els.validation.hidden = false;
    els.validation.textContent = message;
    els.status.innerHTML = '<span class="status-dot" style="background:#dc665d"></span><span>Input needs attention</span>';
  }
  function hideError() { els.validation.hidden = true; els.validation.textContent = ''; }

  function processColor(id, processes) {
    const index = processes.findIndex((p) => p.id === id);
    return COLORS[(index < 0 ? 0 : index) % COLORS.length];
  }

  function renderGantt(result) {
    const processes = result.processes;
    const total = Math.max(result.endTime, 1);
    const segments = result.segments;
    const chartSegments = segments.map((segment) => {
      const duration = segment.end - segment.start;
      const label = segment.id === null ? 'IDLE' : segment.id;
      const color = segment.id === null ? '' : processColor(segment.id, processes);
      return `<div class="gantt-segment ${segment.id === null ? 'idle-segment' : ''}" style="--dur:${duration};${color ? `background:${color}` : ''}" title="${escapeHtml(label)}: ${segment.start}–${segment.end}"><strong>${escapeHtml(label)}</strong><small>${segment.start}–${segment.end}</small></div>`;
    }).join('');
    const times = segments.map((segment, index) => `<div class="gantt-time" style="--dur:${segment.end - segment.start}"><span class="time-start">${index === 0 ? segment.start : ''}</span><span class="time-end">${segment.end}</span></div>`).join('');
    const usedIds = [...new Set(segments.filter((s) => s.id !== null).map((s) => s.id))];
    const legend = usedIds.map((id) => `<span><i class="legend-dot" style="background:${processColor(id, processes)}"></i>${escapeHtml(id)}</span>`).join('') + (segments.some((s) => s.id === null) ? '<span><i class="legend-dot" style="background:#d9dee6"></i>Idle</span>' : '');
    return `<div class="gantt-section"><div class="gantt-title"><b>CPU execution timeline</b><span>Time units · end at ${fmt(total)}</span></div><div class="gantt-scroll"><div class="gantt-track">${chartSegments}</div><div class="gantt-times">${times}</div></div><div class="chart-legend">${legend}</div></div>`;
  }

  function renderMetrics(result) {
    const rows = result.processes.slice().sort((a, b) => a.order - b.order).map((p) => `<tr><td>${escapeHtml(p.id)}</td><td>${fmt(p.arrival)}</td><td>${fmt(p.burst)}</td><td>${fmt(p.completion)}</td><td>${fmt(p.turnaround)}</td><td>${fmt(p.waiting)}</td><td>${fmt(p.response)}</td></tr>`).join('');
    return `<div class="metrics-table-wrap"><table class="metrics-table"><thead><tr><th>PID</th><th>AT</th><th>BT</th><th>CT</th><th>TAT</th><th>WT</th><th>RT</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td>AVG</td><td>—</td><td>—</td><td>—</td><td>${fmt(result.avgTurnaround)}</td><td>${fmt(result.avgWaiting)}</td><td>${fmt(result.avgResponse)}</td></tr></tfoot></table></div>`;
  }

  function renderResultCard(result) {
    const np = result.algorithm === 'np';
    const title = np ? 'Non-Preemptive SJF' : 'Preemptive SJF / SRTF';
    const pill = np ? 'pill-np' : 'pill-srtf';
    const subtitle = np ? 'Selected process runs until completion.' : 'Scheduler re-evaluates remaining time at each integer time step.';
    return `<article class="result-card"><div class="result-card-head"><div><h4>${title}</h4><p>${subtitle}</p></div><span class="algorithm-pill ${pill}">${np ? 'NON-PREEMPTIVE' : 'PREEMPTIVE'}</span></div>${renderGantt(result)}${renderMetrics(result)}<div class="result-card-foot"><span>Average waiting time<b>${fmt(result.avgWaiting)}</b></span><span>Average turnaround<b>${fmt(result.avgTurnaround)}</b></span><span>Average response<b>${fmt(result.avgResponse)}</b></span><span>CPU utilization<b>${fmt(result.cpuUtilization)}%</b></span></div></article>`;
  }

  function renderSummary(np, srtf) {
    if (!np || !srtf) {
      const result = np || srtf;
      if (!result) { els.summary.innerHTML = ''; return; }
      els.summary.innerHTML = [
        ['AVERAGE WAITING TIME', fmt(result.avgWaiting), 'time units'],
        ['AVERAGE TURNAROUND', fmt(result.avgTurnaround), 'time units'],
        ['AVERAGE RESPONSE', fmt(result.avgResponse), 'time units'],
        ['CPU UTILIZATION', `${fmt(result.cpuUtilization)}%`, `${result.processes.length} processes`]
      ].map(([label, value, note]) => `<div class="summary-card"><span>${label}</span><b>${value}</b><small>${note}</small></div>`).join('');
      return;
    }
    const diff = np.avgWaiting - srtf.avgWaiting;
    const best = diff > 0 ? `SRTF reduced average waiting by ${fmt(diff)} time units in this workload.` : diff < 0 ? `Non-Preemptive SJF had ${fmt(Math.abs(diff))} fewer average waiting time units in this workload.` : 'Both algorithms produced the same average waiting time in this workload.';
    const items = [
      ['SRTF AVG WAITING', fmt(srtf.avgWaiting), 'vs ' + fmt(np.avgWaiting) + ' for SJF', srtf.avgWaiting <= np.avgWaiting],
      ['SRTF AVG TURNAROUND', fmt(srtf.avgTurnaround), 'vs ' + fmt(np.avgTurnaround) + ' for SJF', srtf.avgTurnaround <= np.avgTurnaround],
      ['SRTF AVG RESPONSE', fmt(srtf.avgResponse), 'vs ' + fmt(np.avgResponse) + ' for SJF', srtf.avgResponse <= np.avgResponse],
      ['SRTF PREEMPTIONS', String(srtf.preemptions), 'process segments interrupted', false]
    ];
    els.summary.innerHTML = items.map(([label, value, note, bestMetric]) => `<div class="summary-card ${bestMetric ? 'best' : ''}"><span>${label}</span><b>${value}</b><small>${note}</small></div>`).join('') + `<div class="summary-insight">${escapeHtml(best)}</div>`;
  }

  function renderComparison(np, srtf) {
    if (!np || !srtf) {
      const result = np || srtf;
      els.comparisonPanel.style.display = 'none';
      if (!result) return;
      return;
    }
    els.comparisonPanel.style.display = '';
    const rows = [
      { label: 'Average waiting', note: 'Lower is better', key: 'avgWaiting' },
      { label: 'Average turnaround', note: 'Lower is better', key: 'avgTurnaround' },
      { label: 'Average response', note: 'Lower is better', key: 'avgResponse' },
      { label: 'CPU utilization', note: 'Higher can be better', key: 'cpuUtilization', percent: true }
    ];
    els.comparison.innerHTML = rows.map((row) => {
      const a = np[row.key], b = srtf[row.key];
      const max = Math.max(a, b, row.percent ? 1 : 0.0001);
      const aw = row.percent ? Math.min(100, a) : (a / max) * 100;
      const bw = row.percent ? Math.min(100, b) : (b / max) * 100;
      return `<div class="compare-row"><div class="compare-label"><b>${row.label}</b><small>${row.note}</small></div><div class="compare-bar-col"><div class="compare-value-line"><span>SJF</span><strong>${fmt(a)}${row.percent ? '%' : ''}</strong></div><div class="compare-bar-bg"><div class="compare-bar bar-np" style="width:${aw}%"></div></div></div><div class="compare-bar-col"><div class="compare-value-line"><span>SRTF</span><strong>${fmt(b)}${row.percent ? '%' : ''}</strong></div><div class="compare-bar-bg"><div class="compare-bar bar-srtf" style="width:${bw}%"></div></div></div></div>`;
    }).join('');
  }

  function setMode(mode) {
    selectedMode = mode;
    document.querySelectorAll('.algorithm-option').forEach((button) => {
      const selected = button.dataset.mode === mode;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  function runSimulation() {
    try {
      hideError();
      const processes = readInputs();
      const wantNP = selectedMode === 'np' || selectedMode === 'both';
      const wantSRTF = selectedMode === 'srtf' || selectedMode === 'both';
      const np = wantNP ? simulateNonPreemptive(processes) : null;
      const srtf = wantSRTF ? simulateSRTF(processes) : null;
      lastResults = { np, srtf, input: processes.map(({ id, arrival, burst }) => ({ id, arrival, burst })) };
      els.resultsEmpty.hidden = true;
      els.resultGrid.innerHTML = [np, srtf].filter(Boolean).map(renderResultCard).join('');
      renderSummary(np, srtf);
      renderComparison(np, srtf);
      const count = processes.length;
      els.status.innerHTML = `<span class="status-dot"></span><span>Simulation complete · ${count} process${count === 1 ? '' : 'es'} · ${selectedMode === 'both' ? 'both algorithms compared' : selectedMode === 'np' ? 'Non-Preemptive SJF' : 'SRTF'} </span>`;
      els.resultsEmpty.hidden = true;
    } catch (error) {
      showError(error.message || 'There was a problem with the process input.');
    }
  }

  function exportCsv() {
    if (!lastResults) {
      showError('Run a simulation before exporting metrics.');
      return;
    }
    const lines = [['Algorithm', 'Process ID', 'Arrival Time', 'Burst Time', 'Completion Time', 'Turnaround Time', 'Waiting Time', 'Response Time']];
    for (const [key, label] of [['np', 'Non-Preemptive SJF'], ['srtf', 'Preemptive SJF / SRTF']]) {
      const result = lastResults[key];
      if (!result) continue;
      for (const p of result.processes.slice().sort((a, b) => a.order - b.order)) {
        lines.push([label, p.id, p.arrival, p.burst, p.completion, p.turnaround, p.waiting, p.response]);
      }
      lines.push([label, 'AVERAGE', '', '', '', result.avgTurnaround, result.avgWaiting, result.avgResponse]);
    }
    const csv = lines.map((line) => line.map((cell) => {
      const value = String(cell ?? '');
      return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
    }).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sjf-srtf-simulation-results.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  els.add.addEventListener('click', () => {
    if (els.inputs.children.length >= 30) { showError('The simulator supports a maximum of 30 processes.'); return; }
    addInputRow(); hideError();
  });
  els.reset.addEventListener('click', () => {
    setInputs(SAMPLE);
    hideError();
    setMode('both');
    runSimulation();
  });
  document.querySelectorAll('.algorithm-option').forEach((button) => button.addEventListener('click', () => setMode(button.dataset.mode)));
  els.run.addEventListener('click', runSimulation);
  els.export.addEventListener('click', exportCsv);

  // Small top-of-page reading progress indicator.
  function updateProgress() {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const percent = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
    els.progress.style.width = `${Math.min(100, Math.max(0, percent))}%`;
  }
  window.addEventListener('scroll', updateProgress, { passive: true });
  window.addEventListener('resize', updateProgress);

  setInputs(SAMPLE);
  setMode('both');
  runSimulation();
  updateProgress();
})();
