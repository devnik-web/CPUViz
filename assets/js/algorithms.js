/**
 * algorithms.js
 * ─────────────────────────────────────────────────────────
 * Pure scheduling algorithm implementations.
 * Each function receives a deep-cloned process array and
 * returns { schedule: [...blocks], procs: [...processes] }
 *
 * Schedule block shape:
 *   { id, pid, start, end, idle? }
 *
 * Process shape (input):
 *   { id, pid, arrival, burst, priority }
 * ─────────────────────────────────────────────────────────
 */

'use strict';

/* ----------------------------------------------------------
   Helpers
---------------------------------------------------------- */

/**
 * Deep-clone a process array, resetting `remaining` to burst.
 * @param {Array} procs
 * @returns {Array}
 */
function cloneProcesses(procs) {
  return procs.map(p => ({ ...p, remaining: p.burst }));
}

/**
 * Main dispatcher — clones processes then delegates.
 * @param {string} algo
 * @param {Array}  procs  — original process array (not mutated)
 * @param {number} quantum
 * @returns {{ schedule: Array, procs: Array }}
 */
function runAlgorithm(algo, procs, quantum) {
  const p = cloneProcesses(procs);

  const dispatch = {
    fcfs:        () => scheduleFCFS(p),
    sjf_np:      () => scheduleSJF_NP(p),
    sjf_p:       () => scheduleSJF_P(p),
    priority_np: () => schedulePriority_NP(p),
    priority_p:  () => schedulePriority_P(p),
    rr:          () => scheduleRR(p, quantum),
  };

  return (dispatch[algo] || dispatch.fcfs)();
}


/* ----------------------------------------------------------
   1. FCFS — First Come First Serve
   Non-preemptive. Sort by arrival time; ties broken by PID.
---------------------------------------------------------- */
function scheduleFCFS(procs) {
  const sorted = [...procs].sort((a, b) => a.arrival - b.arrival || a.pid - b.pid);
  let t = 0;
  const schedule = [];

  for (const p of sorted) {
    if (t < p.arrival) {
      schedule.push({ id: 'Idle', start: t, end: p.arrival, idle: true });
      t = p.arrival;
    }
    schedule.push({ id: p.id, pid: p.pid, start: t, end: t + p.burst });
    p.ct = t + p.burst;
    t   += p.burst;
  }

  return { schedule, procs: sorted };
}


/* ----------------------------------------------------------
   2. SJF — Shortest Job First (Non-Preemptive)
   At each decision point pick the arrived process with the
   smallest burst time. Ties → arrival time → PID.
---------------------------------------------------------- */
function scheduleSJF_NP(procs) {
  const n        = procs.length;
  const finished = new Array(n).fill(false);
  const schedule = [];
  let t = 0, done = 0;

  while (done < n) {
    const available = procs.filter((p, i) => !finished[i] && p.arrival <= t);

    if (!available.length) {
      const next = Math.min(...procs.filter((_, i) => !finished[i]).map(p => p.arrival));
      schedule.push({ id: 'Idle', start: t, end: next, idle: true });
      t = next;
      continue;
    }

    available.sort((a, b) => a.burst - b.burst || a.arrival - b.arrival || a.pid - b.pid);
    const p = available[0];
    schedule.push({ id: p.id, pid: p.pid, start: t, end: t + p.burst });
    t    += p.burst;
    p.ct  = t;
    finished[procs.indexOf(p)] = true;
    done++;
  }

  return { schedule, procs };
}


/* ----------------------------------------------------------
   3. SRTF — Shortest Remaining Time First (Preemptive SJF)
   At every event boundary (arrival / completion) select the
   process with the smallest remaining burst. Ties → PID.
---------------------------------------------------------- */
function scheduleSJF_P(procs) {
  const n        = procs.length;
  const rem      = procs.map(p => p.burst);
  const schedule = [];
  let t = 0, done = 0;

  while (done < n) {
    const available = procs.filter((p, i) => rem[i] > 0 && p.arrival <= t);

    if (!available.length) {
      const next = Math.min(...procs.filter((_, i) => rem[i] > 0).map(p => p.arrival));
      schedule.push({ id: 'Idle', start: t, end: next, idle: true });
      t = next;
      continue;
    }

    available.sort((a, b) => rem[procs.indexOf(a)] - rem[procs.indexOf(b)] || a.pid - b.pid);
    const p   = available[0];
    const idx = procs.indexOf(p);

    // Run until the next arrival or completion — whichever is sooner
    const futureArrivals = procs
      .filter((q, i) => rem[i] > 0 && q.arrival > t)
      .map(q => q.arrival);
    const nextArrival = futureArrivals.length ? Math.min(...futureArrivals) : Infinity;
    const runUntil    = Math.min(nextArrival, t + rem[idx]);

    // Merge consecutive blocks for the same process
    const last = schedule[schedule.length - 1];
    if (last && last.id === p.id && !last.idle) {
      last.end = runUntil;
    } else {
      schedule.push({ id: p.id, pid: p.pid, start: t, end: runUntil });
    }

    rem[idx] -= runUntil - t;
    t = runUntil;
    if (rem[idx] === 0) { p.ct = t; done++; }
  }

  return { schedule, procs };
}


/* ----------------------------------------------------------
   4. Priority Scheduling (Non-Preemptive)
   Lower number = higher priority. Ties → arrival → PID.
---------------------------------------------------------- */
function schedulePriority_NP(procs) {
  const n        = procs.length;
  const finished = new Array(n).fill(false);
  const schedule = [];
  let t = 0, done = 0;

  while (done < n) {
    const available = procs.filter((p, i) => !finished[i] && p.arrival <= t);

    if (!available.length) {
      const next = Math.min(...procs.filter((_, i) => !finished[i]).map(p => p.arrival));
      schedule.push({ id: 'Idle', start: t, end: next, idle: true });
      t = next;
      continue;
    }

    available.sort((a, b) => a.priority - b.priority || a.arrival - b.arrival || a.pid - b.pid);
    const p = available[0];
    schedule.push({ id: p.id, pid: p.pid, start: t, end: t + p.burst });
    t    += p.burst;
    p.ct  = t;
    finished[procs.indexOf(p)] = true;
    done++;
  }

  return { schedule, procs };
}


/* ----------------------------------------------------------
   5. Priority Scheduling (Preemptive)
   A newly arrived higher-priority process immediately
   preempts the running one.
---------------------------------------------------------- */
function schedulePriority_P(procs) {
  const n        = procs.length;
  const rem      = procs.map(p => p.burst);
  const schedule = [];
  let t = 0, done = 0;

  while (done < n) {
    const available = procs.filter((p, i) => rem[i] > 0 && p.arrival <= t);

    if (!available.length) {
      const next = Math.min(...procs.filter((_, i) => rem[i] > 0).map(p => p.arrival));
      schedule.push({ id: 'Idle', start: t, end: next, idle: true });
      t = next;
      continue;
    }

    available.sort((a, b) => a.priority - b.priority || a.arrival - b.arrival || a.pid - b.pid);
    const p   = available[0];
    const idx = procs.indexOf(p);

    const futureArrivals = procs
      .filter((q, i) => rem[i] > 0 && q.arrival > t)
      .map(q => q.arrival);
    const nextArrival = futureArrivals.length ? Math.min(...futureArrivals) : Infinity;
    const runUntil    = Math.min(nextArrival, t + rem[idx]);

    const last = schedule[schedule.length - 1];
    if (last && last.id === p.id && !last.idle) {
      last.end = runUntil;
    } else {
      schedule.push({ id: p.id, pid: p.pid, start: t, end: runUntil });
    }

    rem[idx] -= runUntil - t;
    t = runUntil;
    if (rem[idx] === 0) { p.ct = t; done++; }
  }

  return { schedule, procs };
}


/* ----------------------------------------------------------
   6. Round Robin
   Processes share CPU in time slices of `quantum` units.
   FIFO ready queue; newly arrived processes enqueued after
   the currently executing slice completes.
---------------------------------------------------------- */
function scheduleRR(procs, quantum) {
  const sorted   = [...procs].sort((a, b) => a.arrival - b.arrival || a.pid - b.pid);
  const rem      = sorted.map(p => p.burst);
  const schedule = [];
  let t = 0, done = 0, ptr = 0;
  const queue = [];

  // Seed with processes already available at t = 0
  while (ptr < sorted.length && sorted[ptr].arrival <= t) {
    queue.push(ptr);
    ptr++;
  }

  while (done < sorted.length) {
    if (!queue.length) {
      // CPU idle — fast-forward to next arrival
      const next = sorted[ptr] ? sorted[ptr].arrival : Infinity;
      schedule.push({ id: 'Idle', start: t, end: next, idle: true });
      t = next;
      while (ptr < sorted.length && sorted[ptr].arrival <= t) {
        queue.push(ptr);
        ptr++;
      }
      continue;
    }

    const idx  = queue.shift();
    const p    = sorted[idx];
    const exec = Math.min(quantum, rem[idx]);

    schedule.push({ id: p.id, pid: p.pid, start: t, end: t + exec });
    t        += exec;
    rem[idx] -= exec;

    // Enqueue processes that arrived during this slice
    while (ptr < sorted.length && sorted[ptr].arrival <= t) {
      queue.push(ptr);
      ptr++;
    }

    if (rem[idx] > 0) {
      queue.push(idx);         // not finished — re-queue
    } else {
      p.ct = t;
      done++;
    }
  }

  return { schedule, procs: sorted };
}
