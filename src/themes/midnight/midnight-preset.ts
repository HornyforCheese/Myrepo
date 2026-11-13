import type { ThemePreset } from "@/lib/theme";

/** Complete 1.0.1-compatible preset for the layout already supported by the app. */
export const MIDNIGHT_PRESET: ThemePreset = {
  id: "midnight" as ThemePreset["id"],
  name: "Midnight",
  blurb: "Deep navy surfaces, clear text and a cool blue accent.",
  swatch: ["#0b1020", "#172036", "#8bb8ff"],
  layout: "midnight",
  cardStyle: "glass",
  buttonStyle: "flat",
  fontPair: "system",
  tokens: {
    "--color-canvas": "#0b1020",
    "--color-surface": "#11192b",
    "--color-elevated": "#172036",
    "--color-raised": "#202d47",
    "--color-ink": "#f2f5fc",
    "--color-ink-muted": "#c1cbe0",
    "--color-ink-subtle": "#93a3c2",
    "--color-edge": "#34445f",
    "--color-edge-soft": "#26344e",
    "--color-accent": "#8bb8ff",
  },
};
