// Atlas CRT history: undo, redo and a list of everything changed this session. Every change goes
// through K.changed in rack.js, which calls note() here. A step is recorded once the change settles
// (the pointer is up and nothing else moved), so one drag is one step.
(function () {
  const K = window.Atlas;
  if (!K || !K.engine) return;
  const $ = (id) => document.getElementById(id);
  const { state, el, toast } = K;
  const LIMIT = 300, SETTLE = 300;

  let steps = [], at = -1, label = '', timer = 0, down = false;

  const snap = () => JSON.stringify({ params: state.params, enabled: state.enabled, auto: state.auto, micro: state.micro, look: state.look, length: state.length });

  function settle() {
    clearTimeout(timer);
    if (down) return;
    timer = setTimeout(() => {
      const s = snap();
      if (at >= 0 && s === steps[at].s) return;
      steps = steps.slice(0, at + 1);
      steps.push({ s, label: label || 'Change', when: Date.now() });
      if (steps.length > LIMIT) steps.shift();
      at = steps.length - 1;
      paint();
    }, SETTLE);
  }
  addEventListener('pointerdown', () => { down = true; }, true);
  const up = () => { if (down) { down = false; if (label) settle(); } };
  addEventListener('pointerup', up, true);
  addEventListener('pointercancel', up, true);

  // anything recorded late should still land before an undo reads the stack
  function flush() {
    clearTimeout(timer);
    const s = snap();
    if (at < 0 || s === steps[at].s) return;
    steps = steps.slice(0, at + 1);
    steps.push({ s, label: label || 'Change', when: Date.now() });
    at = steps.length - 1;
  }

  function go(i) {
    flush();
    if (i < 0 || i >= steps.length || i === at) return false;
    at = i;
    label = '';
    K.restoreState(JSON.parse(steps[at].s));
    paint();
    return true;
  }
  function undo() {
    const name = at >= 0 ? steps[at].label : '';
    if (go(at - 1)) toast('Undid ' + name);
  }
  function redo() { if (go(at + 1)) toast('Redid ' + steps[at].label); }

  const clock = (ms) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const pop = $('histPop'), btn = $('historyBtn');
  function paint() {
    $('undoBtn').disabled = at <= 0;
    $('redoBtn').disabled = at >= steps.length - 1;
    $('undoBtn').title = at > 0 ? 'Undo ' + steps[at].label + ' (⌘Z)' : 'Undo (⌘Z)';
    if (pop.hidden) return;
    const list = el('ol', 'hist-list');
    list.reversed = true;
    for (let i = steps.length - 1; i >= 0; i--) {
      const li = el('li'), b = el('button', 'hist-item' + (i === at ? ' now' : i > at ? ' future' : ''));
      b.type = 'button';
      b.append(el('span', '', steps[i].label), el('small', '', clock(steps[i].when)));
      b.onclick = () => go(i);
      li.append(b);
      list.append(li);
    }
    pop.replaceChildren(el('p', 'pop-eyebrow', 'This session'), list);
  }

  $('undoBtn').onclick = undo;
  $('redoBtn').onclick = redo;
  btn.onclick = () => {
    flush();
    const open = pop.hidden;
    K.closePops();
    if (!open) return;
    pop.hidden = false;
    paint();
    btn.setAttribute('aria-expanded', 'true');
    K.placePop(pop, btn, 'below');
  };

  document.addEventListener('keydown', (e) => {
    if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
    if (e.target.closest('input:not([type=range]), textarea')) return;
    const key = e.key.toLowerCase();
    if (key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if ((key === 'z' && e.shiftKey) || key === 'y') { e.preventDefault(); redo(); }
  });

  K.history = {
    note(l) { label = l; settle(); },
    // start the stack from what's on screen now
    reset() {
      steps = [{ s: snap(), label: 'Opened Atlas', when: Date.now() }];
      at = 0;
      paint();
    },
  };
})();
