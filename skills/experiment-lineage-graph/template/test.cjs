// Headless check of a template + standalone-shim.js on CSVs (no browser needed).
// Setup once in a scratch dir: npm i jsdom@24.1.3 d3@7.9.0
// Run from that dir:
//   node <skill>/template/test.cjs network nodes.csv edges.csv [entities.csv uses.csv] [metric]
//   node <skill>/template/test.cjs lanes   nodes.csv edges.csv [metric]
// With no CSVs it runs on the example data.
const fs = require('fs'), path = require('path'), { JSDOM } = require(path.resolve('node_modules/jsdom'));
const T = __dirname + '/', args = process.argv.slice(2), mode = args[0] === 'lanes' ? 'lanes' : 'network';
const files = args.slice(1).filter((a) => a.endsWith('.csv')), metric = args.slice(1).find((a) => !a.endsWith('.csv'));
const [nodesCsv = T + 'example-nodes.csv', edgesCsv = T + 'example-edges.csv', entCsv = T + 'example-entities.csv', usesCsv = T + 'example-uses.csv'] = files;
let tpl = fs.readFileSync(T + (mode === 'lanes' ? 'lineage-graph.html' : 'network-graph.html'), 'utf8');
if (metric) tpl = tpl.replace("metric: 'score'", `metric: '${metric}'`);
const w = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only', pretendToBeVisual: true }).window;
w.eval(fs.readFileSync(path.resolve('node_modules/d3/dist/d3.min.js'), 'utf8'));
const csv = (f) => (fs.existsSync(f) ? w.d3.csvParse(fs.readFileSync(f, 'utf8')) : []);
w.LG_DATA = { nodes: csv(nodesCsv), edges: csv(edgesCsv) };
if (mode === 'network') { w.LG_DATA.entities = csv(entCsv); w.LG_DATA.uses = csv(usesCsv); }
w.eval(fs.readFileSync(T + 'standalone-shim.js', 'utf8'));
w.document.body.innerHTML = tpl.replace(/<script>[\s\S]*<\/script>/, '');
w.eval(tpl.match(/<script>([\s\S]*)<\/script>/)[1]);
const q = (s) => [...w.document.querySelectorAll(s)];
const ids = new Set(w.LG_DATA.nodes.map((d) => d.id)), ent = new Set((w.LG_DATA.entities || []).map((e) => e.id));
const dangling = w.LG_DATA.edges.filter((e) => !ids.has(e.from) || !ids.has(e.to)).map((e) => e.from + '->' + e.to)
  .concat((w.LG_DATA.uses || []).filter((u) => !ids.has(u.experiment) || !ent.has(u.entity)).map((u) => u.experiment + '~' + u.entity));
if (mode === 'lanes') {
  console.log('nodes drawn', q('#lg-chart .lg-node').length, 'of', ids.size, '| lanes:', q('#lg-chart text.lg-lane').map((t) => t.textContent).join(', '));
  console.log('labels:', q('#lg-chart text.lg-nid').map((t) => t.textContent).join(' | '));
  console.log('deltas:', q('#lg-chart text.lg-up, #lg-chart text.lg-down').map((t) => t.textContent).join(' ') || '(none: check the metric column)');
  console.log('svg width', q('#lg-chart svg')[0]?.getAttribute('width'), '| dangling links:', dangling.join(', ') || 'none');
} else {
  const P = Object.entries(w.ngState.pos);
  let minD = Infinity, pair = '';
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
    const d = Math.hypot(P[i][1].x - P[j][1].x, P[i][1].y - P[j][1].y); if (d < minD) { minD = d; pair = P[i][0] + ' / ' + P[j][0]; }
  }
  console.log('nodes drawn', q('#ng-chart .ng-node').length, '(experiments', ids.size, '+ shared', ent.size + ') | links', q('#ng-chart line:not(.ng-hit)').length);
  console.log('deltas:', q('#ng-chart text.ng-up, #ng-chart text.ng-down').map((t) => t.textContent).join(' ') || '(none: check the metric column)');
  console.log('non-finite positions', P.filter(([, p]) => !isFinite(p.x) || !isFinite(p.y)).length, '| closest pair', pair, minD.toFixed(0) + 'px (overlap if < 40)');
  console.log('selected:', w.document.querySelector('#ng-detail strong')?.textContent, '| dangling links:', dangling.join(', ') || 'none');
}
