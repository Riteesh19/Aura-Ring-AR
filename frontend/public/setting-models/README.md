# Real AI-generated setting meshes (drop-in)

Place the 4 GLB setting meshes here (the browser can only load assets from `/public`):

| design | file (exact name) |
| --- | --- |
| Solitaire | `solitaire.glb` |
| Halo | `halo.glb` |
| Hidden Halo | `hidden-halo.glb` |
| Three Stone | `three-stone.glb` |

These are the **metal setting only** (band / gallery / prongs). The center diamond stays
procedural (it resizes per carat) and is seated into the setting at runtime.

## After dropping the files in

1. Run the dev server and open the AR view, then in the browser console:

   ```js
   window.inspectSettingMesh('halo')   // also: 'solitaire', 'hidden_halo', 'three_stone'
   ```

   This logs the GLB's scene graph — node names, material names, vertex counts, and the
   bounding box — which we need to calibrate each design.

2. Paste that output back (or share it) so the per-design fields in
   `src/utils/SettingMeshLoader.ts` (`SETTING_MESH_CONFIGS`) can be filled:
   - `stoneNodeMatchers` / `metalMaterialMatchers` — confirm which nodes are the baked stone vs metal
   - `normalize` — rotation/scale/translate to put the mesh in the engine convention
     (hole axis = local Y, table/front = +Z, units ≈ mm, centered on the band)
   - `diamondAnchor.position` — where the procedural diamond seats in the basket
   - `occlusion` — radius/length of the finger-occlusion cylinder for the band hole

3. Flip that design's `enabled: true`. The GLB path then replaces the procedural setting for
   that design; the diamond, metal-type recoloring, and AR tracking are already wired.

**If metal and stone are merged into one mesh** (can't hide the stone separately), that's a
real blocker — regenerate with cleaner separation, or split them in Blender and re-export,
rather than masking at runtime.
