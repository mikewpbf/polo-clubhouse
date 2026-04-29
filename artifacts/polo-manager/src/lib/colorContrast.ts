export interface OnColorTheme {
  text: string;
  shadow: string;
  bubbleBg: string;
  logoBorder: string;
  isLight: boolean;
}

const DARK_TEXT = "#0b0b0b";
const LIGHT_TEXT = "#ffffff";

const DARK_THEME: OnColorTheme = {
  text: LIGHT_TEXT,
  shadow: "0 1px 2px rgba(0,0,0,0.3)",
  bubbleBg: "rgba(255,255,255,0.2)",
  logoBorder: "2px solid rgba(255,255,255,0.3)",
  isLight: false,
};

const LIGHT_THEME: OnColorTheme = {
  text: DARK_TEXT,
  shadow: "0 1px 2px rgba(255,255,255,0.45)",
  bubbleBg: "rgba(0,0,0,0.12)",
  logoBorder: "2px solid rgba(0,0,0,0.25)",
  isLight: true,
};

function parseHex(input: string | null | undefined): { r: number; g: number; b: number } | null {
  if (!input) return null;
  let hex = input.trim();
  if (hex.startsWith("#")) hex = hex.slice(1);
  if (hex.length === 3) {
    hex = hex.split("").map((c) => c + c).join("");
  }
  if (hex.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

export function isLightColor(hex: string | null | undefined, threshold = 150): boolean {
  const rgb = parseHex(hex);
  if (!rgb) return false;
  const yiq = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  return yiq >= threshold;
}

export function getOnColorTheme(hex: string | null | undefined): OnColorTheme {
  return isLightColor(hex) ? LIGHT_THEME : DARK_THEME;
}

export function themed<T>(theme: OnColorTheme, lightValue: T, darkValue: T): T {
  return theme.isLight ? lightValue : darkValue;
}
