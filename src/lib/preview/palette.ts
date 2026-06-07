import type { Vertical } from "./schema";

export interface Palette {
  from: string;
  via: string;
  to: string;
  accent: string;
  ink: string;
  paper: string;
}

const palettes: Record<Vertical, Palette> = {
  "food-hospitality": {
    from: "#7a2e0e",
    via: "#c2410c",
    to: "#f59e0b",
    accent: "#c2410c",
    ink: "#1c1917",
    paper: "#fffaf5",
  },
  "service-trade": {
    from: "#0f172a",
    via: "#1e3a8a",
    to: "#0284c7",
    accent: "#0284c7",
    ink: "#0f172a",
    paper: "#f8fafc",
  },
  "professional-services": {
    from: "#0c1b33",
    via: "#1e293b",
    to: "#475569",
    accent: "#0f766e",
    ink: "#0c1b33",
    paper: "#f8fafc",
  },
  retail: {
    from: "#3b0764",
    via: "#7c3aed",
    to: "#ec4899",
    accent: "#7c3aed",
    ink: "#1e1b4b",
    paper: "#fdf4ff",
  },
  generic: {
    from: "#111827",
    via: "#1f2937",
    to: "#374151",
    accent: "#2563eb",
    ink: "#111827",
    paper: "#f9fafb",
  },
};

export function paletteFor(vertical: Vertical): Palette {
  return palettes[vertical] ?? palettes.generic;
}
