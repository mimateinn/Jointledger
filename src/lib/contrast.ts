/** WCAG 2 relative-luminance contrast (sRGB). */

export type Rgb = readonly [number, number, number];

export function srgbChannel(value: number): number {
  const channel = value / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(rgb: Rgb): number {
  return 0.2126 * srgbChannel(rgb[0]) + 0.7152 * srgbChannel(rgb[1]) + 0.0722 * srgbChannel(rgb[2]);
}

export function contrastRatio(foreground: Rgb, background: Rgb): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

export function parseHex(hex: string): Rgb {
  const raw = hex.trim().replace(/^#/, "");
  if (raw.length === 3) {
    return [
      parseInt(raw[0] + raw[0], 16),
      parseInt(raw[1] + raw[1], 16),
      parseInt(raw[2] + raw[2], 16),
    ];
  }
  if (raw.length !== 6 || /[^0-9a-f]/i.test(raw)) {
    throw new Error(`unsupported hex: ${hex}`);
  }
  return [parseInt(raw.slice(0, 2), 16), parseInt(raw.slice(2, 4), 16), parseInt(raw.slice(4, 6), 16)];
}

export function composite(source: Rgb, alpha: number, dest: Rgb): Rgb {
  return [
    Math.round(source[0] * alpha + dest[0] * (1 - alpha)),
    Math.round(source[1] * alpha + dest[1] * (1 - alpha)),
    Math.round(source[2] * alpha + dest[2] * (1 - alpha)),
  ];
}

export type CssColor = { rgb: Rgb; alpha: number };

export function parseCssColor(value: string): CssColor {
  const trimmed = value.trim();
  if (trimmed.startsWith("#")) {
    return { rgb: parseHex(trimmed), alpha: 1 };
  }
  const rgba = trimmed.match(
    /^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*(?:,\s*(\d+(?:\.\d+)?)\s*)?\)$/i,
  );
  if (rgba) {
    return {
      rgb: [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])],
      alpha: rgba[4] == null ? 1 : Number(rgba[4]),
    };
  }
  throw new Error(`unsupported color: ${value}`);
}

export function paint(color: CssColor, onto: Rgb): Rgb {
  return color.alpha >= 1 ? color.rgb : composite(color.rgb, color.alpha, onto);
}
