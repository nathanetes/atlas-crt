// Atlas CRT settings: appearance, layout and which modules show, all kept in this browser. The
// values live in K.ui, and atlasAppearance (in index.html) applies them to the page.
(function () {
  const K = window.Atlas;
  if (!K || !K.engine) return;
  const $ = (id) => document.getElementById(id);
  const { ui, el, icon, toast } = K;
  const { clamp } = window.AtlasAuto;

  const ACCENTS = [
    ['', 'Phosphor', '#30d158'], ['#0a84ff', 'Blue', '#0a84ff'], ['#bf5af2', 'Purple', '#bf5af2'], ['#ff375f', 'Pink', '#ff375f'],
    ['#ff9f0a', 'Orange', '#ff9f0a'], ['#ffd60a', 'Yellow', '#ffd60a'], ['#64d2ff', 'Sky', '#64d2ff'],
  ];
  const DEFAULT_LAYOUT = { rackSide: 'right', rackW: 372, tlPos: 'bottom', tlH: 290, textSize: 1 };

  K.applyLayout = () => {
    window.atlasAppearance(ui);
    K.saveUi();
    K.fitView();
    K.emit('theme');
    K.emit('layout');
  };

  // ------------------------------------------------------------ the two quick buttons
  const looksDark = () => (ui.theme === 'system' ? matchMedia('(prefers-color-scheme: dark)').matches : ui.theme !== 'light');
  $('themeBtn').onclick = () => { ui.theme = looksDark() ? 'light' : 'dark'; K.applyLayout(); };
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (ui.theme === 'system') K.emit('theme'); });

  const tools = $('toolsPop'), toolsBtn = $('toolsBtn');
  toolsBtn.onclick = () => {
    const open = tools.hidden;
    K.closePops();
    if (!open) return;
    tools.hidden = false;
    toolsBtn.setAttribute('aria-expanded', 'true');
    K.placePop(tools, toolsBtn, 'below');
  };

  // ------------------------------------------------------------ dragging the panels apart
  function resizer(id, onMove) {
    const bar = $(id);
    bar.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      bar.setPointerCapture(e.pointerId);
      bar.onpointermove = onMove;
      bar.onpointerup = bar.onpointercancel = () => { bar.onpointermove = null; K.saveUi(); };
    });
  }
  resizer('rackResize', (e) => {
    const box = $('work').getBoundingClientRect();
    const w = ui.rackSide === 'left' ? e.clientX - box.left - 10 : box.right - e.clientX - 10;
    ui.rackW = Math.round(clamp(w, 280, Math.min(640, box.width - 320)));
    document.documentElement.style.setProperty('--rack-w', ui.rackW + 'px');
  });
  resizer('tlResize', (e) => {
    const nav = document.querySelector('.nav').getBoundingClientRect().bottom;
    const h = ui.tlPos === 'top' ? e.clientY - nav - 10 : innerHeight - e.clientY - 10;
    ui.tlH = Math.round(clamp(h, 120, innerHeight - nav - 220));
    document.documentElement.style.setProperty('--tl-h', ui.tlH + 'px');
  });

  // ------------------------------------------------------------ the sheet
  const dlg = $('settings'), body = $('settingsBody');
  const group = (title, ...children) => {
    const g = el('section', 'set-group');
    g.append(el('h3', '', title), ...children);
    return g;
  };
  const row = (label, control) => {
    const r = el('div', 'set-row');
    r.append(el('span', '', label), control);
    return r;
  };
  const seg = (items, value, onChange) => {
    const host = el('div');
    K.segmented(host, items, value, onChange);
    const s = host.firstChild;
    s.style.flex = '0 1 280px';
    s.style.width = '280px';
    s.style.maxWidth = '100%';
    return s;
  };

  function accents() {
    const box = el('div', 'swatches');
    const paint = () => {
      [...box.querySelectorAll('.swatch')].forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === ui.accent)));
    };
    ACCENTS.forEach(([v, name, shown]) => {
      const b = el('button', 'swatch');
      b.type = 'button';
      b.title = name;
      b.setAttribute('aria-label', name);
      b.dataset.v = v;
      b.style.setProperty('--c', shown);
      b.onclick = () => { ui.accent = v; K.applyLayout(); paint(); };
      box.append(b);
    });
    const pick = el('input', 'swatch-custom');
    pick.type = 'color';
    pick.title = 'Any color';
    pick.setAttribute('aria-label', 'Any color');
    pick.value = ui.accent || '#30d158';
    pick.oninput = () => { ui.accent = pick.value; K.applyLayout(); paint(); };
    box.append(pick);
    paint();
    return box;
  }

  function moduleList() {
    const list = el('ul', 'mod-list');
    const titles = Object.fromEntries(K.modules().map((m) => [m.id, m.title]));
    const paint = () => {
      list.replaceChildren(...ui.modOrder.map((id, i) => {
        const li = el('li');
        const move = (name, dir, label) => {
          const b = el('button', 'icon-btn');
          b.type = 'button';
          b.setAttribute('aria-label', label + ' ' + titles[id]);
          b.append(icon(name));
          b.disabled = !ui.modOrder[i + dir];
          b.onclick = () => {
            const o = ui.modOrder;
            [o[i], o[i + dir]] = [o[i + dir], o[i]];
            K.saveUi(); K.layoutModules(); paint();
          };
          return b;
        };
        const show = el('button', 'switch');
        show.type = 'button';
        show.setAttribute('role', 'switch');
        show.setAttribute('aria-label', 'Show ' + titles[id]);
        show.setAttribute('aria-checked', String(!ui.modHidden.includes(id)));
        show.onclick = () => {
          ui.modHidden = ui.modHidden.includes(id) ? ui.modHidden.filter((x) => x !== id) : [...ui.modHidden, id];
          K.saveUi(); K.layoutModules(); paint();
        };
        li.append(el('span', '', titles[id]), move('i-up', -1, 'Move up'), move('i-chevron', 1, 'Move down'), show);
        return li;
      }));
    };
    paint();
    return list;
  }

  function shortcuts() {
    const list = el('div', 'keys-list');
    [['Space', 'Play or pause'], ['⌘Z / ⇧⌘Z', 'Undo and redo'], ['← →', 'Nudge the playhead or selected keyframes a frame'], ['Delete', 'Delete selected keyframes'],
      ['Home', 'Go to the start'], ['C', 'Compare with the source'], ['Z', 'View at 100%']].forEach(([key, what]) => {
      list.append(el('kbd', '', key), el('span', '', what));
    });
    return list;
  }

  function render() {
    const reset = el('button', 'btn btn-secondary btn-xs', 'Reset Layout');
    reset.type = 'button';
    reset.onclick = () => {
      Object.assign(ui, DEFAULT_LAYOUT, { modOrder: [], modHidden: [], pinned: [], laneH: {} });
      K.layoutModules();
      K.applyLayout();
      render();
      toast('Layout reset.');
    };
    const importBtn = el('button', 'btn btn-secondary btn-xs', 'Import Looks');
    importBtn.type = 'button';
    importBtn.onclick = K.looksIO.importFile;
    const exportBtn = el('button', 'btn btn-secondary btn-xs', 'Export All Looks');
    exportBtn.type = 'button';
    exportBtn.onclick = K.looksIO.exportAll;
    const dataRow = el('div', 'rec-row');
    dataRow.append(exportBtn, importBtn);
    body.replaceChildren(
      group('Appearance',
        row('Theme', seg([['system', 'System'], ['light', 'Light'], ['dark', 'Dark'], ['terminal', 'Terminal']], ui.theme, (v) => { ui.theme = v; K.applyLayout(); })),
        row('Accent', accents()),
        row('Text size', seg([[0.92, 'Small'], [1, 'Medium'], [1.12, 'Large']], ui.textSize, (v) => { ui.textSize = v; K.applyLayout(); }))),
      group('Layout',
        row('Controls', seg([['left', 'Left'], ['right', 'Right']], ui.rackSide, (v) => { ui.rackSide = v; K.applyLayout(); })),
        row('Timeline', seg([['top', 'Top'], ['bottom', 'Bottom'], ['hidden', 'Hidden']], ui.tlPos, (v) => { ui.tlPos = v; K.applyLayout(); })),
        el('p', 'fineprint', 'Drag the gaps between panels to resize them.')),
      group('Modules', moduleList()),
      group('Your looks', el('p', 'fineprint', 'Looks are kept in this browser, at this address. A file keeps them safe anywhere.'), dataRow),
      group('Keyboard', shortcuts()),
      reset,
    );
  }

  $('settingsBtn').onclick = () => { K.closePops(); render(); dlg.showModal(); };
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg || e.target.closest('[data-close]')) dlg.close();
  });
})();
