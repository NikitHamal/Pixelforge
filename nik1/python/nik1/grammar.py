"""Constrained decoding + validation for the Nik1 router.

A 500k-parameter model will occasionally emit a tool name that does not exist or
a JSON object that does not parse. Three layers stop that from ever reaching the
studio:

1. **Forced literals.** `{"tool":"` is emitted token by token through a mask that
   only allows the exact continuation, so the shape of the output is fixed.
2. **Tool-name masking.** Inside the name, only tokens that keep the prefix a
   valid prefix of a *real* tool name are allowed. A hallucinated tool becomes
   impossible, not merely unlikely.
3. **Repair + validate + fallback.** Whatever the model produces is parsed
   leniently, coerced against the live schema, validated with the same rules the
   tool registry applies, and — if it still fails — replaced by a deterministic
   keyword router. The pipeline therefore returns a *valid* call 100% of the
   time; what varies with model quality is how often the model produced it
   unaided, and that is the number reported in the docs.

`nik1/js/grammar.js` mirrors steps 2-3 so the browser behaves identically.
"""
from __future__ import annotations

import json
import os
import re

# `data/` holds the training split and is generated (and git-ignored); `models/`
# holds the tables that actually ship. A fresh clone has only the latter, so the
# shipped catalogue is the one to read — the grammar must agree with what the
# runtime validates against, not with a dataset that may not exist yet.
DATA = os.path.join(os.path.dirname(__file__), "..", "..", "data")
MODELS = os.path.join(os.path.dirname(__file__), "..", "..", "js", "models")

TOOL_PREFIX = '{"tool":"'
ARGS_MID = '","args":{'


def _table(name):
    """Shipped tables first: the grammar must agree with what the runtime uses."""
    from .data import table
    return table(name, prefer=("models", "data"))


def load_tools():
    return _table("tools.json")


def load_tool_index():
    return {t["name"]: t for t in load_tools()}


# Tools whose `id` argument is a *catalogue reference*, not free text. A 250k
# model happily emits `rpg_deathk` for `rpg_deathknight`, which validates as a
# string and is wrong. Referential validation is the fix: the catalogue is
# small, exact and available on device, so the repair layer checks it.
TEMPLATE_TOOLS = {"load_template", "append_template_states"}


def load_catalog():
    try:
        return {t["id"]: t["name"] for t in _table("templates.json")}
    except FileNotFoundError:
        return {}


def _fix_reference(value, catalog, utterance):
    if not catalog:
        return value
    if value in catalog:
        return value
    low = (utterance or "").lower()
    # the utterance is stronger evidence than the model's own token run: if it
    # names an asset, that is the asset the user asked for
    for c in catalog:
        if c in low:
            return c
    for c, name in catalog.items():
        if name and name.lower() in low:
            return c
    cands = [c for c in catalog if c.startswith(value) and len(value) >= 3]
    if len(cands) == 1:
        return cands[0]
    return None


# --------------------------------------------------------------------------
# token-level masks
# --------------------------------------------------------------------------


def _prefix_tokens(bpe, text_suffix: str) -> set:
    """Tokens whose text is a prefix of `text_suffix` (never a dead end)."""
    out = set()
    for tok, idx in bpe.vocab.items():
        if tok in ("<pad>", "<bos>", "<eos>", "<unk>"):
            continue
        if text_suffix.startswith(tok):
            out.add(idx)
    if not out:
        for tok, idx in bpe.vocab.items():
            if len(tok) == 1 and text_suffix.startswith(tok):
                out.add(idx)
    return out


def route_mask_fn(bpe, tool_names=None):
    """mask_fn(generated_ids) -> set[int] | None, for `train.greedy`."""
    names = sorted(tool_names or list(load_tool_index().keys()))

    def mask_fn(generated_ids):
        text = bpe.raw(generated_ids)
        if len(text) < len(TOOL_PREFIX):
            return _prefix_tokens(bpe, TOOL_PREFIX[len(text):]) or None
        if not text.startswith(TOOL_PREFIX):
            return None
        rest = text[len(TOOL_PREFIX):]
        candidates = [n for n in names if n.startswith(rest)]
        if candidates:
            allowed = set()
            for n in candidates:
                suffix = n[len(rest):]
                if not suffix:
                    allowed |= _prefix_tokens(bpe, ARGS_MID)
                else:
                    allowed |= _prefix_tokens(bpe, suffix + ARGS_MID)
            return allowed or None
        return None

    return mask_fn


# --------------------------------------------------------------------------
# repair / validate
# --------------------------------------------------------------------------


def extract_json(text: str):
    depth, start, in_str, esc = 0, -1, False, False
    for i, ch in enumerate(text):
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch == "{":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0 and start >= 0:
                return text[start:i + 1]
            if depth < 0:
                return None
    return None


NUM_RE = re.compile(r"^-?\d+(\.\d+)?$")
COLOR_RE = re.compile(r"^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$")


def _coerce(value, prop, key):
    t = prop.get("type")
    if t in ("integer", "number"):
        if isinstance(value, bool):
            out = int(value)
        elif isinstance(value, (int, float)):
            out = int(value)
        elif isinstance(value, str):
            m = re.search(r"-?\d+", value)
            out = int(m.group(0)) if m else 0
        else:
            out = 0
        if prop.get("minimum") is not None:
            out = max(int(prop["minimum"]), out)
        if prop.get("maximum") is not None:
            out = min(int(prop["maximum"]), out)
        return out
    if t == "boolean":
        if isinstance(value, bool):
            return value
        return str(value).strip().lower() in ("true", "1", "yes", "on")
    if t == "string":
        if isinstance(value, (int, float, bool)):
            value = str(value)
        value = "" if value is None else str(value)
        if prop.get("enum"):
            if value in prop["enum"]:
                return value
            low = value.strip().lower()
            for e in prop["enum"]:
                if str(e).lower() == low:
                    return e
            return None
        if "color" in key and not COLOR_RE.match(value):
            m = re.search(r"#?[0-9a-fA-F]{3,8}", value)
            if m:
                v = m.group(0)
                return v if v.startswith("#") else "#" + v
        return value
    if t == "array":
        return value if isinstance(value, list) else ([] if value is None else [value])
    if t == "object":
        return value if isinstance(value, dict) else {}
    return value


def repair_call(raw_text: str, tools=None, utterance: str = "", catalog=None):
    tools = tools or load_tool_index()
    notes = []
    text = extract_json(raw_text or "")
    if not text:
        # a truncated object has no balanced brace: keep from the first `{` and let
        # the closure pass below finish it
        i = (raw_text or "").find("{")
        if i < 0:
            return None, ["no-json"]
        text = raw_text[i:]
        notes.append("truncated")
    try:
        obj = json.loads(text)
    except Exception:
        obj = None
        for suffix in ('"}}', '"}}}', "}}", "}"):
            try:
                obj = json.loads(text.rstrip().rstrip(",") + suffix)
                notes.append("closed-truncated")
                break
            except Exception:
                obj = None
        if obj is None:
            return None, ["unparseable"]
    if not isinstance(obj, dict):
        return None, ["not-an-object"]
    name = obj.get("tool") or obj.get("name") or obj.get("function")
    if isinstance(name, dict):
        name = name.get("name")
    if not isinstance(name, str) or name not in tools:
        hit = next((n for n in tools if n in (raw_text or "")), None)
        if not hit:
            return None, ["unknown-tool"]
        name = hit
        notes.append("tool-from-text")
    spec = tools[name]
    args_in = obj.get("args") if isinstance(obj.get("args"), dict) else obj.get("arguments")
    if not isinstance(args_in, dict):
        args_in = {k: v for k, v in obj.items() if k not in ("tool", "name", "args", "arguments")}
        if args_in:
            notes.append("args-from-toplevel")
    props = spec["properties"]
    out = {}
    for k, v in (args_in or {}).items():
        if k not in props:
            notes.append("dropped:" + k)
            continue
        cv = _coerce(v, props[k], k)
        if cv is None:
            notes.append("bad:" + k)
            continue
        out[k] = cv
    catalog = load_catalog() if catalog is None else catalog
    if name in TEMPLATE_TOOLS:
        for k in list(out):
            if k not in ("id", "template"):
                continue
            fixed = _fix_reference(out[k], catalog, utterance)
            if fixed is None:
                del out[k]
                notes.append("bad-ref:" + k)
            elif fixed != out[k]:
                out[k] = fixed
                notes.append("fixed-ref:" + k)
    for k in spec.get("required", []):
        if k in out:
            continue
        inferred = _infer_arg(k, props[k], utterance, tools, name, catalog)
        if inferred is not None:
            out[k] = inferred
            notes.append("inferred:" + k)
        else:
            return None, notes + ["missing:" + k]
    return {"tool": name, "args": out}, notes


def _infer_arg(key, prop, utterance, tools, tool_name, catalog=None):
    low = (utterance or "").lower()
    if prop.get("enum"):
        for e in prop["enum"]:
            if str(e).lower() in low:
                return e
        return None
    if key in ("id", "name", "template"):
        cat = load_catalog() if catalog is None else catalog
        for tid, tname in cat.items():
            if tid in low or (tname and tname.lower() in low):
                return tid if (key == "template" or tool_name in TEMPLATE_TOOLS) else tname
        m = re.search(r"(?:project|named|called)\s+([a-z0-9_-]+)", low)
        return m.group(1) if m else None
    if "color" in key:
        m = re.search(r"#[0-9a-f]{3,8}", low)
        return m.group(0) if m else None
    if prop.get("type") in ("integer", "number"):
        m = re.search(r"-?\d+", low)
        if not m:
            return None
        v = int(m.group(0))
        if prop.get("minimum") is not None:
            v = max(int(prop["minimum"]), v)
        if prop.get("maximum") is not None:
            v = min(int(prop["maximum"]), v)
        return v
    if prop.get("type") == "boolean":
        return any(w in low for w in ("true", "yes", "on", "filled"))
    return None


def validate_call(call, tools=None):
    """The same rules PF.Tools.validate applies in the browser."""
    tools = tools or load_tool_index()
    if not isinstance(call, dict):
        return False, ["not-an-object"]
    name = call.get("tool")
    if name not in tools:
        return False, ["unknown-tool"]
    args = call.get("args") or {}
    props = tools[name]["properties"]
    errors = []
    for k in tools[name].get("required", []):
        if k not in args:
            errors.append("missing:" + k)
    for k, v in args.items():
        if k not in props:
            errors.append("unknown:" + k)
            continue
        prop = props[k]
        t = prop.get("type")
        if t in ("integer", "number") and not isinstance(v, (int, float)):
            errors.append("type:" + k)
        if t == "boolean" and not isinstance(v, bool):
            errors.append("type:" + k)
        if t == "string" and not isinstance(v, str):
            errors.append("type:" + k)
        if prop.get("enum") and v not in prop["enum"]:
            errors.append("enum:" + k)
        if t in ("integer", "number"):
            if prop.get("minimum") is not None and v < prop["minimum"]:
                errors.append("min:" + k)
            if prop.get("maximum") is not None and v > prop["maximum"]:
                errors.append("max:" + k)
    return (not errors), errors


# --------------------------------------------------------------------------
# deterministic fallback router
# --------------------------------------------------------------------------

FALLBACK_RULES = [
    (r"\b(undo|go back|take that back)\b", "undo"),
    (r"\b(redo|put it back)\b", "redo"),
    (r"\b(play|start playback)\b", "play"),
    (r"\b(pause|stop the animation)\b", "pause"),
    (r"\b(clear|erase|wipe)\b", "clear"),
    (r"\b(export|download|save as)\b", "export"),
    (r"\b(zoom|grid|onion|theme)\b", "set_view"),
    (r"\b(list|what|which|show)\b.*\b(templates|assets|sprites)\b", "list_templates"),
    (r"\b(list|show)\b.*\bprojects\b", "list_projects"),
    (r"\bsave\b.*\bproject\b", "save_project"),
    (r"\b(open|load)\b", "load_template"),
    (r"\b(add|make|create)\b.*\b(state|animation)\b", "add_state"),
    (r"\badd\b.*\bframe\b", "add_frame"),
    (r"\bdraw\b.*\bline\b", "draw_line"),
    (r"\bdraw\b.*\b(rect|rectangle|box)\b", "draw_rect"),
    (r"\bdraw\b.*\b(circle|ellipse)\b", "draw_ellipse"),
    (r"\b(fill|bucket)\b", "fill"),
    (r"\boutline\b", "outline"),
    (r"\b(flip|mirror)\b", "flip"),
    (r"\bshift\b", "shift"),
    (r"\bpalette\b", "get_palette"),
    (r"\bcolor\b", "set_color"),
    (r"\blayer\b", "add_layer"),
]


def fallback_route(utterance: str, tools=None):
    tools = tools or load_tool_index()
    low = utterance.lower()
    for pattern, tool in FALLBACK_RULES:
        if tool in tools and re.search(pattern, low):
            call, _ = repair_call(json.dumps({"tool": tool, "args": {}}), tools, utterance)
            if call is not None:
                return call, "fallback-rules"
    for name, spec in tools.items():
        if not spec.get("required"):
            return {"tool": name, "args": {}}, "fallback-empty"
    return None, "none"


def route(utterance: str, generate, tools=None, prefix: str = ""):
    """model -> extract -> repair -> validate -> fallback."""
    tools = tools or load_tool_index()
    raw = generate(prefix + utterance)
    call, notes = repair_call(raw, tools, utterance)
    if call is not None:
        ok, _ = validate_call(call, tools)
        if ok:
            return {"call": call, "source": "model" if not notes else "model+repair", "notes": notes, "raw": raw}
    fb, how = fallback_route(utterance, tools)
    return {"call": fb, "source": how, "notes": notes, "raw": raw}


if __name__ == "__main__":
    from .tokenizer import BPE

    tools = load_tool_index()
    bpe = BPE().fit(['{"tool":"load_template","args":{"id":"rpg_knight"}}', "open the knight"], 260, 1)
    mf = route_mask_fn(bpe)
    print("mask tokens at '{\"tool\":\"lo':", len(mf(bpe.encode('{"tool":"lo'))))
    print("repair:", repair_call('{"tool":"load_template","args":{"id":"rpg_knight","bogus":1,"open_studio":"yes"}', tools, "open the knight"))
    print("validate:", validate_call({"tool": "load_template", "args": {"id": "x"}}, tools))
    print("fallback:", fallback_route("export a gif please", tools))
    print("route():", route("give me the knight", lambda p: 'x{"tool":"load_template","args":{"id":"rpg_knight"}}y', tools))
