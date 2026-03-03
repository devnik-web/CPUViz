

'use strict';



let processData = [];  
let allResults  = {};  
let stepStates  = {};  



const themeToggle = document.getElementById('themeToggle');
const themeIcon   = document.getElementById('themeIcon');

let theme = localStorage.getItem('cpuviz-theme') || 'dark';
document.documentElement.setAttribute('data-theme', theme);
themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';

themeToggle.addEventListener('click', () => {
  theme = theme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('cpuviz-theme', theme);
  themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
});




const algoList = document.getElementById('algoList');


algoList.addEventListener('click', e => {
  const item = e.target.closest('.algo-item');
  if (!item) return;
  toggleAlgoItem(item);
});

algoList.addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const item = e.target.closest('.algo-item');
  if (!item) return;
  e.preventDefault();
  toggleAlgoItem(item);
});

function toggleAlgoItem(item) {
  const checked = item.classList.toggle('is-checked');
  item.querySelector('.check-box').textContent = checked ? '✓' : '';
  item.setAttribute('aria-checked', checked ? 'true' : 'false');
  syncControls();
}

document.getElementById('selectAllBtn').addEventListener('click', () => {
  document.querySelectorAll('.algo-item').forEach(item => {
    item.classList.add('is-checked');
    item.querySelector('.check-box').textContent = '✓';
    item.setAttribute('aria-checked', 'true');
  });
  syncControls();
});

document.getElementById('noneBtn').addEventListener('click', () => {
  document.querySelectorAll('.algo-item').forEach(item => {
    item.classList.remove('is-checked');
    item.querySelector('.check-box').textContent = '';
    item.setAttribute('aria-checked', 'false');
  });
  syncControls();
});

function getSelectedAlgos() {
  return [...document.querySelectorAll('.algo-item.is-checked')]
    .map(el => el.dataset.value);
}

function syncControls() {
  const selected    = getSelectedAlgos();
  const needQuantum = selected.includes('rr');
  const needPriority = selected.some(a => ['priority_np', 'priority_p'].includes(a));

  document.getElementById('algoCount').textContent = `${selected.length} selected`;

  document.getElementById('quantumGroup')
    .classList.toggle('hidden', !needQuantum);

  document.getElementById('priorityHeader')
    .classList.toggle('hidden', !needPriority);

  document.querySelectorAll('.priority-cell')
    .forEach(td => td.classList.toggle('hidden', !needPriority));
}


// ── Process rows

document.getElementById('generateBtn').addEventListener('click', generateRows);

function generateRows() {
  const raw  = parseInt(document.getElementById('numProcesses').value);
  const n    = Math.max(1, Math.min(12, isNaN(raw) ? 4 : raw));
  const needPriority = getSelectedAlgos()
    .some(a => ['priority_np', 'priority_p'].includes(a));

  const tbody = document.getElementById('processTableBody');
  tbody.innerHTML = '';

  for (let i = 0; i < n; i++) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="pid-cell">P${i + 1}</td>
      <td><input type="number" class="arrival-input"  value="${i}"   min="0" /></td>
      <td><input type="number" class="burst-input"    value="${Math.floor(Math.random() * 6) + 2}" min="1" /></td>
      <td class="priority-cell${needPriority ? '' : ' hidden'}">
        <input type="number" class="priority-input" value="${i + 1}" min="1" />
      </td>`;
    tbody.appendChild(tr);
  }

  clearValidation();
}

function readProcessData() {
  const rows = document.querySelectorAll('#processTableBody tr');
  const needPriority = getSelectedAlgos()
    .some(a => ['priority_np', 'priority_p'].includes(a));
  const data = [];

  for (let i = 0; i < rows.length; i++) {
    const arrival  = parseInt(rows[i].querySelector('.arrival-input').value);
    const burst    = parseInt(rows[i].querySelector('.burst-input').value);
    const priEl    = rows[i].querySelector('.priority-input');
    const priority = priEl ? parseInt(priEl.value) : 1;

    if (isNaN(arrival) || arrival < 0)
      return { error: `P${i + 1}: arrival must be ≥ 0` };
    if (isNaN(burst) || burst < 1)
      return { error: `P${i + 1}: burst must be ≥ 1` };
    if (needPriority && (isNaN(priority) || priority < 1))
      return { error: `P${i + 1}: priority must be ≥ 1` };

    data.push({ id: `P${i + 1}`, pid: i, arrival, burst, priority, remaining: burst });
  }

  return { data };
}


// ── Run 

document.getElementById('runBtn').addEventListener('click', () => {
  clearValidation();

  const algos = getSelectedAlgos();
  if (!algos.length) {
    showError('Select at least one algorithm first.');
    return;
  }

  const { error, data } = readProcessData();
  if (error)       { showError(error); return; }
  if (!data.length) { showError('Generate process rows first.'); return; }

  const quantum = parseInt(document.getElementById('timeQuantum')?.value) || 2;
  if (algos.includes('rr') && quantum < 1) {
    showError('Time quantum must be ≥ 1');
    return;
  }

  processData = data;
  allResults  = {};
  stepStates  = {};

  algos.forEach(algo => {
    const result = runAlgorithm(algo, processData, quantum);

    result.procs.forEach(p => {
      p.tat = (p.ct || 0) - p.arrival;
      p.wt  = p.tat - p.burst;
    });

    allResults[algo] = {
      ...result,
      avgWT:  result.procs.reduce((s, p) => s + Math.max(0, p.wt),  0) / result.procs.length,
      avgTAT: result.procs.reduce((s, p) => s + Math.max(0, p.tat), 0) / result.procs.length,
    };

    stepStates[algo] = { step: result.schedule.length, interval: null };
  });

  buildTabs(algos, allResults, stepStates);

  document.getElementById('emptyState').classList.add('hidden');
  document.getElementById('resultsSection').classList.remove('hidden');
  document.getElementById('resultsSection')
    .scrollIntoView({ behavior: 'smooth', block: 'start' });
});


// ── Reset / Clear 

document.getElementById('resetBtn').addEventListener('click', () => {
  generateRows();
  showResults(false);
});

document.getElementById('clearBtn').addEventListener('click', () => {
  document.getElementById('processTableBody').innerHTML = '';
  clearValidation();
  showResults(false);
});

function showResults(visible) {
  document.getElementById('emptyState').classList.toggle('hidden', visible);
  document.getElementById('resultsSection').classList.toggle('hidden', !visible);
}


// ── Validation helpers

function showError(msg) {
  const el = document.getElementById('validationMsg');
  el.textContent = `⚠ ${msg}`;
  el.classList.remove('hidden');
}

function clearValidation() {
  const el = document.getElementById('validationMsg');
  el.textContent = '';
  el.classList.add('hidden');
}


// ── Init ──────────────────────────────────────────────────

generateRows();
syncControls();
