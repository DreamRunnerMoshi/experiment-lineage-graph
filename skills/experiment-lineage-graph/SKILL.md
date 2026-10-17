---
name: experiment-lineage-graph
description: >-
  Build an interactive graph of a project's experiments (or model versions, ablations, prompt iterations, research
  steps) as a claude.ai artifact. Default: a force-directed network where experiments are circles showing their metric,
  shared techniques and models are nodes linked to every experiment that uses them, and "builds on" arrows carry the
  metric delta; zoom, pan, drag, hover to highlight neighbours, click for details. Alternative: a left-to-right lane
  layout (one lane per pipeline stage). Use when the user asks to visualise, map, chart or "show as a graph" the
  experiments, runs, iterations or decision history of a project, or wants a dashboard of experiment progress.
---

# Experiment graph

Two layouts over the same data. Use the **network** unless the user asks for a timeline or lanes.

**Network** (`template/network-graph.html`):
- **Circles** = experiments; the value inside is the metric ("plan" / "idea" if not run). Border colour and dash = status. An accent ring marks the best valid result.
- **Pills** = techniques, **boxes** = models (and optional dashed **stage** nodes). Dashed thin lines link each experiment to what it uses, so experiments that share methods cluster together.
- **Arrows** = "builds on" (parent -> child) with the metric delta at the midpoint, green if better, red if worse; dashed into future work. Hovering an arrow shows the change it made.
- **Interaction:** click (or Enter) a node to select it with all its connected nodes and links (heavy border on it, bold border on neighbours, connecting links darker and thicker, everything else faded); the selection stays until the node is clicked again, an empty spot is clicked or Esc is pressed, and it survives redraws and toggles. Hovering another node previews its connections, then returns to the selection. The details panel shows an experiment's scores and what it uses, or a technique's description and every experiment using it, with scores. Drag nodes, scroll or pinch to zoom, "Fit to view", "Re-arrange", and checkboxes to show techniques / models / stages.
- **Layout:** computed once (no motion while reading). `CFG.flow` adds a gentle left-to-right pull by lineage depth so the story still reads; set it to 0 for a free layout.

**Lanes** (`template/lineage-graph.html`): boxes in one lane per stage, one column per lineage step, arrows labelled with the change above and the delta below. Clearer for a strict chain; it scrolls sideways when long.

Files in `template/`:

| File | Use |
|---|---|
| `network-graph.html` | Network layout fragment (style + markup + script). Edit only `CFG`. |
| `lineage-graph.html` | Lane layout fragment. Edit only `CFG`. |
| `standalone-shim.js` | Small stand-in for the Dashboard type's `dash` API, for a plain HTML artifact. |
| `standalone-tokens.css` | The colour / type / spacing tokens both pages expect, light + dark, for a plain artifact. |
| `example-*.csv` | Example nodes, edges, entities, uses. |
| `test.cjs` | Headless check (jsdom) of either layout on any CSVs. |

## 1. Gather the data (from the project, never invented)

- **nodes**, one row per experiment. Required: `id, stage, title, status, <metric>`. Optional, shown in details: `finding, model, eval_set, date, folder`, plus anything in `CFG.detailFields`.
  - `status` is one of `done`, `borderline`, `invalid`, `planned` (designed, not run), `idea` (proposed, not designed).
  - `<metric>` is empty when there is no result. One metric on one eval set for all rows; note exceptions in `finding`.
- **edges** (`from, to, change`): parent -> child, `change` a short phrase (<= 24 characters, e.g. `+ retrieval`). Leave it empty on merge edges.
- **entities** (network only; `id, type, label, description`): `type` is `technique` or `model` (others draw like models; name them in `CFG.entityTypes`). Keep labels short (<= 26 characters).
- **uses** (network only; `experiment, entity`): one row per experiment and technique or model it uses. This is what makes it a graph: list every method an experiment actually uses, not only the new one.

Where to read it: the project's experiment index; each experiment doc's "parent experiment" and setup sections; results from the run summaries. Proposals discussed but not designed go in as `idea`, and the hand-over says which those are. Leave out anything sensitive (personal data, raw competition or customer records): IDs, scores and short notes only.

## 2a. Build on the Dashboard artifact type (preferred when available)

1. `Artifact` `action: "quickstart"`, `intent: "other"`. If it names the Dashboard type, create one: publish with its `type_url`, a `title`, no files, `auto_open: "after_first_write"`. Follow the instructions that result carries; they override anything here about the store format.
2. Upload each CSV as an asset: `Artifact` publish with `url`, `asset: true`, `file_path` (one CSV per call). Keep the returned `/_blob/<id>` urls.
3. Copy the template to scratch and edit `CFG`:
   - Dataset ids (`nodes`, `edges`, `entities`, `uses`). If you rename one, also change it in the markup's `data-source="..."` attributes.
   - `metric`, `metricLabel`, `higherIsBetter` (false for loss or error), `digits`.
   - `laneNames` (display names per stage), `bestOnlyFromStages` / `bestOnlyFromLanes` when only one stage's results compete for "best".
   - Network: `flow`, `height`, `entityTypes`. Lanes: `lanes` (order) and `sizes`.
   The fragment can sit inside a larger page (tiles, a bar chart, a table): append its `<style>` to the page's, put its markup where it belongs, and add its `<script>` as a separate script (each runs in its own scope; its calc ids are prefixed `ng_` / `lg_`).
4. Wrap the page as `{"text": <html>}` in a local JSON file, then one `ArtifactData` `batch`: `dash/meta` `{title}`, one `datasets/<id>` per CSV (`{title, description, source: {kind: "file", url, name}, updated: {at, by}, fixed: true}`), and `files/index.html` via `file_path`.
5. Read `data/users/me` doc `runs` once for reported faults; fix only what your code confirms.

To update later: upload the new CSV, `update` the dataset's `source.url` and `updated` with `if_version`, then delete the old blob (`Artifact` `action: "delete"`, `path: <blob id>`).

## 2b. Plain HTML artifact (no Dashboard type)

One `.html` file, published with the Artifact tool (load the `artifact-design` guidance first if the tool asks):

```html
<title>Project experiment graph</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>/* contents of template/standalone-tokens.css */</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js"></script>
<script>window.LG_DATA = { nodes: [/* rows */], edges: [/* rows */], entities: [/* rows */], uses: [/* rows */] };</script>
<script>/* contents of template/standalone-shim.js */</script>
<!-- then the whole template fragment with CFG edited -->
```

The shim supports only what the templates use (`data`, `calc`, `onData`, `colors`) and redraws on resize.

## 3. Check before handing over

From a scratch dir with `npm i jsdom@24.1.3 d3@7.9.0` installed:

```
node <skill>/template/test.cjs network nodes.csv edges.csv entities.csv uses.csv <metric-column>
node <skill>/template/test.cjs lanes nodes.csv edges.csv <metric-column>
```

It reports nodes drawn, links, deltas, non-finite positions, the closest node pair (overlap if under 40 px), the selected node and dangling links (an id that is not defined). Fix dangling links and a wrong metric column ("deltas: none") before publishing. jsdom has no real layout, so this checks logic, not looks.

## Design rules (why the templates look the way they do)

- One accent colour only (the best result). Status uses the semantic ok / warn / bad colours plus dash patterns, so it also reads without colour. Techniques use the second series colour; models stay neutral.
- The network layout runs to rest before drawing and keeps positions across redraws, toggles and drags. Nothing moves on its own.
- Delta labels sit on a halo of the panel colour so they stay readable over lines. Change text appears on hover, which keeps the canvas clean.
- The zoom extent is set explicitly (`d3.zoom().extent(...)`); d3's default reads SVG size properties that some environments lack.
- Every value comes from the data; the page holds no numbers of its own.

## Hand-over (to the user)

Say what the graph shows, which nodes are `idea` (not designed yet), what the shared nodes are, that the data is a fixed copy refreshed on request, and that the artifact is private until shared from its Share menu (anyone it is shared with can read the attached data files).
