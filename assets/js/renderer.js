

'use strict';


const PROCESS_COLORS_CSS = ['p0','p1','p2','p3','p4','p5','p6','p7','p8','p9','p10','p11'];
const PROCESS_COLORS_HEX = [
  '#4f9eff','#00ddb5','#ff5f5f','#f5a623',
  '#a78bfa','#f472b6','#34d399','#fb923c',
  '#60a5fa','#e879f9','#2dd4bf','#fbbf24',
];

const ALGO_LABELS = {
  fcfs:        'FCFS',
  sjf_np:      'SJF',
  sjf_p:       'SRTF',
  priority_np: 'Priority NP',
  priority_p:  'Priority P',
  rr:          'Round Robin',
};

const ALGO_COLORS = {
  fcfs:        '#4f9eff',
  sjf_np:      '#00ddb5',
  sjf_p:       '#f5a623',
  priority_np: '#a78bfa',
  priority_p:  '#f472b6',
  rr:          '#fb923c',
};




function buildTabs(algos, allResults, stepStates) {
  const nav    = document.getElementById('tabsNav');
  const body   = document.getElementById('tabPanels');
  nav.innerHTML  = '';
  body.innerHTML = '';

  algos.forEach((algo, i) => {
    const color = ALGO_COLORS[algo];
    const label = ALGO_LABELS[algo];
    const isFirst = i === 0;

    // Tab button
    const btn = document.createElement('button');
    btn.className  = 'tab-btn' + (isFirst ? ' is-active' : '');
    btn.dataset.tab = algo;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', isFirst ? 'true' : 'false');
    if (isFirst) {
      btn.style.color = color;
      btn.style.borderBottomColor = color;
    }
    btn.innerHTML = `
      <span style="width:6px;height:6px;border-radius:50%;background:${color};
                   display:inline-block;margin-right:5px;vertical-align:middle"
            aria-hidden="true"></span>${label}`;
    btn.addEventListener('click', () => switchTab(algo));
    nav.appendChild(btn);

    // Panel
    const panel = document.createElement('div');
    panel.id        = `panel-${algo}`;
    panel.className = 'tab-panel' + (isFirst ? ' is-active' : '');
    panel.setAttribute('role', 'tabpanel');
    panel.innerHTML = buildAlgoPanel(algo, allResults[algo]);
    body.appendChild(panel);

    renderGantt(algo, allResults[algo], stepStates[algo].step);
    wirePanel(algo, allResults, stepStates);
  });

  // Compare tab when 2+ algos selected
  if (algos.length > 1) {
    const btn = document.createElement('button');
    btn.className   = 'tab-btn';
    btn.dataset.tab = '__compare__';
    btn.setAttribute('role', 'tab');
    btn.textContent = '⚖ Compare';
    btn.addEventListener('click', () => switchTab('__compare__'));
    nav.appendChild(btn);

    const panel = document.createElement('div');
    panel.id        = 'panel-__compare__';
    panel.className = 'tab-panel';
    panel.setAttribute('role', 'tabpanel');
    panel.innerHTML = buildComparePanel(algos, allResults);
    body.appendChild(panel);
  }
}

function switchTab(key) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    const active = btn.dataset.tab === key;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
    const color = ALGO_COLORS[btn.dataset.tab] || 'var(--blue)';
    btn.style.color            = active ? color : '';
    btn.style.borderBottomColor = active ? color : 'transparent';
  });

  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('is-active', panel.id === `panel-${key}`);
  });
}


// ── Algorithm panel HTML 

function buildAlgoPanel(algo, result) {
  const { procs, schedule, avgWT, avgTAT } = result;
  const color = ALGO_COLORS[algo];
  const label = ALGO_LABELS[algo];
  const total = schedule.length;

  const rows = procs.map(p => `
    <tr>
      <td>
        <span class="pid-dot" style="background:${PROCESS_COLORS_HEX[p.pid % PROCESS_COLORS_HEX.length]}"></span>
        ${p.id}
      </td>
      <td>${p.arrival}</td>
      <td>${p.burst}</td>
      <td><strong style="color:${color}">${p.ct || 0}</strong></td>
      <td>${Math.max(0, p.tat)}</td>
      <td>${Math.max(0, p.wt)}</td>
    </tr>`).join('');

  return `
    <div class="gantt-card" style="border-color:${color}30">
      <div class="gantt-heading">
        <span class="gantt-heading-accent" style="background:${color}"></span>
        ${label} — Gantt chart
      </div>

      <div class="playback">
        <button class="btn btn-outline btn-xs" data-algo="${algo}" data-action="back">◀ Back</button>
        <button class="btn btn-xs" style="background:${color};color:#fff" data-algo="${algo}" data-action="play">▶ Play</button>
        <button class="btn btn-outline btn-xs" data-algo="${algo}" data-action="fwd">Fwd ▶</button>
        <span class="playback-info" id="stepInfo-${algo}">Step ${total} / ${total}</span>
        <button class="btn btn-outline btn-xs" data-algo="${algo}" data-action="replay">⟳ Restart</button>
      </div>

      <div class="progress-track">
        <div class="progress-thumb" id="prog-${algo}" style="width:100%"></div>
      </div>

      <div class="gantt-scroll">
        <div class="gantt-row"     id="gchart-${algo}"></div>
        <div class="gantt-tick-row" id="gtimeline-${algo}"></div>
      </div>

      <div class="legend" id="glegend-${algo}"></div>
    </div>

    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-label">Avg waiting time</div>
        <div class="stat-value" style="color:${color}">${avgWT.toFixed(2)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Avg turnaround time</div>
        <div class="stat-value" style="color:var(--teal)">${avgTAT.toFixed(2)}</div>
      </div>
    </div>

    <div class="panel">
      <h2 class="panel-title">Process results</h2>
      <div class="results-wrap">
        <table class="results-table">
          <thead>
            <tr>
              <th>PID</th><th>Arrival</th><th>Burst</th>
              <th>CT</th><th>TAT</th><th>WT</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="export-row">
        <button class="btn btn-outline btn-xs" data-algo="${algo}" data-action="json">↓ JSON</button>
        <button class="btn btn-outline btn-xs" data-algo="${algo}" data-action="csv">↓ CSV</button>
        <button class="btn btn-outline btn-xs" onclick="window.print()">⎙ Print</button>
      </div>
    </div>`;
}


// ── Comparison panel HTML

function buildComparePanel(algos, allResults) {
  const wts   = algos.map(a => allResults[a].avgWT);
  const tats  = algos.map(a => allResults[a].avgTAT);
  const bestWT  = Math.min(...wts);
  const bestTAT = Math.min(...tats);
  const maxWT   = Math.max(...wts,  0.01);
  const maxTAT  = Math.max(...tats, 0.01);

  const tableRows = algos.map(a => {
    const r      = allResults[a];
    const isBW   = Math.abs(r.avgWT  - bestWT)  < 0.001;
    const iBT    = Math.abs(r.avgTAT - bestTAT) < 0.001;
    const ctxSw  = r.schedule.filter(b => !b.idle).length;
    const idleT  = r.schedule.filter(b => b.idle).reduce((s, b) => s + (b.end - b.start), 0);
    return `
      <tr>
        <td><span class="algo-chip" style="background:${ALGO_COLORS[a]}">${ALGO_LABELS[a]}</span></td>
        <td class="${isBW  ? 'cell-best' : ''}">${r.avgWT.toFixed(2)}${isBW  ? ' 🏆' : ''}</td>
        <td class="${iBT   ? 'cell-best' : ''}">${r.avgTAT.toFixed(2)}${iBT  ? ' 🏆' : ''}</td>
        <td>${ctxSw}</td>
        <td>${idleT}</td>
      </tr>`;
  }).join('');

  const makeBar = (a, val, max) => `
    <div class="bar-item">
      <div class="bar-header">
        <span class="bar-label" style="color:${ALGO_COLORS[a]}">${ALGO_LABELS[a]}</span>
        <span class="bar-val">${val.toFixed(2)}</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${(val / max * 100).toFixed(1)}%;background:${ALGO_COLORS[a]}"></div>
      </div>
    </div>`;

  const wtBars  = algos.map(a => makeBar(a, allResults[a].avgWT,  maxWT)).join('');
  const tatBars = algos.map(a => makeBar(a, allResults[a].avgTAT, maxTAT)).join('');

  return `
    <div class="panel" style="margin-bottom:14px">
      <h2 class="panel-title">Side-by-side comparison</h2>
      <div class="results-wrap">
        <table class="compare-table">
          <thead>
            <tr>
              <th>Algorithm</th>
              <th>Avg WT</th>
              <th>Avg TAT</th>
              <th>Context switches</th>
              <th>Idle time</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
    </div>

    <div class="bar-group">
      <div class="bar-section">
        <h2 class="panel-title">Avg waiting time</h2>
        ${wtBars}
      </div>
      <div class="bar-section">
        <h2 class="panel-title">Avg turnaround time</h2>
        ${tatBars}
      </div>
    </div>`;
}


// ── Gantt rendering 
function renderGantt(algo, result, upTo) {
  const chartEl    = document.getElementById(`gchart-${algo}`);
  const timelineEl = document.getElementById(`gtimeline-${algo}`);
  const legendEl   = document.getElementById(`glegend-${algo}`);
  if (!chartEl) return;

  const { schedule, procs } = result;
  const slice = schedule.slice(0, upTo);

  chartEl.innerHTML    = '';
  timelineEl.innerHTML = '';

  if (!slice.length) return;

  const totalTime = slice[slice.length - 1].end;
  const unit = Math.min(60, Math.max(32, Math.floor(700 / Math.max(totalTime, 1))));

  // Blocks
  slice.forEach(blk => {
    const w    = Math.max((blk.end - blk.start) * unit, 28);
    const div  = document.createElement('div');
    const cls  = blk.idle ? 'g-block--idle' : `g-block--${PROCESS_COLORS_CSS[blk.pid % PROCESS_COLORS_CSS.length]}`;
    div.className    = `g-block ${cls}`;
    div.style.width  = `${w}px`;
    div.setAttribute('data-tip', `${blk.id} [${blk.start}–${blk.end}]  Δ${blk.end - blk.start}`);
    div.innerHTML = `
      <span class="g-block-label">${blk.id}</span>
      <span class="g-block-dur">${blk.end - blk.start}</span>`;
    chartEl.appendChild(div);
  });

  // Timeline
  const times = [...new Set(slice.flatMap(b => [b.start, b.end]))].sort((a, b) => a - b);
  times.forEach(t => {
    const bi   = slice.findIndex(b => b.start === t);
    const w    = bi >= 0 ? Math.max((slice[bi].end - slice[bi].start) * unit, 28) : unit;
    const tick = document.createElement('div');
    tick.className   = 'g-tick';
    tick.style.width = `${w}px`;
    tick.textContent = t;
    timelineEl.appendChild(tick);
  });

  // Legend
  if (legendEl) {
    const seen = new Set();
    legendEl.innerHTML = '';
    procs.forEach(p => {
      if (seen.has(p.id)) return;
      seen.add(p.id);
      const el = document.createElement('div');
      el.className = 'legend-item';
      el.innerHTML = `
        <span class="legend-swatch" style="background:${PROCESS_COLORS_HEX[p.pid % PROCESS_COLORS_HEX.length]}"></span>
        ${p.id}`;
      legendEl.appendChild(el);
    });

    const idle = document.createElement('div');
    idle.className = 'legend-item';
    idle.innerHTML = `
      <span class="legend-swatch" style="background:var(--surface-3);border:1px dashed var(--border-default)"></span>
      Idle`;
    legendEl.appendChild(idle);
  }
}


// ── Panel wiring (step controls + export)─

function wirePanel(algo, allResults, stepStates) {
  const panel = document.getElementById(`panel-${algo}`);
  if (!panel) return;

  const total = allResults[algo].schedule.length;

  function refresh() {
    const s = stepStates[algo].step;
    renderGantt(algo, allResults[algo], s);
    const info = document.getElementById(`stepInfo-${algo}`);
    const prog = document.getElementById(`prog-${algo}`);
    if (info) info.textContent = `Step ${s} / ${total}`;
    if (prog) prog.style.width = total > 0 ? `${(s / total) * 100}%` : '0%';
  }

  function stopPlay() {
    clearInterval(stepStates[algo].interval);
    stepStates[algo].interval = null;
    const pb = panel.querySelector('[data-action="play"]');
    if (pb) pb.textContent = '▶ Play';
  }

  panel.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.dataset.algo !== algo) return;

    switch (btn.dataset.action) {
      case 'back':
        if (stepStates[algo].step > 0) { stepStates[algo].step--; refresh(); }
        break;
      case 'fwd':
        if (stepStates[algo].step < total) { stepStates[algo].step++; refresh(); }
        break;
      case 'replay':
        stopPlay();
        stepStates[algo].step = 0;
        refresh();
        break;
      case 'play':
        if (stepStates[algo].interval) { stopPlay(); break; }
        btn.textContent = '⏸ Pause';
        stepStates[algo].interval = setInterval(() => {
          if (stepStates[algo].step < total) { stepStates[algo].step++; refresh(); }
          else stopPlay();
        }, 480);
        break;
      case 'json':
        exportJSON(algo, allResults);
        break;
      case 'csv':
        exportCSV(algo, allResults);
        break;
    }
  });
}


// ── Export
function exportJSON(algo, allResults) {
  const r   = allResults[algo];
  const out = r.procs.map(p => ({
    id: p.id, arrival: p.arrival, burst: p.burst,
    ct: p.ct || 0, tat: Math.max(0, p.tat), wt: Math.max(0, p.wt),
  }));
  download(
    new Blob([JSON.stringify({ algorithm: ALGO_LABELS[algo], avgWT: r.avgWT.toFixed(2), avgTAT: r.avgTAT.toFixed(2), processes: out, schedule: r.schedule }, null, 2)], { type: 'application/json' }),
    `${algo}-schedule.json`
  );
}

function exportCSV(algo, allResults) {
  const r = allResults[algo];
  let csv = `Algorithm,${ALGO_LABELS[algo]}\nAvg WT,${r.avgWT.toFixed(2)}\nAvg TAT,${r.avgTAT.toFixed(2)}\n\nPID,Arrival,Burst,CT,TAT,WT\n`;
  r.procs.forEach(p => {
    csv += `${p.id},${p.arrival},${p.burst},${p.ct || 0},${Math.max(0, p.tat)},${Math.max(0, p.wt)}\n`;
  });
  download(new Blob([csv], { type: 'text/csv' }), `${algo}-schedule.csv`);
}

function download(blob, filename) {
  const a  = document.createElement('a');
  a.href   = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
