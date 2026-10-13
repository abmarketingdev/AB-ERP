/**
 * The colour filters that make the mascot loops arctic.
 *
 * The WebM loops ship in the artwork's original rust colours with a white plate
 * baked in — `pix_fmt` is `yuv420p`, so there is no alpha channel to key
 * against. Both problems are solved by one `feColorMatrix`: the top three rows
 * recolour rust to arctic, and the fourth row is an alpha ramp steep enough
 * that near-white goes transparent and everything else stays opaque.
 *
 * Ported verbatim from the pack's `pandi-arktis-filter.svg`. Do not re-derive
 * the coefficients — they were solved against the actual palette pairs with the
 * neutrals pinned, which is why the black contour and the white eye highlights
 * survive the transform instead of drifting.
 *
 * Rendered once, near the root. A `filter: url(#id)` reference resolves against
 * the whole document, so one instance serves every mascot on the page.
 */
export function MascotFilters() {
  return (
    <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <filter id="pandiArktis" colorInterpolationFilters="sRGB">
        <feColorMatrix
          type="matrix"
          values="
            0.4130 -0.1774  0.7644 0  0
            0.2709  1.0955 -0.3665 0  0
            0.2734  1.6134 -0.8868 0  0
           -9.5    -9.5    -9.5    0 27.5"
        />
      </filter>

      {/* Keeps the original colours, removes only the white plate. Unused today;
          kept because it is the escape hatch if a placement ever wants rust. */}
      <filter id="pandiKey" colorInterpolationFilters="sRGB">
        <feColorMatrix
          type="matrix"
          values="
            1 0 0 0 0
            0 1 0 0 0
            0 0 1 0 0
           -9.5 -9.5 -9.5 0 27.5"
        />
      </filter>
    </svg>
  );
}

export default MascotFilters;
