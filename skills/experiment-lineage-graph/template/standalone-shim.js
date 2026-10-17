// Minimal stand-in for the Dashboard type's `dash` API, so lineage-graph.html also runs in a plain HTML artifact.
// Put the rows inline (window.LG_DATA = {nodes: [...], edges: [...]}) BEFORE this script; values may be strings or numbers.
// Supports only what the template uses: data, onData, calc, colors.
(() => {
  const DATA = window.LG_DATA || {}, calcs = {}, subs = [];
  const run = (id) => {
    if (id in DATA) return DATA[id];
    const c = calcs[id];
    return c ? c.fn(...c.inputs.map(run)) : undefined;
  };
  window.dash = {
    colors: ['var(--lg-accent)', 'var(--lg-accent-2)'],
    data(id) {
      try { const d = run(id); return d === undefined ? { status: 'missing', data: [] } : { status: 'ok', data: d }; }
      catch (e) { return { status: 'error', data: [], message: String(e) }; }
    },
    calc(id, spec) { calcs[id] = spec; },
    loader() {}, setLink() {}, params: () => ({}), setParams() {}, resetParams() {},
    onData(fn) {
      subs.push(fn);
      const go = () => subs.forEach((f) => f());
      fn();   // the template's script comes after its markup, so the elements already exist
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go, { once: true });   // re-measure widths
      let t; window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(go, 120); });
    },
  };
})();
