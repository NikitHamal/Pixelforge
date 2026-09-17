# Local release checklist

Automated/model checks performed during implementation are recorded in `README.md`. The authoring environment did not include a browser executable. These native-browser checks remain important:

## Project workflow

1. Serve the folder on a consistent `127.0.0.1` host/port and open `index.html`.
2. Create a blank 16 × 16 project; reload and reopen it.
3. Create each starter kit; verify that the asset count matches its card.
4. Rename and duplicate a project; verify that duplication preserves asset order and the active asset.
5. Download a workspace backup and reimport it. Confirm that it creates a separate project.
6. Clear search filters and verify empty/no-result states.

## Editing

1. Paint with mouse, touch, and pen when available. Drag outside the canvas and release.
2. Test fill, line, rectangle, ellipse, eraser, picker, shade, filled shapes, and both symmetry axes.
3. Undo/redo strokes, layers, frames, state renames, and merges with non-100% opacity.
4. Cancel a pointer stroke (for example, interrupted touch) and check that it does not leave partial edits.
5. Select, copy, cut, paste, flip, and nudge; verify layer locks and edge clipping.
6. Resize a sprite, including an invalid oversized suite allocation; the original should survive rejected operations.
7. Check keyboard shortcuts without intercepting typing in names, textareas, dialogs, or color fields.

## Animation

1. Open each character family and test all four directions.
2. Review walk/run, weapon/tool use, eating/drinking, sleeping, swimming, damage, and death in your game's camera perspective.
3. Verify one-shot animations stop on the last frame, while loop states repeat.
4. Change per-frame duration, add/remove/reorder frames, switch actions during playback, and test independent preview.
5. Review tile joins in a repeated grid and object/character scale in your engine.

## Persistence and failure handling

1. Edit an asset, wait for **All changes saved locally**, reload, and compare pixels.
2. Open one project in two tabs. Save in tab A, then edit/save in stale tab B. B must show a conflict instead of overwriting A.
3. Export B's active sprite source JSON, reload B, and import the source as another asset.
4. Check behavior in a browser with blocked storage or a full quota. Never interpret an error as a successful save.
5. Navigate away immediately after a change. Confirm a save or an unsaved-change warning.
6. Do not use incognito/private browsing as the only storage location for real work.

## Imports / exports

1. Import a PNG and an evenly divided PNG sheet. Reject incorrect frame sizes without replacing the current asset.
2. Import valid sprite source JSON; reject malformed/oversized JSON without losing current edits.
3. Export native PNG, current-state and full-suite sheets, atlas JSON, GIF, SVG, and sprite source JSON.
4. Export a whole-project game ZIP and inspect every PNG/atlas in the target engine.
5. Verify nearest-neighbor rendering, durations, pivots, named state ranges, transparency, and PNG/JSON filename pairing.
6. Test the sheet-size guard with a large scale and strip layout. Use grid or 1× rather than ignoring the error.

## Agents / accessibility / layout

1. Run the inspect, add-asset, select-animation, and recolor examples in `AGENT-API.md`.
2. Apply an atomic plan, undo it once, and confirm full reversal. Deliberately fail a later step and check full rollback.
3. Confirm the message bridge is disabled on reload, rejects a wrong origin/token, and revokes old tokens after re-enabling.
4. Tab through dialogs and controls. Use Escape to close native dialogs and check focus visibility.
5. Review the three pages at phone, tablet, laptop, and large desktop widths, including browser zoom at 200%.
6. With reduced motion enabled, confirm gallery animations do not autoplay. Studio/preview animation starts only on request.

These checks are a release gate, not a claim that this project has already passed a full cross-browser or game-engine certification process.
