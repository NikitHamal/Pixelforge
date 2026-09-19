"""Dataset construction for the Nik1 specialists.

Everything here is derived from `nik1/data/*.json`, which `tools/export-data.js`
generates from the repository itself. Two rules make the numbers trustworthy:

* **Split by asset, not by example.** Retrieval queries are generated *from* a
  template's own name/tags, so a random example split leaks the answer into the
  validation set through shared vocabulary. Splits here are by template id.
* **Balanced by construction** where the natural label distribution is skewed
  (see the palette task), and the majority-class baseline is always computed so
  a model that learned nothing cannot look good.
"""
from __future__ import annotations

import json
import os
import random
import re
from dataclasses import dataclass

# `data/` is the generated training split (git-ignored); `models/` holds the
# tables that actually ship. Trainers prefer the former, the grammar prefers the
# latter, and either order falls back so a fresh clone — which has no data/ —
# can still generate datasets and reproduce the shipped metrics.
_HERE = os.path.dirname(__file__)
DATA = os.path.join(_HERE, "..", "..", "data")
MODELS = os.path.join(_HERE, "..", "..", "js", "models")


def table(name: str, prefer=("data", "models")):
    """Read a JSON table from the first directory in `prefer` that has it."""
    order = [DATA if d == "data" else MODELS for d in prefer]
    for d in order:
        path = os.path.join(d, name)
        if os.path.exists(path):
            with open(path) as fh:
                return json.load(fh)
    raise FileNotFoundError(f"{name} not found in {' or '.join(order)}")


def load(name: str):
    return table(name, prefer=("data", "models"))


# --------------------------------------------------------------------------
# shared: split by id
# --------------------------------------------------------------------------


def split_ids(ids: list[str], val_frac: float = 0.15, seed: int = 0):
    ids = sorted(set(ids))
    rnd = random.Random(seed)
    rnd.shuffle(ids)
    n_val = max(1, int(len(ids) * val_frac))
    return set(ids[n_val:]), set(ids[:n_val])


# --------------------------------------------------------------------------
# 1. router (utterance -> tool call)
# --------------------------------------------------------------------------

@dataclass
class RouteExample:
    text: str
    target: str
    tool: str
    args: dict


# Utterance patterns. `{k}` renders the *actual* argument value that goes into the
# target, so an utterance can never disagree with its own label — the classic
# failure mode of synthetic tool-call data.
ROUTE_PATTERNS: dict[str, list[str]] = {
    "load_template": ["open {id}", "load {id}", "give me {id}", "start from {id}", "i want {id}", "make me {id}", "switch to {id}", "open the {name}"],
    "list_templates": ["list {category} assets", "what {category} templates are there", "show me all assets", "browse the {category} templates", "list templates"],
    "append_template_states": ["add the {id} states", "merge {id} into this", "append {id} animations"],
    "list_projects": ["list my projects", "what projects do i have", "show saved projects"],
    "open_project": ["open project {id}", "load my {id} project", "switch to project {id}"],
    "new_project": ["new project called {name}", "create a {name} project", "start a fresh project named {name}"],
    "save_project": ["save this project", "save my work", "save the project"],
    "delete_project": ["delete project {id}", "remove the {id} project"],
    "duplicate_project": ["duplicate project {id}", "copy the {id} project"],
    "new_document": ["new {width}x{height} canvas", "create a blank {width} by {height} document", "start an empty {width} pixel canvas"],
    "resize_document": ["resize to {width} by {height}", "make the canvas {width}x{height}"],
    "rename_document": ["rename this document to {name}", "call this document {name}"],
    "undo": ["undo", "undo that", "go back one step", "take that back"],
    "redo": ["redo", "redo that", "put it back"],
    "set_active": ["select state {state}", "go to frame {frame}", "switch to layer {layer}"],
    "paint_rows": ["paint rows of ascii art", "paint these rows on the canvas"],
    "set_pixels": ["set a pixel at {x} {y} to {color}", "put a {color} pixel at {x},{y}", "pixel {x} {y} in {color}"],
    "draw_line": ["draw a {color} line from {x0} {y0} to {x1} {y1}", "line from {x0},{y0} to {x1},{y1} in {color}"],
    "draw_rect": ["draw a {color} rectangle at {x} {y}", "rect at {x} {y} size {width} by {height} filled", "draw a {color} box at {x},{y} {width} wide"],
    "draw_ellipse": ["draw a {color} circle at {x} {y}", "ellipse at {x} {y} size {width} by {height}", "draw a {color} ellipse"],
    "fill": ["flood fill at {x} {y} with {color}", "bucket fill {x},{y} in {color}", "fill the area at {x} {y}"],
    "clear": ["clear the canvas", "erase everything", "wipe the layer", "clear this region"],
    "flip": ["flip {axis}", "mirror the sprite on {axis}"],
    "shift": ["shift by {dx} {dy}", "move everything by {dx} to the right", "nudge the layer {dx} {dy}"],
    "outline": ["add a {color} outline", "outline the sprite in {color}", "give it a border"],
    "replace_color": ["replace {from} with {to}", "swap {from} for {to}"],
    "shade": ["shade that region by {amount}", "darken the area by {amount}", "brighten the area by {amount}"],
    "get_pixels": ["read the pixels", "show me the pixel rows", "what pixels are there"],
    "get_palette": ["show the palette", "what colors are available"],
    "set_palette": ["set the palette to {color}", "replace the palette with new colors"],
    "add_palette_color": ["add {color} to the palette", "put {color} in my colors"],
    "set_color": ["use color {color}", "set my color to {color}", "draw with {color}"],
    "add_layer": ["add a layer called {name}", "new layer named {name}"],
    "remove_layer": ["remove layer {index}", "delete layer {index}"],
    "set_layer": ["rename layer {index} to {name}", "hide layer {index}", "set layer {index} opacity"],
    "merge_layer_down": ["merge layer {index} down", "flatten layer {index}"],
    "list_states": ["list the animation states", "what states does this have"],
    "add_state": ["add a {name} state at {fps} fps", "make a {name} animation", "add {name} with {frames} frames"],
    "remove_state": ["remove state {index}", "delete the state at {index}"],
    "set_state": ["rename state {index} to {name}", "set state {index} to {fps} fps", "make state {index} loop"],
    "add_frame": ["add a frame", "duplicate this frame", "insert a blank frame"],
    "remove_frame": ["remove frame {index}", "delete this frame"],
    "move_frame": ["move frame {index} left", "move frame {index} right"],
    "set_frame_duration": ["set frame {index} to {ms} ms", "make frame {index} last {ms} milliseconds"],
    "play": ["play the animation", "start playback", "preview the loop"],
    "pause": ["pause", "stop the animation", "pause playback"],
    "export": ["export a {format}", "save this as {format}", "download the {format} file", "export {format} at {scale}x"],
    "render_preview": ["render a preview at {scale}x", "show me the sprite", "render the current frame"],
    "render_state": ["render every frame of state {state}", "show all frames as images"],
    "get_project": ["get the project json", "dump the project file"],
    "load_project": ["load this project json", "open the project from json"],
    "set_tool": ["switch to the {tool} tool", "use the {tool}", "select the {tool} tool", "brush size {size}"],
    "set_view": ["zoom to {zoom}", "turn the grid on", "show onion skin", "switch to dark theme"],
    "describe_ui": ["describe the ui", "what buttons are on screen"],
    "click_ui": ["click {id}", "press the {id} button"],
}

# Per-tool argument values. Generic fillers stay type-correct; the specific ones
# make the utterance and the label agree.
STATES = ["idle", "walk", "run", "attack", "cast", "hurt", "death", "jump", "block", "sit"]
FORMATS = ["png", "gif", "spritesheet", "json", "svg", "css", "project"]
TOOLS_UI = ["pencil", "eraser", "bucket", "line", "rect", "ellipse", "move", "eyedropper"]
COLORS = ["#ff0044", "#2ce8f5", "#63c74d", "#fee761", "#ffffff", "#181425", "#a22633", "#4a7fb5", "#e8b796"]
AXES = ["x", "y"]

# Semantically valid values for common numeric arguments. Without this the
# generator samples the whole schema range and produces targets like
# `direction: 5` — nonsense the model is then blamed for not learning.
SEMANTIC = {
    "direction": [-1, 1], "scale": [1, 2, 4, 8, 16], "zoom": [1, 2, 4, 8, 16],
    "index": [0, 1, 2, 3, 4, 5, 6, 7, 8], "frame": [0, 1, 2, 3, 4, 5, 6, 7, 8],
    "layer": [0, 1, 2, 3], "state": [0, 1, 2, 3, 4], "fps": [4, 6, 8, 10, 12],
    "ms": [50, 80, 100, 125, 167, 250], "amount": [-24, -16, -8, 8, 16, 24],
    "dx": [-16, -8, -4, 4, 8, 12, 16, 30], "dy": [-16, -8, -4, 4, 7, 8, 16],
    "x": [0, 2, 4, 8, 12, 16, 20, 24], "y": [0, 2, 4, 8, 12, 16, 20, 24],
    "x0": [0, 3, 4, 8, 16], "y0": [0, 3, 4, 8, 14], "x1": [8, 16, 24, 31], "y1": [8, 16, 24, 31],
    "width": [2, 4, 6, 8, 10, 16, 24, 32], "height": [2, 4, 6, 8, 10, 16, 24, 32],
    "size": [1, 2, 3, 4, 6, 8], "dot": [1, 2, 3, 4], "padding": [0, 1, 2, 4],
    "frames": [1, 2, 4, 6, 8], "open_studio": None,
}

# Tools whose required arguments cannot be expressed in an utterance. Asking the
# model to invent a 5x7 ASCII sprite payload from "paint these rows" is not a
# routing task, it is a lottery — so these stay out of the dataset and are
# handled by the deterministic tool layer instead.
UNROUTABLE = {"paint_rows", "set_pixels", "load_project"}

TEMPLATE_TOOLS = {"load_template", "append_template_states", "click_ui"}
PROJECT_TOOLS = {"open_project", "delete_project", "duplicate_project", "new_project", "save_project"}


def build_route_dataset(val_frac: float = 0.15, seed: int = 7, per_tool: int = 220):
    """Generates (utterance -> {"tool": ..., "args": {...}}) pairs from the live schemas."""
    tools = {t["name"]: t for t in load("tools.json")}
    templates = load("templates.json")
    rnd = random.Random(seed)
    slugs = ["dragon", "village", "boss-fight", "tiles", "hero-run", "ui-kit", "arena", "swamp"]

    def value_for(tool, key, spec):
        props = tools[tool]["properties"]
        prop = props[key]
        if key == "rows":
            return ["..GG..", ".GDDG.", "GDDDDG", ".GDDG.", "..GG.."]
        if key == "pixels":
            return [{"x": 1, "y": 1, "color": "#ff0044"}, {"x": 2, "y": 2, "color": "#2ce8f5"}]
        if prop["enum"]:
            return rnd.choice(prop["enum"])
        if prop["type"] in ("integer", "number"):
            if key in SEMANTIC and SEMANTIC[key]:
                return rnd.choice(SEMANTIC[key])
            lo = prop["minimum"] if prop["minimum"] is not None else 0
            hi = prop["maximum"] if prop["maximum"] is not None else 64
            return int(rnd.uniform(lo, min(hi, lo + 16)))
        if prop["type"] == "boolean":
            return rnd.random() < 0.5
        if prop["type"] == "array":
            return ["#ff0044", "#2ce8f5", "#63c74d"]
        if prop["type"] == "object":
            return {"G": "#63c74d", "D": "#265c42"}
        # strings
        if key in ("id", "template") and tool in TEMPLATE_TOOLS:
            return rnd.choice(templates)["id"]
        if key in ("id", "name") and tool in PROJECT_TOOLS:
            return rnd.choice(slugs)
        if key == "state":
            return rnd.choice(STATES)
        if key in ("color", "from", "to"):
            return rnd.choice(COLORS)
        if key == "format":
            return rnd.choice(FORMATS)
        if key == "tool":
            return rnd.choice(TOOLS_UI)
        if key == "axis":
            return rnd.choice(AXES)
        if key == "category":
            return rnd.choice(["hero", "enemy", "npc", "animal", "world", "item", "fx", "ui"])
        if key == "theme":
            return rnd.choice(["light", "dark"])
        if key == "panel":
            return rnd.choice(["tools", "canvas", "anim", "agent"])
        if key == "name":
            return rnd.choice(STATES + slugs)
        return rnd.choice(slugs + STATES)

    def render(pattern, args, spec):
        def sub(m):
            key = m.group(1)
            if key in args:
                v = args[key]
                if isinstance(v, list):
                    return "these rows"
                if isinstance(v, bool):
                    return "on" if v else "off"
                return str(v)
            if key == "name" and "id" in args:
                return str(args["id"])
            if key == "id" and "name" in args:
                return str(args["name"])
            return key
        return re.sub(r"\{([a-z0-9_]+)\}", sub, pattern)

    examples: list[RouteExample] = []
    for tool, patterns in ROUTE_PATTERNS.items():
        if tool not in tools or tool in UNROUTABLE:
            continue
        spec = tools[tool]
        props = spec["properties"]
        n, guard = 0, 0
        while n < per_tool and guard < per_tool * 60:
            guard += 1
            # include every required arg, plus optional ones with some probability
            args = {}
            for key in props:
                if key in spec["required"] or rnd.random() < 0.25:
                    args[key] = value_for(tool, key, spec)
            for key in spec["required"]:
                if key not in args:
                    args[key] = value_for(tool, key, spec)
            pat = rnd.choice(patterns)
            # referenced keys must exist so the utterance never leaks a placeholder
            refs = re.findall(r"\{([a-z0-9_]+)\}", pat)
            # only real schema properties can be filled; {name}/{id} are aliases
            # that the renderer resolves against whichever of the two exists
            if any(r not in args and r not in props and r not in ("name", "id") for r in refs):
                continue
            for r in refs:
                if r not in args and r in props:
                    args[r] = value_for(tool, r, spec)
            # the label must contain every key the utterance mentions, plus the
            # required ones; other optionals are dropped to keep targets short
            keep = {k: v for k, v in args.items() if k in spec["required"] or k in refs}
            text = render(pat, keep, spec)
            if "{" in text or len(text) < 2:
                continue
            target = json.dumps({"tool": tool, "args": keep}, separators=(",", ":"))
            if any(ch.isalpha() for ch in text):
                examples.append(RouteExample(text=text, target=target, tool=tool, args=keep))
                n += 1
    rnd.shuffle(examples)
    n_val = max(1, int(len(examples) * val_frac))
    return examples[n_val:], examples[:n_val]


# --------------------------------------------------------------------------
# 2. retrieval (brief -> asset)
# --------------------------------------------------------------------------

QUERY_PATTERNS = [
    "{tags}", "{cat} {tags}", "a {tags} for my game", "i need {tags}",
    "{name}", "the {name}", "something like {name}", "{cat} asset", "{tags} sprite",
    "{tags} tileset", "cute {tags}", "dark {tags}", "boss {tags}", "{tags} with animation",
]


def template_docs(templates):
    docs = {}
    for t in templates:
        tags = " ".join(t["tags"])
        docs[t["id"]] = f"{t['name']} | {t['category']} | {tags} | {t['desc'][:220]}"
    return docs


def build_retrieval_dataset(seed: int = 11, per_template: int = 12, val_frac: float = 0.15):
    templates = load("templates.json")
    rnd = random.Random(seed)
    ids = [t["id"] for t in templates]
    train_ids, val_ids = split_ids(ids, val_frac, seed)
    by_id = {t["id"]: t for t in templates}

    def queries_for(t):
        out = []
        for pat in QUERY_PATTERNS:
            tags = " ".join(rnd.sample(t["tags"], k=min(len(t["tags"]), rnd.choice([1, 2, 2, 3]))))
            q = pat.format(tags=tags, cat=t["category"].lower(), name=t["name"].lower())
            out.append(q)
        rnd.shuffle(out)
        return out[:per_template]

    train, val = [], []
    for t in templates:
        qs = queries_for(t)
        (train if t["id"] in train_ids else val).extend([(q, t["id"]) for q in qs])
    return train, val, train_ids, val_ids, by_id


# --------------------------------------------------------------------------
# 3. palette detection (sprite features -> palette family)
# --------------------------------------------------------------------------


def build_palette_dataset(val_frac: float = 0.15, seed: int = 13):
    rows = load("style_apply.json")
    palettes = [p["id"] for p in load("palettes.json")]
    by_asset = {}
    for r in rows:
        by_asset.setdefault(r["t"], []).append(r)
    train_ids, val_ids = split_ids(list(by_asset), val_frac, seed)
    train, val = [], []
    for tid, rs in by_asset.items():
        bucket = train if tid in train_ids else val
        for r in rs:
            bucket.append((r["x"], palettes.index(r["pal"])))
    return train, val, palettes


def palette_majority_baseline(rows) -> float:
    counts = {}
    for _, y in rows:
        counts[y] = counts.get(y, 0) + 1
    return max(counts.values()) / max(1, len(rows))


if __name__ == "__main__":
    rtr, rva = build_route_dataset(per_tool=60)
    print(f"route:     {len(rtr)} train / {len(rva)} val   e.g. {rtr[0].text!r} -> {rtr[0].target}")
    st, sv, tid, vid, _ = build_retrieval_dataset(per_template=8)
    print(f"retrieval: {len(st)} train / {len(sv)} val   e.g. {st[0]!r}")
    pt, pv, pals = build_palette_dataset()
    print(f"palette:   {len(pt)} train / {len(pv)} val   classes {pals}  majority {palette_majority_baseline(pv):.3f}")
