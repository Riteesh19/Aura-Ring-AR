/**
 * SettingSpec — explicit STRUCTURAL fields that drive ring assembly, replacing the old
 * "one hardcoded shape per settingType" switch. Geometry is built from these fields, so two
 * SKUs render differently iff their fields differ (and identically only when they truly match).
 *
 * DATA REALITY (verified against the shop catalog in Customizer.ts):
 *   The catalog has 150 setting SKUs but only 4 DISTINCT designs — `img` is a 1:1 function of
 *   `style`, so every "Halo" SKU shares public/settings/halo.png, etc. The only per-SKU variation
 *   in the data is metal + price. Therefore "per-SKU" currently collapses to "per-design (4)".
 *   The four DESIGN_SPECS below were read off the four reference photos. `resolveSettingSpec`
 *   additionally merges any per-SKU `spec` override carried on a catalog item, so the moment the
 *   catalog stores real SKU-specific structure it flows straight through with no generator change.
 */

export interface SettingSpec {
  key: string;                              // design id (for debugging / change detection)
  prongCount: number;                       // centre-head claws
  sideStones: number;                       // 0 = none, 2 = three-stone flanks
  sideStoneScale: number;                   // side stone size relative to centre half-width
  halo: 'none' | 'visible' | 'hidden';      // accent ring style around the centre
  haloRows: number;                         // 1 = single, 2 = double concentric halo (visible only)
  accentScale: number;                      // halo accent half-width relative to centre
  paveRows: number;                         // 0 / 1 / 2 rows of shoulder pavé melee
  gallery: 'plain' | 'rail';                // under-stone gallery treatment
}

/** One spec per distinct catalog DESIGN, derived from public/settings/<key>.png. */
export const DESIGN_SPECS: Record<string, SettingSpec> = {
  // solitaire.png — plain band, 4-prong basket, no accents anywhere.
  solitaire:   { key: 'solitaire',   prongCount: 4, sideStones: 0, sideStoneScale: 0,    halo: 'none',    haloRows: 0, accentScale: 0,    paveRows: 0, gallery: 'rail' },
  // halo.png — bold single accent ring at the girdle; split-shoulder pavé (two rows).
  halo:        { key: 'halo',        prongCount: 4, sideStones: 0, sideStoneScale: 0,    halo: 'visible', haloRows: 1, accentScale: 0.28, paveRows: 2, gallery: 'rail' },
  // hidden_halo.png — accents under the basket (hidden from top); single pavé shoulder row.
  hidden_halo: { key: 'hidden_halo', prongCount: 4, sideStones: 0, sideStoneScale: 0,    halo: 'hidden',  haloRows: 1, accentScale: 0.20, paveRows: 1, gallery: 'rail' },
  // threestone.png — centre + two smaller flanking stones; single pavé shoulder row.
  three_stone: { key: 'three_stone', prongCount: 4, sideStones: 2, sideStoneScale: 0.60, halo: 'none',    haloRows: 0, accentScale: 0,    paveRows: 1, gallery: 'rail' },
};

/** Normalise a catalog `style` string ("Hidden Halo", "Three Stone", …) to a design key. */
export function styleKey(style: string | undefined): string {
  const s = (style || '').toLowerCase();
  if (s.includes('three')) return 'three_stone';
  if (s.includes('hidden')) return 'hidden_halo';
  if (s.includes('halo')) return 'halo';
  return 'solitaire';
}

/**
 * Resolve the structural spec for a catalog setting SKU: the design default (by style) with any
 * per-SKU `spec` override merged on top. This is the per-SKU layer — give a catalog item a
 * partial `spec` (e.g. `{ haloRows: 2, accentScale: 0.34 }`) and that SKU renders differently
 * from others in its category, with no changes needed in JewelryGenerator.
 */
export function resolveSettingSpec(catalogSetting: any): SettingSpec {
  const base = DESIGN_SPECS[styleKey(catalogSetting?.style)] ?? DESIGN_SPECS.solitaire;
  const override = catalogSetting?.spec && typeof catalogSetting.spec === 'object' ? catalogSetting.spec : null;
  return override ? { ...base, ...override } : { ...base };
}
