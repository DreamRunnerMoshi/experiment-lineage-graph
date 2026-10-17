"""Rebuild examples/demo.html (network) and examples/demo-lanes.html (lanes) from the templates and example CSVs.

Run from the repository root after changing a template or the example data:
    python3 examples/build_demos.py
"""
import csv, json, re

T = "skills/experiment-lineage-graph/template/"
FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com">\n'
         '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600'
         '&family=Source+Serif+4:wght@400;600&display=swap">\n')


def rows(name):
    with open(T + name, newline="") as f:
        return list(csv.DictReader(f))


def fragment(name, cfg):
    frag = re.sub(r"^<!--.*?-->\n", "", open(T + name).read(), flags=re.S)
    for old, new in cfg:
        assert old in frag, old
        frag = frag.replace(old, new)
    return frag


def page(title, data, frag):
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
{FONTS}<title>{title}</title>
<style>
{open(T + "standalone-tokens.css").read()}
body {{ margin: 0; font-family: var(--font-anthropic-sans); }}
</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js"></script>
</head>
<body>
<script>window.LG_DATA = {json.dumps(data)};</script>
<script>
{open(T + "standalone-shim.js").read()}
</script>
{frag}
</body>
</html>
"""


nodes, edges = rows("example-nodes.csv"), rows("example-edges.csv")
network = fragment("network-graph.html", [
    ("title: 'How the experiments connect',", "title: 'Example project (fictional): sentiment classifier experiments',"),
    ("metricLabel: 'MAP@3',", "metricLabel: 'Macro-F1',"),
])
lanes = fragment("lineage-graph.html", [
    ("title: 'Experiment lineage',", "title: 'Example project (fictional): sentiment classifier lineage',"),
    ("metricLabel: 'MAP@3',", "metricLabel: 'Macro-F1',"),
    ("lanes: null,", "lanes: ['Baseline', 'LLM prompting', 'Fine-tuning', 'Ensemble'],"),
])
data = {"nodes": nodes, "edges": edges, "entities": rows("example-entities.csv"), "uses": rows("example-uses.csv")}
open("examples/demo.html", "w").write(page("Experiment graph demo", data, network))
open("examples/demo-lanes.html", "w").write(page("Experiment lanes demo", {"nodes": nodes, "edges": edges}, lanes))
print("built examples/demo.html and examples/demo-lanes.html")
