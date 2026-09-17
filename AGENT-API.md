# PixelForge agent interface

The standalone studio exposes a same-page browser API. The command console is deterministic and supports slash commands, JSON plans, and a small set of preset recipes. It is **not** a connected language model.

Use this from the browser console or from browser automation after the studio has opened a project:

```js
await window.PixelForge.call('get_workspace', {});
await window.PixelForge.call('get_document', {});
window.PixelForge.tools();
window.PixelForge.manifest();
```

Every tool returns either `{ok: true, tool, result, ...}` or `{ok: false, tool, error, ...}`. Check `ok` before taking the next step. Parameters are validated; numbers are not silently coerced from strings.

## Asset-aware workflow

```js
const templates = await PixelForge.call('list_asset_templates', {
  category: 'Characters'
});

const created = await PixelForge.call('add_library_asset', {
  template_id: 'ranger-female'
});
if (!created.ok) throw new Error(created.error);

await PixelForge.call('select_animation', {
  action: 'pickaxe',
  direction: 'east'
});

const preview = await PixelForge.call('render_preview', { scale: 4 });
await PixelForge.call('save_workspace', {});
```

`list_project_assets` returns IDs for `open_asset`. Opening another asset saves pending edits first and refuses to proceed through a save conflict. `new_document` creates a **new asset**, rather than silently replacing the current one. `load_project` imports sprite JSON as a new asset.

## Atomic edit plans

Prefer this over a plain array when a set of edits must succeed or fail together:

```js
const status = await PixelForge.call('get_workspace', {});
if (!status.ok) throw new Error(status.error);

const steps = [
  { tool: 'add_layer', args: { name: 'Agent details' } },
  { tool: 'draw_rect', args: {
    x: 12, y: 15, width: 4, height: 3,
    color: '#d8b76c', fill: true
  } }
];

const checked = await PixelForge.plan(steps, { dry_run: true });
if (!checked.ok) throw new Error(checked.error);

const applied = await PixelForge.plan(steps, {
  expected_revision: status.result.editRevision
});
if (!applied.ok) throw new Error(applied.error);
```

The whole edit becomes one undo operation. A handler failure restores pixels, structure, and prior history. Up to 64 commands are accepted. Navigation, export, imports, external I/O, and nested plans are excluded. `dry_run` validates names and schemas; state-dependent checks occur during execution. The expected revision is local to the open studio and changes when pixels, structure, color/selection context, or the active asset change. Pause playback before revision-sensitive plans.

A plain `PixelForge.run([...])` executes sequentially and stops after a failed tool; it does not roll back successful earlier steps. Use atomic plans when that distinction matters.

## Pixel and editing tools

The original raster tools remain available: `paint_rows`, `set_pixels`, line/rectangle/ellipse drawing, fill, outline, shift, flip, palette operations, layer operations, state/frame editing, previews, and exports. Inspect `PixelForge.tools()` for the complete live schemas rather than assuming an argument name.

Additional tools include:

- `get_workspace`, `list_projects`, `list_project_assets`, `save_workspace`
- `list_asset_templates`, `get_asset_template`, `add_library_asset`, `open_asset`
- `select_animation`, `select_region`, `copy_selection`, `paste_selection`
- `recolor_asset`, `run_edit_plan`

```js
await PixelForge.call('recolor_asset', {
  from: '#609760',
  to: '#7867ac'
});
```

Recoloring affects exact color matches across all layers and animation frames, in one undoable edit. Generated appearance variants can therefore remain consistent across a full suite.

`describeUI()` and `clickUI(id, value)` support agent-addressable controls with `data-agent-id`. Semantic tools are preferable to UI clicks for reliable automation. `render_preview` returns a PNG data URL for an agent with vision support.

## Opt-in cross-window bridge

Disabled by default. Enable it manually in **Agent → External agent connection**, or explicitly in trusted same-page code:

```js
const session = PixelForge.enableBridge('http://127.0.0.1:8001');
```

The returned object includes a per-session random token. Share that token only with the trusted controller. Do not log it to shared services, embed it in published documents, or store it in project files.

From the allowed-origin controller, send to the studio window reference:

```js
studioWindow.postMessage({
  type: 'pf:call',
  id: 'inspect-1',
  token: sessionToken,
  tool: 'get_document',
  args: {}
}, 'http://127.0.0.1:8000');
```

Responses use `type: 'pf:result'` and the matching `id`. They are sent only to the requesting window at its exact origin. Requests from other origins or without the correct token are ignored. Bridge calls are serialized. Disable access with `PixelForge.disableBridge()` or the dialog's **Disable** button. Re-enabling creates a new token and invalidates the previous one.

This bridge gives a trusted controller editing/export capabilities; it is not a permissions system for hostile plugins. Scripts already running in the studio's own origin can access its browser data.

## MCP boundary

This delivery does not install or run a standalone MCP server. The uploaded `js/agent/mcp.js` reference file is retained but is not loaded by the standalone studio. Do not treat its old reference bridge/config as an authenticated, deployed service. A production MCP transport would need its own runtime, authentication, authorization, lifecycle management, and separate verification.

No API key is requested or stored. No project pixels or prompts are sent to an external service by the new pages.
