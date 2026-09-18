# Agent tools

Every studio capability is exposed as a typed tool with a JSON schema. One
registry drives the in-app agent console, `window.PixelForge.call`,
the `postMessage` bridge and the MCP manifest.

```js
PF.Tools.list()                                  // [{ name, description, inputSchema, tags }]
await PF.Tools.call('load_template', { id: 'rpg_knight' });
window.PixelForge.call('factory_brief', { brief: 'cozy farm game, pastel' });
```

In the console: `/tools` lists them, `/schema <tool>` shows arguments,
`/tool name={json}` runs one.

---

## Tool families

| Tag | Tools | Purpose |
|---|---|---|
| `doc` | `get_document`, `new_document`, `resize_document`, `rename_document`, `undo`, `redo`, `set_active` | document shape and navigation |
| `pixels` | `paint_rows`, `set_pixels`, `draw_line`, `draw_rect`, `draw_ellipse`, `fill`, `clear`, `flip`, `shift`, `outline`, `replace_color`, `shade`, `get_pixels` | drawing and reading pixels |
| `palette` | `get_palette`, `set_palette`, `add_palette_color`, `set_color` | colour |
| `layers` | `add_layer`, `remove_layer`, `set_layer`, `merge_layer_down` | layers |
| `anim` | `list_states`, `add_state`, `remove_state`, `set_state`, `add_frame`, `remove_frame`, `move_frame`, `set_frame_duration`, `play`, `pause` | animation |
| `export` | `export`, `render_preview`, `render_state`, `get_project`, `load_project` | files and vision |
| `ui` | `set_tool`, `set_view`, `describe_ui`, `click_ui` | pixel-perfect UI driving |
| `hub` | `list_templates`, `load_template`, `append_template_states`, `list_projects`, `open_project`, `new_project`, `save_project`, `delete_project`, `duplicate_project` | templates and projects |
| `forge` | `list_styles`, `restyle_document`, `open_styled_variant`, `factory_brief`, `factory_help`, `export_engine`, `list_export_formats`, `autotile_info` | style engine, briefs, atlases, engine export |

## Drawing from an agent

`paint_rows` is the highest-signal tool: one call paints ASCII art with a
legend, and `get_pixels` reads the canvas back the same way.

```json
{"tool": "paint_rows", "args": {
  "legend": { "G": "#63c74d", "D": "#265c42" },
  "rows": ["..GGG..", ".GDDDG.", "GGDDDGG"]
}}
```

Arguments accept an array of calls in one turn:

```json
[{"tool":"clear","args":{}},
 {"tool":"draw_rect","args":{"x":0,"y":0,"width":32,"height":32,"fill":true,"color":"#1c2a44"}}]
```

## Vision loop

```js
const r = await PF.Tools.call('render_preview', { scale: 4 });
// r.result.dataUrl -> a PNG data URL the agent can look at
```

Because the studio state is available as pixels, an agent can draw, render,
inspect and iterate without a browser driver.

## The forge tools

```js
// 1. describe what you want
await PF.Tools.call('factory_brief', { brief: 'cyberpunk shooter, neon, 32px' });
// → items: [{ role: 'player', template: 'pf_scifi_netrunner', styled: 'pf_scifi_netrunner@cyberpunk' }, ...]

// 2. open one
await PF.Tools.call('open_styled_variant', { id: 'pf_scifi_netrunner', style: 'cyberpunk' });

// 3. retarget whatever is open
await PF.Tools.call('restyle_document', { style: 'gameboy' });

// 4. ship it
await PF.Tools.call('export_engine', { format: 'atlas-godot', padding: 1 });
```

`factory_help` returns the genre vocabulary, role list, starter packs and style
ids — call it before writing a brief so the words match.

## MCP

`js/agent/mcp.js` builds a Model Context Protocol manifest from the same
registry: `PF.MCP.manifest()` returns the tool list, and the bridge accepts
`{ type: 'pf:call', id, tool, args }` messages, replying with
`{ type: 'pf:result', id, ok, result }`. Nothing extra to configure — a new tool
appears in every surface the moment it is registered.

## Adding a tool

```js
PF.Tools.register('my_tool', 'What it does, in one sentence.',
  { type: 'object', properties: { amount: { type: 'integer', minimum: 1 } }, required: ['amount'], additionalProperties: false },
  args => ({ doubled: args.amount * 2 }),
  ['my-tag']);
```

Validation is automatic: required arguments, types, integer rounding and enum
membership are checked before your handler runs, and failures come back as
`{ ok: false, error }` instead of throwing into the agent loop.
