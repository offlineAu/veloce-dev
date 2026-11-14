import { LOGO_POLYGONS } from "@/components/brand/logo";
import { portfolioImageUrl } from "@/lib/security/portfolio-images";
import { DEPLOY_STEPS, FILES, SNIPPETS, VERB, type ShowState, type ShowcaseItem } from "./store";

/**
 * The laptop display, drawn into a 2D canvas that becomes the screen mesh's texture: a macOS desktop (menu bar round
 * the notch) with a code editor typing the page and its terminal deploying it, then the finished sample in a browser,
 * with the trackpad's cursor on top. The phone's is an iOS lock screen, then the sample in its browser. System glyphs
 * and the Veloce app icon are drawn here, nothing fetched. Drawn at 1280x800 (more than twice its size on the page),
 * so text stays sharp.
 */
export const SCREEN_SIZE = { width: 1280, height: 800 } as const;
/** The phone's display, the shape of the phone screenshots (390x844 at 1.4x). */
export const PHONE_SIZE = { width: 540, height: 1169 } as const;

const images = new Map<string, HTMLImageElement>();
/** A sample screenshot, loading once (same origin, so the canvas stays readable): the laptop's or the phone's. */
function imageFor(item: ShowcaseItem, onLoad: () => void, phone = false) {
  const src = portfolioImageUrl(phone && item.sample.phone ? item.sample.phone : item.sample.thumbnail);
  let img = images.get(src);
  if (!img) {
    img = new Image();
    img.decoding = "async";
    img.onload = onLoad;
    img.src = src;
    images.set(src, img);
  }
  return img;
}
const glows = new Map<string, string>();
/**
 * The colour a sample's screen would cast: its screenshot's average colour (top two thirds, where the hero is), with
 * saturation and lightness lifted so it reads as light. Resolves once the image is loaded; cached per image.
 */
export function glowFor(item: ShowcaseItem): Promise<string> {
  const src = portfolioImageUrl(item.sample.thumbnail);
  const cached = glows.get(src);
  if (cached) return Promise.resolve(cached);
  return new Promise((resolve) => {
    const done = (img: HTMLImageElement) => {
      const c = document.createElement("canvas");
      c.width = c.height = 16;
      const ctx = c.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight * 0.66, 0, 0, 16, 16);
      const d = ctx.getImageData(0, 0, 16, 16).data;
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]!; g += d[i + 1]!; b += d[i + 2]!; }
      const n = d.length / 4;
      const [h, s] = toHsl(r / n, g / n, b / n);
      const glow = `hsl(${Math.round(h)} ${Math.round(Math.min(Math.max(s, 0.4), 0.5) * 100)}% 64%)`;
      glows.set(src, glow);
      resolve(glow);
    };
    const img = imageFor(item, () => done(img));
    if (img.complete && img.naturalWidth) done(img);
  });
}
function toHsl(r: number, g: number, b: number): [number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return [0, 0];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? 60 * (((g - b) / d) % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
  return [(h + 360) % 360, s];
}

export function preloadScreens(items: ShowcaseItem[], onLoad: () => void) {
  items.forEach((item) => { imageFor(item, onLoad); imageFor(item, onLoad, true); });
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Shared drawing helpers: the Veloce mark, system glyphs (signal, wi-fi, battery, lock) and the system font stack.   */
/* ------------------------------------------------------------------------------------------------------------------ */

/** System UI type: San Francisco where it exists (Apple devices), the page's own sans elsewhere. */
const system = (sans: string) => `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", ${sans}`;

let logoPath: Path2D | null = null;
/** The Veloce mark (the same polygons as the site's logo), centred on cx, cy, `size` tall. */
function logo(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, colour: string) {
  logoPath ??= LOGO_POLYGONS.reduce((path, poly) => {
    const pts = poly.split(" ").map((pair) => pair.split(",").map(Number) as [number, number]);
    pts.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)));
    path.closePath();
    return path;
  }, new Path2D());
  ctx.save();
  ctx.translate(cx - (96.8 / 2) * (size / 100), cy - size / 2);
  ctx.scale(size / 100, size / 100);
  ctx.fillStyle = colour;
  ctx.fill(logoPath);
  ctx.restore();
}

/** The Veloce app icon: the light mark on the brand's near-black tile, as on a home screen. */
function appIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.fillStyle = "#111612";
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, size * 0.225);
  ctx.fill();
  ctx.strokeStyle = "rgb(255 255 255 / 0.14)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  logo(ctx, x + size / 2, y + size / 2, size * 0.56, "#f3eae6");
}

/** Cellular bars, `h` tall (bottom-aligned on y). */
function signal(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, colour: string) {
  const w = h * 0.27, gap = h * 0.13;
  ctx.fillStyle = colour;
  for (let i = 0; i < 4; i++) {
    const bh = h * (0.4 + i * 0.2);
    ctx.beginPath();
    ctx.roundRect(x + i * (w + gap), y - bh, w, bh, w * 0.35);
    ctx.fill();
  }
  return 4 * w + 3 * gap;
}

/** The wi-fi fan, `h` tall, its point on x + h * 0.7, y. */
function wifi(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, colour: string) {
  const cx = x + h * 0.7;
  ctx.fillStyle = colour;
  const spread = Math.PI / 4.2;
  [1, 0.66, 0.33].forEach((r, i) => {
    const outer = h * r, inner = i === 2 ? 0 : outer - h * 0.2;
    ctx.beginPath();
    ctx.arc(cx, y, outer, -Math.PI / 2 - spread, -Math.PI / 2 + spread);
    if (inner) ctx.arc(cx, y, inner, -Math.PI / 2 + spread, -Math.PI / 2 - spread, true);
    else ctx.lineTo(cx, y);
    ctx.closePath();
    ctx.fill();
  });
  return h * 1.4;
}

/** A battery outline with its charge, `h` tall, vertically centred on y. */
function battery(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, colour: string, level = 0.82) {
  const w = h * 2.1, r = h * 0.3, pad = h * 0.16;
  ctx.strokeStyle = colour;
  ctx.globalAlpha *= 0.45;
  ctx.lineWidth = h * 0.09;
  ctx.beginPath();
  ctx.roundRect(x, y - h / 2, w, h, r);
  ctx.stroke();
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.roundRect(x + w + h * 0.06, y - h * 0.18, h * 0.12, h * 0.36, h * 0.06);
  ctx.fill();
  ctx.globalAlpha /= 0.45;
  ctx.beginPath();
  ctx.roundRect(x + pad, y - h / 2 + pad, (w - pad * 2) * level, h - pad * 2, r * 0.6);
  ctx.fill();
  return w + h * 0.2;
}

/** A padlock, `h` tall, centred on cx and sitting on y. */
function padlock(ctx: CanvasRenderingContext2D, cx: number, y: number, h: number, colour: string) {
  const bw = h * 0.78, bh = h * 0.55;
  ctx.fillStyle = colour;
  ctx.strokeStyle = colour;
  ctx.beginPath();
  ctx.roundRect(cx - bw / 2, y - bh, bw, bh, h * 0.1);
  ctx.fill();
  ctx.lineWidth = h * 0.12;
  ctx.beginPath();
  ctx.arc(cx, y - bh, bw * 0.3, Math.PI, 0);
  ctx.lineTo(cx + bw * 0.3, y - bh + 1);
  ctx.moveTo(cx - bw * 0.3, y - bh + 1);
  ctx.lineTo(cx - bw * 0.3, y - bh);
  ctx.stroke();
}

function chevron(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, dir: "left" | "right" | "down", colour: string, width = 2) {
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  if (dir === "down") { ctx.moveTo(x - size, y - size / 2); ctx.lineTo(x, y + size / 2); ctx.lineTo(x + size, y - size / 2); }
  else { const d = dir === "right" ? 1 : -1; ctx.moveTo(x - (d * size) / 2, y - size); ctx.lineTo(x + (d * size) / 2, y); ctx.lineTo(x - (d * size) / 2, y + size); }
  ctx.stroke();
}

function lights(ctx: CanvasRenderingContext2D, x: number, y: number, r = 7) {
  ["#ff5f57", "#febc2e", "#28c840"].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x + i * r * 3.1, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgb(0 0 0 / 0.18)";
    ctx.lineWidth = 1;
    ctx.stroke();
  });
}

const now = () => new Date();
const menuClock = () => `${now().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}  9:41`;
const lockDate = () => now().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

/* ------------------------------------------------------------------------------------------------------------------ */
/* The laptop: a macOS desktop (menu bar round the notch) running a code editor, then a browser with the live site.   */
/* ------------------------------------------------------------------------------------------------------------------ */

const MENU = 36;
const EDITOR = { title: 40, activity: 54, sidebar: 250, tabs: 42, crumbs: 30, status: 28, panel: 250 } as const;
const UI = { bg: "#1f1f1f", chrome: "#181818", border: "#2b2b2b", text: "#cccccc", dim: "#9d9d9d", faint: "#6e7681", blue: "#0078d4" } as const;

function menuBar(ctx: CanvasRenderingContext2D, app: string, menus: string[], font: string) {
  const { width: W } = SCREEN_SIZE;
  ctx.fillStyle = "#121214";
  ctx.fillRect(0, 0, W, MENU);
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const notchLeft = W / 2 - 108;
  let x = 30;
  [app, ...menus].forEach((label, i) => {
    ctx.font = `${i ? 400 : 700} 19px ${font}`;
    const w = ctx.measureText(label).width;
    if (x + w > notchLeft - 16) return;
    ctx.fillStyle = "#f2f2f2";
    ctx.fillText(label, x, MENU / 2 + 1);
    x += w + 26;
  });
  // Status items, right to left: clock, battery, wi-fi.
  ctx.font = `400 19px ${font}`;
  ctx.textAlign = "right";
  ctx.fillStyle = "#f2f2f2";
  const clock = menuClock();
  ctx.fillText(clock, W - 26, MENU / 2 + 1);
  let right = W - 26 - ctx.measureText(clock).width - 22;
  right -= 44;
  battery(ctx, right, MENU / 2, 15, "#f2f2f2", 0.9);
  right -= 34;
  wifi(ctx, right, MENU / 2 + 8, 16, "#f2f2f2");
  ctx.textAlign = "left";
  // The camera notch.
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.roundRect(W / 2 - 108, -14, 216, MENU + 14, 14);
  ctx.fill();
}

type Token = { text: string; colour: string };
const SYNTAX = { kw: "#c586c0", store: "#569cd6", str: "#ce9178", tag: "#4ec9b0", attr: "#9cdcfe", fn: "#dcdcaa", angle: "#808080", plain: "#cccccc" } as const;
const BRACKETS = ["#ffd700", "#da70d6", "#179fff"] as const;

/** A small highlighter for the snippets, in the editor's default dark theme with bracket pairs coloured by depth. */
function tokenize(code: string) {
  const out: Token[] = [];
  let depth = 0;
  let i = 0;
  while (i < code.length) {
    const rest = code.slice(i);
    const prev = code[i - 1] ?? "\n";
    const start = !/\w/.test(prev);
    let m: RegExpMatchArray | null;
    let colour: string;
    if (start && (m = rest.match(/^(export|default|return)\b/))) colour = SYNTAX.kw;
    else if (start && (m = rest.match(/^function\b/))) colour = SYNTAX.store;
    else if ((m = rest.match(/^"[^"]*"/))) colour = SYNTAX.str;
    else if ((m = rest.match(/^(<\/?|\/?>)/))) colour = SYNTAX.angle;
    else if (/[</]$/.test(prev) && (m = rest.match(/^[A-Z]\w*/))) colour = SYNTAX.tag;
    else if (start && (m = rest.match(/^[A-Za-z_]\w*(?=\()/))) colour = SYNTAX.fn;
    else if (start && /[\s(]$/.test(prev) && (m = rest.match(/^[a-z]+(?=[=\s/])/))) colour = SYNTAX.attr;
    else {
      m = [rest[0]!] as unknown as RegExpMatchArray;
      const ch = rest[0]!;
      if ("{(".includes(ch)) colour = BRACKETS[depth++ % 3]!;
      else if ("})".includes(ch)) colour = BRACKETS[--depth % 3]!;
      else colour = SYNTAX.plain;
    }
    out.push({ text: m[0], colour });
    i += m[0].length;
  }
  return out;
}
const tokenCache = new Map<string, Token[]>();
const tokensFor = (code: string) => tokenCache.get(code) ?? tokenCache.set(code, tokenize(code)).get(code)!;

const BADGE: Record<string, [string, string]> = { tsx: ["TS", "#519aba"], ts: ["TS", "#519aba"], json: ["{}", "#cbcb41"], css: ["#", "#519aba"], md: ["i", "#519aba"], gitignore: ["◆", "#41535b"] };
function fileBadge(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, font: string) {
  const ext = name.split(".").pop() ?? "";
  const [glyph, colour] = BADGE[ext] ?? ["·", UI.dim];
  ctx.font = `700 13px ${font}`;
  ctx.fillStyle = colour;
  ctx.textAlign = "center";
  ctx.fillText(glyph, x + 9, y + 1);
  ctx.textAlign = "left";
}

/** The explorer's tree, opened down to the file being written. */
function treeFor(path: string) {
  const parts = path.split("/");
  const rows: { name: string; depth: number; folder?: "open" | "shut"; active?: boolean }[] = [{ name: "app", depth: 0, folder: "open" }];
  if (parts.length > 2) {
    rows.push({ name: "api", depth: 1, folder: "shut" }, { name: parts[1]!, depth: 1, folder: "open" }, { name: "page.tsx", depth: 2, active: true });
    rows.push({ name: "globals.css", depth: 1 }, { name: "layout.tsx", depth: 1 }, { name: "page.tsx", depth: 1 });
  } else {
    rows.push({ name: "api", depth: 1, folder: "shut" }, { name: "globals.css", depth: 1 }, { name: "layout.tsx", depth: 1 }, { name: "page.tsx", depth: 1, active: true });
  }
  rows.push({ name: "components", depth: 0, folder: "shut" }, { name: "public", depth: 0, folder: "shut" }, { name: ".gitignore", depth: 0 }, { name: "next.config.ts", depth: 0 }, { name: "package.json", depth: 0 }, { name: "README.md", depth: 0 }, { name: "tsconfig.json", depth: 0 });
  return rows;
}

function activityBar(ctx: CanvasRenderingContext2D, top: number, bottom: number) {
  const { activity } = EDITOR;
  ctx.fillStyle = UI.chrome;
  ctx.fillRect(0, top, activity, bottom - top);
  ctx.fillStyle = UI.border;
  ctx.fillRect(activity - 1, top, 1, bottom - top);
  const cx = activity / 2;
  const icon = (i: number, active: boolean, draw: (y: number) => void) => {
    const y = top + 32 + i * 56;
    ctx.strokeStyle = active ? "#d7d7d7" : "#868686";
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = 2.2;
    ctx.lineJoin = "round";
    if (active) { ctx.fillStyle = UI.blue; ctx.fillRect(0, y - 22, 3, 44); ctx.fillStyle = ctx.strokeStyle; }
    draw(y);
  };
  // Explorer (two pages), search, source control, run, extensions.
  icon(0, true, (y) => { ctx.strokeRect(cx - 9, y - 12, 15, 20); ctx.strokeRect(cx - 4, y - 7, 15, 20); });
  icon(1, false, (y) => { ctx.beginPath(); ctx.arc(cx - 2, y - 3, 8, 0, Math.PI * 2); ctx.moveTo(cx + 4, y + 3); ctx.lineTo(cx + 11, y + 10); ctx.stroke(); });
  icon(2, false, (y) => { ctx.beginPath(); ctx.arc(cx - 6, y - 9, 3.5, 0, Math.PI * 2); ctx.moveTo(cx + 9.5, y - 9); ctx.arc(cx + 6, y - 9, 3.5, 0, Math.PI * 2); ctx.moveTo(cx - 2.5, y + 10); ctx.arc(cx - 6, y + 10, 3.5, 0, Math.PI * 2); ctx.moveTo(cx - 6, y - 5.5); ctx.lineTo(cx - 6, y + 6.5); ctx.moveTo(cx + 6, y - 5.5); ctx.quadraticCurveTo(cx + 6, y + 2, cx - 5, y + 7); ctx.stroke(); });
  icon(3, false, (y) => { ctx.beginPath(); ctx.moveTo(cx - 6, y - 10); ctx.lineTo(cx + 9, y); ctx.lineTo(cx - 6, y + 10); ctx.closePath(); ctx.stroke(); });
  icon(4, false, (y) => { ctx.strokeRect(cx - 10, y - 2, 9, 9); ctx.strokeRect(cx - 1, y - 2, 9, 9); ctx.strokeRect(cx - 10, y - 11, 9, 9); ctx.strokeRect(cx + 2, y - 14, 9, 9); });
  // Account and settings at the foot.
  ctx.strokeStyle = "#868686";
  ctx.beginPath(); ctx.arc(cx, bottom - 88, 6, 0, Math.PI * 2); ctx.moveTo(cx + 11, bottom - 70); ctx.arc(cx, bottom - 70, 11, 0, Math.PI, true); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, bottom - 32, 9, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, bottom - 32, 3, 0, Math.PI * 2); ctx.stroke();
}

function explorer(ctx: CanvasRenderingContext2D, path: string, top: number, bottom: number, font: string) {
  const x0 = EDITOR.activity, w = EDITOR.sidebar;
  ctx.fillStyle = UI.chrome;
  ctx.fillRect(x0, top, w, bottom - top);
  ctx.fillStyle = UI.border;
  ctx.fillRect(x0 + w - 1, top, 1, bottom - top);
  ctx.textBaseline = "middle";
  ctx.font = `400 14px ${font}`;
  ctx.fillStyle = UI.dim;
  ctx.fillText("EXPLORER", x0 + 20, top + 22);
  ctx.fillText("···", x0 + w - 40, top + 20);
  chevron(ctx, x0 + 14, top + 54, 4.5, "down", UI.text, 1.6);
  ctx.font = `700 14px ${font}`;
  ctx.fillStyle = UI.text;
  ctx.fillText("VELOCE-SITES", x0 + 26, top + 54);
  const rowH = 30;
  treeFor(path).forEach((row, i) => {
    const y = top + 86 + i * rowH;
    const x = x0 + 22 + row.depth * 16;
    if (row.active) {
      ctx.fillStyle = "#37373d";
      ctx.fillRect(x0, y - rowH / 2, w - 1, rowH);
      ctx.strokeStyle = UI.blue;
      ctx.lineWidth = 1;
      ctx.strokeRect(x0 + 0.5, y - rowH / 2 + 0.5, w - 2, rowH - 1);
    }
    if (row.folder) chevron(ctx, x + 4, y, row.folder === "open" ? 4.5 : 4, row.folder === "open" ? "down" : "right", UI.dim, 1.6);
    else fileBadge(ctx, row.name, x - 4, y, font);
    ctx.font = `400 17px ${font}`;
    ctx.fillStyle = row.active ? "#ffffff" : UI.text;
    ctx.fillText(row.name, x + 22, y + 1);
  });
  // Collapsed panes at the foot, as the editor has them.
  ["OUTLINE", "TIMELINE"].forEach((label, i) => {
    const y = bottom - 70 + i * 34;
    ctx.fillStyle = UI.border;
    ctx.fillRect(x0, y - 17, w - 1, 1);
    chevron(ctx, x0 + 14, y, 4, "right", UI.text, 1.6);
    ctx.font = `700 14px ${font}`;
    ctx.fillStyle = UI.text;
    ctx.fillText(label, x0 + 26, y + 1);
  });
}

function drawEditor(ctx: CanvasRenderingContext2D, s: ShowState, item: ShowcaseItem, fonts: { mono: string; sans: string }, font: string) {
  const { width: W, height: H } = SCREEN_SIZE;
  const code = SNIPPETS[item.kind];
  const path = FILES[item.kind];
  const typed = s.phase === "code" ? s.typed : code.length;
  const panel = s.phase !== "code";

  // Window title bar: traffic lights and the command centre.
  const winTop = MENU;
  ctx.fillStyle = UI.chrome;
  ctx.fillRect(0, winTop, W, EDITOR.title);
  ctx.fillStyle = UI.border;
  ctx.fillRect(0, winTop + EDITOR.title - 1, W, 1);
  lights(ctx, 26, winTop + EDITOR.title / 2);
  ctx.fillStyle = "#2a2a2a";
  ctx.strokeStyle = "#3c3c3c";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(W / 2 - 200, winTop + 7, 400, 26, 7);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = UI.dim;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(W / 2 - 56, winTop + 19, 5.5, 0, Math.PI * 2);
  ctx.moveTo(W / 2 - 52, winTop + 23);
  ctx.lineTo(W / 2 - 48, winTop + 27);
  ctx.stroke();
  ctx.font = `400 15px ${font}`;
  ctx.fillStyle = UI.dim;
  ctx.textBaseline = "middle";
  ctx.fillText("veloce-sites", W / 2 - 38, winTop + 21);

  const bodyTop = winTop + EDITOR.title;
  const statusTop = H - EDITOR.status;
  activityBar(ctx, bodyTop, statusTop);
  explorer(ctx, path, bodyTop, statusTop, font);

  // Editor group: tabs, breadcrumbs, code, minimap.
  const left = EDITOR.activity + EDITOR.sidebar;
  ctx.fillStyle = UI.chrome;
  ctx.fillRect(left, bodyTop, W - left, EDITOR.tabs);
  ctx.fillStyle = UI.border;
  ctx.fillRect(left, bodyTop + EDITOR.tabs - 1, W - left, 1);
  const file = path.split("/").pop()!;
  const tabs = [{ name: file, active: true, hint: path.split("/").length > 2 ? path.split("/").slice(-2, -1)[0] : "" }, { name: "layout.tsx", active: false, hint: "" }];
  let tx = left;
  ctx.textBaseline = "middle";
  for (const tab of tabs) {
    ctx.font = `400 16px ${font}`;
    const hintW = tab.hint ? ctx.measureText(` ${tab.hint}`).width : 0;
    const w = 54 + ctx.measureText(tab.name).width + hintW + 34;
    ctx.fillStyle = tab.active ? UI.bg : UI.chrome;
    ctx.fillRect(tx, bodyTop, w, EDITOR.tabs - (tab.active ? 0 : 1));
    if (tab.active) { ctx.fillStyle = UI.blue; ctx.fillRect(tx, bodyTop, w, 2); }
    ctx.fillStyle = UI.border;
    ctx.fillRect(tx + w - 1, bodyTop, 1, EDITOR.tabs);
    fileBadge(ctx, tab.name, tx + 12, bodyTop + EDITOR.tabs / 2, font);
    ctx.font = `${tab.active ? 400 : 400} 16px ${font}`;
    ctx.fillStyle = tab.active ? "#ffffff" : UI.dim;
    ctx.fillText(tab.name, tx + 38, bodyTop + EDITOR.tabs / 2 + 1);
    if (tab.hint) { ctx.fillStyle = UI.faint; ctx.fillText(` ${tab.hint}`, tx + 38 + ctx.measureText(tab.name).width, bodyTop + EDITOR.tabs / 2 + 1); }
    if (tab.active) {
      // Unsaved while typing: a dot; saved: the close cross.
      const cx = tx + w - 22, cy = bodyTop + EDITOR.tabs / 2;
      ctx.fillStyle = ctx.strokeStyle = UI.text;
      if (s.phase === "code") { ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(cx - 5, cy - 5); ctx.lineTo(cx + 5, cy + 5); ctx.moveTo(cx + 5, cy - 5); ctx.lineTo(cx - 5, cy + 5); ctx.stroke(); }
    }
    tx += w;
  }

  const crumbsTop = bodyTop + EDITOR.tabs;
  ctx.fillStyle = UI.bg;
  ctx.fillRect(left, crumbsTop, W - left, statusTop - crumbsTop);
  ctx.font = `400 15px ${font}`;
  let bx = left + 22;
  const crumbs = [...path.split("/"), item.kind === "website" ? "Home" : item.kind === "store" ? "Shop" : "Portal"];
  crumbs.forEach((c, i) => {
    ctx.fillStyle = UI.dim;
    ctx.fillText(c, bx, crumbsTop + EDITOR.crumbs / 2 + 1);
    bx += ctx.measureText(c).width + 10;
    if (i < crumbs.length - 1) { chevron(ctx, bx + 2, crumbsTop + EDITOR.crumbs / 2, 4, "right", UI.faint, 1.4); bx += 16; }
  });

  const codeTop = crumbsTop + EDITOR.crumbs + 8;
  const lineH = 38;
  const gutter = left + 64;
  const textX = gutter + 30;
  ctx.font = `400 25px ${fonts.mono}`;
  ctx.textBaseline = "alphabetic";
  const adv = ctx.measureText("M").width;
  const lines = code.split("\n");
  const before = code.slice(0, typed);
  const caretLine = before.split("\n").length - 1;
  const caretCol = typed - (before.lastIndexOf("\n") + 1);
  // The current line's outline.
  ctx.strokeStyle = "#282828";
  ctx.lineWidth = 2;
  ctx.strokeRect(left + 2, codeTop + caretLine * lineH + 1, W - left - 96, lineH - 2);
  ctx.textAlign = "right";
  lines.forEach((_, l) => {
    ctx.fillStyle = l === caretLine ? UI.text : UI.faint;
    ctx.fillText(String(l + 1), gutter, codeTop + l * lineH + 27);
  });
  ctx.textAlign = "left";
  // Indent guides.
  ctx.fillStyle = "#404040";
  lines.forEach((line, l) => {
    const indent = line.match(/^ */)![0].length;
    for (let g = 2; g <= indent; g += 2) ctx.fillRect(textX + (g - 2) * adv, codeTop + l * lineH, 1, lineH);
  });
  const mini = { x: W - 82, y: codeTop + 2, cw: 2.4, lh: 6 };
  let col = 0, row = 0, count = 0;
  for (const t of tokensFor(code)) {
    for (const ch of t.text) {
      if (count >= typed) break;
      count++;
      if (ch === "\n") { col = 0; row++; continue; }
      ctx.fillStyle = t.colour;
      ctx.fillText(ch, textX + col * adv, codeTop + row * lineH + 27);
      if (ch !== " ") { ctx.globalAlpha = 0.55; ctx.fillRect(mini.x + col * mini.cw, mini.y + row * mini.lh, mini.cw, mini.lh - 2); ctx.globalAlpha = 1; }
      col++;
    }
  }
  if (s.phase === "code" && Math.floor(performance.now() / 500) % 2 === 0) {
    ctx.fillStyle = "#aeafad";
    ctx.fillRect(textX + caretCol * adv, codeTop + caretLine * lineH + 5, 2.5, lineH - 10);
  }
  // Minimap slider and the vertical ruler of the scrollbar.
  ctx.fillStyle = "rgb(121 121 121 / 0.12)";
  ctx.fillRect(mini.x - 8, codeTop, 90, lines.length * mini.lh + 40);
  ctx.fillStyle = UI.border;
  ctx.fillRect(mini.x - 9, crumbsTop + EDITOR.crumbs, 1, statusTop - crumbsTop - EDITOR.crumbs);

  // The integrated terminal, deploying.
  if (panel) {
    const deployed = s.phase === "deploy" ? s.deployed : DEPLOY_STEPS - 1;
    const top = statusTop - EDITOR.panel;
    ctx.fillStyle = UI.chrome;
    ctx.fillRect(left, top, W - left, EDITOR.panel);
    ctx.fillStyle = UI.border;
    ctx.fillRect(left, top, W - left, 1);
    ctx.font = `400 13px ${font}`;
    ctx.textBaseline = "middle";
    let hx = left + 22;
    ["PROBLEMS", "OUTPUT", "DEBUG CONSOLE", "TERMINAL", "PORTS"].forEach((label) => {
      const active = label === "TERMINAL";
      ctx.fillStyle = active ? "#e7e7e7" : UI.dim;
      ctx.fillText(label, hx, top + 22);
      const w = ctx.measureText(label).width;
      if (active) { ctx.fillStyle = UI.blue; ctx.fillRect(hx, top + 36, w, 1.5); }
      hx += w + 26;
    });
    ctx.textAlign = "right";
    ctx.fillStyle = UI.dim;
    ctx.fillText("zsh   +   ⌄   ···", W - 30, top + 22);
    ctx.textAlign = "left";
    ctx.font = `400 19px ${fonts.mono}`;
    const host = `https://${item.sample.slug}.veloceapp.dev`;
    const prompt = (y: number, cmd: string) => {
      let x = left + 22;
      for (const [text, colour] of [["➜  ", "#23d18b"], ["veloce-sites ", "#29b8db"], ["git:(", "#3b8eea"], ["main", "#f14c4c"], [") ", "#3b8eea"], [cmd, "#cccccc"]] as const) {
        ctx.fillStyle = colour;
        ctx.fillText(text, x, y);
        x += ctx.measureText(text).width;
      }
      return x;
    };
    const lh = 27;
    let y = top + 66;
    prompt(y, "npm run deploy");
    const log: [string, string][][] = [
      [["  Creating an optimized production build ...", "#cccccc"]],
      [["✓ ", "#23d18b"], ["Compiled successfully in 2.4s", "#cccccc"]],
      [["✓ ", "#23d18b"], ["Generating static pages (12/12)", "#cccccc"]],
      [["✓ ", "#23d18b"], ["Production: ", "#cccccc"], [host, "#29b8db"], [" [8s]", "#808080"]],
    ];
    const shown = deployed === 0 ? 1 : deployed === 1 ? 3 : 4;
    log.slice(0, shown).forEach((parts) => {
      y += lh;
      let x = left + 22;
      for (const [text, colour] of parts) {
        ctx.fillStyle = colour;
        ctx.fillText(text, x, y);
        x += ctx.measureText(text).width;
      }
    });
    y += lh;
    const end = deployed >= DEPLOY_STEPS - 1 ? prompt(y, "") : left + 22;
    ctx.fillStyle = "#cccccc";
    ctx.fillRect(end, y - 10, 11, 21);
  }

  // Status bar.
  ctx.fillStyle = UI.chrome;
  ctx.fillRect(0, statusTop, W, EDITOR.status);
  ctx.fillStyle = UI.border;
  ctx.fillRect(0, statusTop, W, 1);
  ctx.fillStyle = UI.blue;
  ctx.fillRect(0, statusTop, 44, EDITOR.status);
  ctx.strokeStyle = "#fff";
  chevron(ctx, 17, statusTop + 14, 4, "right", "#fff", 1.6);
  chevron(ctx, 27, statusTop + 14, 4, "left", "#fff", 1.6);
  ctx.font = `400 14px ${font}`;
  ctx.textBaseline = "middle";
  ctx.fillStyle = UI.text;
  ctx.fillText(`main${s.phase === "code" ? "*" : ""}   ⓧ 0  ⚠ 0`, 62, statusTop + 15);
  ctx.textAlign = "right";
  ctx.fillText(`Ln ${caretLine + 1}, Col ${caretCol + 1}    Spaces: 2    UTF-8    LF    {} TypeScript JSX    Prettier`, W - 22, statusTop + 15);
  ctx.textAlign = "left";
}

function drawBrowser(ctx: CanvasRenderingContext2D, item: ShowcaseItem, font: string, onImage: () => void) {
  const { width: W, height: H } = SCREEN_SIZE;
  const bar = 54;
  const top = MENU;
  const toolbar = ctx.createLinearGradient(0, top, 0, top + bar);
  toolbar.addColorStop(0, "#f4f4f4");
  toolbar.addColorStop(1, "#ebebeb");
  ctx.fillStyle = toolbar;
  ctx.fillRect(0, top, W, bar);
  ctx.fillStyle = "#d2d2d2";
  ctx.fillRect(0, top + bar - 1, W, 1);
  const mid = top + bar / 2;
  lights(ctx, 26, mid);
  // Sidebar toggle, back and forward.
  ctx.strokeStyle = "#7b7b7b";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.roundRect(112, mid - 10, 26, 20, 4);
  ctx.moveTo(121, mid - 10);
  ctx.lineTo(121, mid + 10);
  ctx.stroke();
  chevron(ctx, 168, mid, 7, "left", "#6b6b6b", 2.2);
  chevron(ctx, 202, mid, 7, "right", "#b5b5b5", 2.2);
  // The address field: lock and host, a reload arrow at its end.
  const host = `${item.sample.slug}.veloceapp.dev`;
  const fieldW = 560, fx = (W - fieldW) / 2;
  ctx.fillStyle = "#e1e1e1";
  ctx.beginPath();
  ctx.roundRect(fx, mid - 17, fieldW, 34, 9);
  ctx.fill();
  ctx.font = `400 17px ${font}`;
  ctx.textBaseline = "middle";
  const tw = ctx.measureText(host).width;
  padlock(ctx, W / 2 - tw / 2 - 14, mid + 6, 14, "#6b6b6b");
  ctx.fillStyle = "#1d1d1f";
  ctx.textAlign = "center";
  ctx.fillText(host, W / 2 + 6, mid + 1);
  ctx.textAlign = "left";
  ctx.strokeStyle = "#7b7b7b";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(fx + fieldW - 22, mid, 7, -Math.PI * 0.35, Math.PI * 1.45);
  ctx.stroke();
  // Share, new tab, tab overview.
  const rx = W - 130;
  ctx.beginPath();
  ctx.moveTo(rx - 8, mid - 3); ctx.lineTo(rx - 8, mid + 11); ctx.lineTo(rx + 8, mid + 11); ctx.lineTo(rx + 8, mid - 3);
  ctx.moveTo(rx, mid + 3); ctx.lineTo(rx, mid - 13); ctx.moveTo(rx - 5, mid - 8); ctx.lineTo(rx, mid - 13); ctx.lineTo(rx + 5, mid - 8);
  ctx.moveTo(rx + 42, mid - 9); ctx.lineTo(rx + 42, mid + 9); ctx.moveTo(rx + 33, mid); ctx.lineTo(rx + 51, mid);
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(rx + 76, mid - 6, 16, 14, 3);
  ctx.moveTo(rx + 80, mid - 10); ctx.lineTo(rx + 96, mid - 10); ctx.lineTo(rx + 96, mid + 4);
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, top + bar, W, H - top - bar);
  const img = imageFor(item, onImage);
  if (img.complete && img.naturalWidth) {
    const scale = W / img.naturalWidth;
    const h = H - top - bar;
    ctx.drawImage(img, 0, 0, img.naturalWidth, h / scale, 0, top + bar, W, h);
  }
}

/**
 * Draws one frame. `siteMix` (0..1) cross-fades from the editor to the finished site; the scene eases it so the
 * reveal is smooth. `fonts.mono` is the page's mono stack.
 */
export function drawScreen(ctx: CanvasRenderingContext2D, s: ShowState, item: ShowcaseItem, siteMix: number, fonts: { mono: string; sans: string }, onImage: () => void) {
  const { width: W, height: H } = SCREEN_SIZE;
  const font = system(fonts.sans);
  ctx.globalAlpha = 1;
  ctx.textAlign = "left";
  ctx.fillStyle = UI.bg;
  ctx.fillRect(0, 0, W, H);
  if (siteMix < 0.999) drawEditor(ctx, s, item, fonts, font);
  if (siteMix > 0.001) {
    ctx.globalAlpha = siteMix;
    drawBrowser(ctx, item, font, onImage);
    ctx.globalAlpha = 1;
  }
  menuBar(ctx, siteMix > 0.5 ? "Safari" : "Code", siteMix > 0.5 ? ["File", "Edit", "View", "History", "Bookmarks", "Window", "Help"] : ["File", "Edit", "Selection", "View", "Go", "Run", "Terminal", "Window", "Help"], font);

  // Trackpad cursor.
  if (s.cursor) {
    const cx = s.cursor.x * W;
    const cy = s.cursor.y * H;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(2, 2);
    ctx.shadowColor = "rgb(0 0 0 / 0.35)";
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(15, 11); ctx.lineTo(8, 12); ctx.lineTo(12, 20); ctx.lineTo(9, 21); ctx.lineTo(5, 13); ctx.lineTo(0, 18);
    ctx.closePath();
    ctx.fillStyle = "#111";
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.4;
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.shadowColor = "transparent";
    ctx.fill();
    ctx.restore();
  }
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* The phone: an iOS lock screen whose notifications follow the build, then the sample in the browser at phone size.  */
/* ------------------------------------------------------------------------------------------------------------------ */

/** Points to pixels: the phone canvas is a 390pt-wide screen. */
const pt = (n: number) => (n * PHONE_SIZE.width) / 390;

function phoneStatus(ctx: CanvasRenderingContext2D, colour: string, font: string, time: boolean) {
  const { width: W } = PHONE_SIZE;
  const y = pt(27);
  ctx.textBaseline = "middle";
  if (time) {
    ctx.font = `600 ${pt(17)}px ${font}`;
    ctx.fillStyle = colour;
    ctx.textAlign = "center";
    ctx.fillText("9:41", pt(66), y + 1);
    ctx.textAlign = "left";
  }
  let x = W - pt(28) - pt(27) * 1.05;
  battery(ctx, x, y, pt(12.5), colour, 0.82);
  x -= pt(25);
  wifi(ctx, x, y + pt(5.5), pt(11.5), colour);
  x -= pt(24);
  signal(ctx, x, y + pt(5.5), pt(12), colour);
}

function island(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.roundRect(PHONE_SIZE.width / 2 - pt(63), pt(11), pt(126), pt(37), pt(18.5));
  ctx.fill();
}

function homeIndicator(ctx: CanvasRenderingContext2D, colour: string) {
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.roundRect(PHONE_SIZE.width / 2 - pt(67), PHONE_SIZE.height - pt(13), pt(134), pt(5), pt(2.5));
  ctx.fill();
}

/** A round lock-screen control (torch, camera) with its glyph. */
function quickButton(ctx: CanvasRenderingContext2D, cx: number, cy: number, kind: "torch" | "camera") {
  ctx.fillStyle = "rgb(30 34 44 / 0.55)";
  ctx.beginPath();
  ctx.arc(cx, cy, pt(25), 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = ctx.fillStyle = "#fff";
  ctx.lineWidth = pt(1.8);
  ctx.lineJoin = "round";
  ctx.beginPath();
  if (kind === "torch") {
    ctx.moveTo(cx - pt(6), cy - pt(10)); ctx.lineTo(cx + pt(6), cy - pt(10)); ctx.lineTo(cx + pt(6), cy - pt(5)); ctx.lineTo(cx + pt(3.5), cy - pt(1));
    ctx.lineTo(cx + pt(3.5), cy + pt(11)); ctx.lineTo(cx - pt(3.5), cy + pt(11)); ctx.lineTo(cx - pt(3.5), cy - pt(1)); ctx.lineTo(cx - pt(6), cy - pt(5)); ctx.closePath();
    ctx.moveTo(cx, cy + pt(2)); ctx.lineTo(cx, cy + pt(5));
  } else {
    ctx.roundRect(cx - pt(11), cy - pt(6), pt(22), pt(15), pt(3));
    ctx.moveTo(cx - pt(4), cy - pt(6)); ctx.lineTo(cx - pt(2.5), cy - pt(9)); ctx.lineTo(cx + pt(2.5), cy - pt(9)); ctx.lineTo(cx + pt(4), cy - pt(6));
    ctx.moveTo(cx + pt(4), cy + pt(1.5)); ctx.arc(cx, cy + pt(1.5), pt(4), 0, Math.PI * 2);
  }
  ctx.stroke();
}

function wallpaper(ctx: CanvasRenderingContext2D) {
  const { width: W, height: H } = PHONE_SIZE;
  const base = ctx.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, "#1b2340");
  base.addColorStop(0.6, "#0f1424");
  base.addColorStop(1, "#07090f");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);
  const blob = (x: number, y: number, r: number, colour: string) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, colour);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };
  blob(W * 0.15, H * 0.12, W * 0.9, "rgb(83 109 254 / 0.45)");
  blob(W * 0.95, H * 0.45, W * 0.8, "rgb(32 178 170 / 0.28)");
  blob(W * 0.3, H * 0.95, W * 0.9, "rgb(140 82 255 / 0.25)");
}

/**
 * The phone beside the laptop: a lock screen whose notifications follow the build (started, deploying, live), then
 * the finished sample at phone size, fading in with the laptop's. Same arguments as drawScreen.
 */
export function drawPhone(ctx: CanvasRenderingContext2D, s: ShowState, item: ShowcaseItem, siteMix: number, fonts: { mono: string; sans: string }, onImage: () => void) {
  const { width: W, height: H } = PHONE_SIZE;
  const font = system(fonts.sans);
  ctx.globalAlpha = 1;
  wallpaper(ctx);

  // Lock, date and the big clock.
  padlock(ctx, W / 2, pt(78), pt(17), "rgb(255 255 255 / 0.92)");
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgb(255 255 255 / 0.9)";
  ctx.font = `600 ${pt(20)}px ${font}`;
  ctx.fillText(lockDate(), W / 2, pt(118));
  ctx.fillStyle = "#fff";
  ctx.font = `700 ${pt(96)}px "SF Pro Rounded", ${font}`;
  if ("letterSpacing" in ctx) ctx.letterSpacing = `-${pt(2)}px`;
  ctx.fillText("9:41", W / 2, pt(208));
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
  ctx.textAlign = "left";

  // Notifications from the build, newest on top, sitting low on the screen as iOS stacks them.
  const live = s.phase === "site" || s.phase === "clear" || (s.phase === "deploy" && s.deployed >= DEPLOY_STEPS - 1);
  const notes = [{ title: "Build started", body: `Coding ${VERB[item.kind]}`, when: s.phase === "code" ? "now" : "1m ago" }];
  if (s.phase !== "code") notes.unshift(live ? { title: "Deployed", body: `Live at ${item.sample.slug}.veloceapp.dev`, when: "now" } : { title: "Deploying", body: "Building and checking the site", when: "now" });
  const cardH = pt(74), gap = pt(8), side = pt(14);
  const stackTop = H - pt(150) - notes.length * (cardH + gap);
  notes.forEach((n, i) => {
    const y = stackTop + i * (cardH + gap);
    ctx.fillStyle = "rgb(245 246 250 / 0.2)";
    ctx.beginPath();
    ctx.roundRect(side, y, W - side * 2, cardH, pt(22));
    ctx.fill();
    ctx.strokeStyle = "rgb(255 255 255 / 0.08)";
    ctx.lineWidth = 1;
    ctx.stroke();
    appIcon(ctx, side + pt(14), y + (cardH - pt(38)) / 2, pt(38));
    const tx = side + pt(64);
    ctx.textBaseline = "alphabetic";
    ctx.font = `600 ${pt(15)}px ${font}`;
    ctx.fillStyle = "#fff";
    ctx.fillText(n.title, tx, y + pt(32));
    ctx.font = `400 ${pt(13)}px ${font}`;
    ctx.fillStyle = "rgb(255 255 255 / 0.6)";
    ctx.textAlign = "right";
    ctx.fillText(n.when, W - side - pt(16), y + pt(32));
    ctx.textAlign = "left";
    ctx.font = `400 ${pt(15)}px ${font}`;
    ctx.fillStyle = "rgb(255 255 255 / 0.88)";
    let body = n.body;
    while (ctx.measureText(body).width > W - side * 2 - pt(80) && body.length > 4) body = `${body.slice(0, -2)}…`;
    ctx.fillText(body, tx, y + pt(52));
  });
  quickButton(ctx, pt(71), H - pt(76), "torch");
  quickButton(ctx, W - pt(71), H - pt(76), "camera");

  // The finished sample in the browser: the page under the status bar, the address pill floating at the foot.
  let bar = "#0c0e14";
  let foot = "#0c0e14";
  if (siteMix > 0.001) {
    ctx.globalAlpha = siteMix;
    const img = imageFor(item, onImage, true);
    const top = pt(54);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, W, H);
    if (img.complete && img.naturalWidth) {
      const scale = W / img.naturalWidth;
      const fit = Math.min(img.naturalHeight, (H - top) / scale);
      ctx.drawImage(img, 0, 0, img.naturalWidth, fit, 0, top, W, fit * scale);
      const [r, g, b] = ctx.getImageData(W / 2, top + 2, 1, 1).data;
      bar = `rgb(${r} ${g} ${b})`;
      const [fr, fg, fb] = ctx.getImageData(W / 2, H - pt(8), 1, 1).data;
      foot = `rgb(${fr} ${fg} ${fb})`;
    }
    ctx.fillStyle = bar;
    ctx.fillRect(0, 0, W, top);
    // Address pill.
    const pillH = pt(48), pillY = H - pt(34) - pillH, pillX = pt(12);
    ctx.save();
    ctx.shadowColor = "rgb(0 0 0 / 0.22)";
    ctx.shadowBlur = pt(16);
    ctx.shadowOffsetY = pt(3);
    ctx.fillStyle = "rgb(250 250 250 / 0.94)";
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, W - pillX * 2, pillH, pillH / 2);
    ctx.fill();
    ctx.restore();
    const mid = pillY + pillH / 2;
    chevron(ctx, pillX + pt(24), mid, pt(7), "left", "#1d1d1f", pt(2.2));
    ctx.font = `500 ${pt(15)}px ${font}`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    const host = `${item.sample.slug}.veloceapp.dev`;
    let label = host;
    while (ctx.measureText(label).width > W - pt(140) && label.length > 6) label = `${label.slice(0, -2)}…`;
    const lw = ctx.measureText(label).width;
    padlock(ctx, W / 2 - lw / 2 - pt(10), mid + pt(5), pt(11), "#5f5f63");
    ctx.fillStyle = "#1d1d1f";
    ctx.fillText(label, W / 2 + pt(5), mid + 1);
    ctx.textAlign = "left";
    ctx.fillStyle = "#1d1d1f";
    [-1, 0, 1].forEach((d) => { ctx.beginPath(); ctx.arc(W - pillX - pt(26) + d * pt(6), mid, pt(1.8), 0, Math.PI * 2); ctx.fill(); });
    ctx.globalAlpha = 1;
  }

  const site = siteMix > 0.5;
  const isLight = (colour: string) => { const [r, g, b] = colour.match(/\d+/g)!.map(Number) as [number, number, number]; return site && r * 0.3 + g * 0.59 + b * 0.11 > 150; };
  phoneStatus(ctx, isLight(bar) ? "#111" : "#fff", font, site);
  homeIndicator(ctx, isLight(foot) ? "#111" : "#fff");
  island(ctx);
}
