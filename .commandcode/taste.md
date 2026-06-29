# DroidProxy Lab Console — design taste

**Register:** Product — a relay operations console / instrument.
**Surface:** the legacy web dashboard served on `:8419` in CLI lab mode (`dashboard/index.html`, `dashboard/styles.css`, `dashboard/app.js`).

## Identity — "Relay Instrument"
A warm-graphite operations panel with a single instrument-gold signature, built like an aviation/industrial instrument cluster. The artifact — the live proxy endpoint — is the hero of the first viewport. There is no blue anywhere; this deliberately separates the console from the generic dark-blue SaaS dashboard reflex.

## Color (OKLCH)
- **Neutrals:** warm graphite, hue 70, chroma held under 0.016 so greys read as authored, not empty. Tinted toward the gold family so the whole surface feels like one instrument instead of cold-blue + warm-accent.
- **Primary / signature:** instrument gold, hue 82. Statement level on primary CTAs and the brand mark; whisper everywhere else. Commitment: Whisper-with-moments-of-Statement.
- **Status, deliberately separated from gold:** ok/live = emerald green (155); warn = orange (52); critical = red (25). The previous scheme collided gold-primary with amber-warn and amber-live; live is now green, warn is now orange.
- 60-30-10: graphite narrator (60), surface variants (30), gold accent (10).

## Type
- Segoe UI / system stack for UI (product register — system fonts are correct, no decorative face).
- Cascadia Mono / Consolas for every readout, label, path, endpoint, and numeric — the instrument-readout voice.
- Tabular numerics on all data so live values do not jump.
- Hierarchy of 3: mono eyebrow (section index) → heading → lead/body.

## Composition
- Sticky **command-bar topbar**: brand + live overall-status chip + the proxy-endpoint readout + Copy / Refresh. The endpoint is always visible — correct for a Monitor surface.
- Slim, **dismissible legacy notice** (calm graphite + gold tag) replaces the old alarm-amber deprecation banner, so arrival reads "ready" not "warning".
- Left **rail**: mono-indexed nav (01–09) with scrollspy active state; collapses to a grid under 1024px.
- **Vitals** as a bordered instrument cluster (hairline grid dividers) with green pulse on live services.
- Zones for Operate/Configure work; horizontal snap-scroll **quota board** for Compare work; **terminal-chrome logs** (traffic-light dots + mono title bar).

## Motion
Restraint: green pulse on live signals, 120ms ease on hover/focus, 160ms quart-out toast slide, 220ms quart-out quota bars. `prefers-reduced-motion` collapses all of it. No bounce, no stagger theater.

## Surface hardening (this pass)
- Fixed three latent duplicate-ID bugs (`#accounts`, `#models`, `#logs` each existed on both a `<section>` and its inner container). `app.js` queried the first match — the section — and would wipe the section heading plus sibling controls. IDs now live only on the inner containers / `<pre>` the script actually targets.
- `app.js` is untouched; every ID and JS-coupled class is preserved. Added a separate small script for flash-free legacy-dismiss (via a head class) and nav scrollspy.

## Responsive
Topbar stacks at 860px; rail → 3-col then 2-col grid at 1024/768; vitals, zones, data-row, path-grid collapse to single column at 768; quota cards shrink to 92vw. Notch-safe via `viewport-fit=cover`.
