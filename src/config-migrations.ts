import {
  NOTE_KEY_ALIASES,
  RENDERER_CONFIG_VERSION,
  RENDERER_CONFIG_VERSION_KEY,
  RENDER_DEFAULTS,
  type EffectParams,
} from "./schema";

type RawConfig = Record<string, unknown>;

type MigrationFn = (raw: RawConfig) => void;

const NOTE_CONFIG_MIGRATIONS: Record<number, MigrationFn> = {
  0: migrateLegacyFlatConfig,
};

export function migrateRendererConfig(raw: RawConfig): RawConfig {
  const version = getRendererConfigVersion(raw);
  for (let current = version; current < RENDERER_CONFIG_VERSION; current++) {
    NOTE_CONFIG_MIGRATIONS[current]?.(raw);
  }
  raw[RENDERER_CONFIG_VERSION_KEY] = RENDERER_CONFIG_VERSION;
  return raw;
}

function getRendererConfigVersion(raw: RawConfig): number {
  const version = raw[RENDERER_CONFIG_VERSION_KEY];
  return typeof version === "number" && Number.isFinite(version)
    ? Math.max(0, Math.floor(version))
    : 0;
}

function migrateLegacyFlatConfig(raw: RawConfig): void {
  for (const [alias, canonical] of Object.entries(NOTE_KEY_ALIASES)) {
    if (alias in raw && !(canonical in raw)) {
      raw[canonical] = raw[alias];
    }
    delete raw[alias];
  }

  delete raw.coverStyle;

  migrateCoverTextEffects(raw);
  migrateFlatEffects(raw);
}

function migrateCoverTextEffects(raw: RawConfig): void {
  const style = raw.coverStrokeStyle;
  if (typeof style !== "string") return;

  if (style === "glow") {
    raw.coverStrokeStyle = "stroke";
    if (typeof raw.coverGlow !== "boolean") raw.coverGlow = true;
    return;
  }

  if (style === "double") {
    if (typeof raw.coverGlow !== "boolean") raw.coverGlow = true;
    return;
  }

  if (style === "shadow") {
    raw.coverStrokeStyle = "none";
    if (typeof raw.coverShadow !== "boolean") raw.coverShadow = true;
  }
}

function migrateFlatEffects(raw: RawConfig): void {
  const defaults = RENDER_DEFAULTS.coverEffects;
  const flatToEffect: Record<string, string> = {
    coverOverlay: "overlay",
    coverGrain: "grain",
    coverAurora: "aurora",
    coverBokeh: "bokeh",
    coverGrid: "grid",
    coverVignette: "vignette",
    coverLightLeak: "lightLeak",
    coverScanlines: "scanlines",
    coverNetwork: "network",
  };

  let hasFlat = false;
  for (const key of Object.keys(flatToEffect)) {
    if (key in raw || `${key}Opacity` in raw) {
      hasFlat = true;
      break;
    }
  }
  if (!hasFlat) return;

  const effects: Record<string, EffectParams> = {};
  for (const [flatKey, effectName] of Object.entries(flatToEffect)) {
    const opKey = `${flatKey}Opacity`;
    effects[effectName] = {
      enabled: typeof raw[flatKey] === "boolean" ? raw[flatKey] : defaults[effectName].enabled,
      opacity: typeof raw[opKey] === "number" ? raw[opKey] : defaults[effectName].opacity,
    };
    delete raw[flatKey];
    delete raw[opKey];
  }

  if (!raw.coverEffects) {
    raw.coverEffects = effects;
  }
}
