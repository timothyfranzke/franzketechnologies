/* <leaf-text> — flows text inside a leaf-shaped snowflake outline.
 *
 * Usage:
 *   <script src="leaf-text.js"></script>
 *   <leaf-text font-size="12"><b>Title.</b> Body text…</leaf-text>
 *
 * Attributes (all optional):
 *   font-size    text size in shape units (Illustrator points). Default 12.
 *   font-family  default "Source Sans 3", sans-serif  (load the font yourself)
 *   padding      inset from the outline, shape units. Default 6.
 *   outline      show the shape outline. Default off; set outline="" to show.
 *   fit          "shrink" (default) scales text down until it fits; "none" leaves it.
 *   path         override the shape with any SVG path "d" string.
 *   align        "center" (default) | "left" | "justify"
 *   text-rotate  degrees to rotate the text inside the (upright) shape, e.g. -90 to
 *                read bottom-to-top, 90 top-to-bottom. Only paths made of absolute
 *                M/L/C/S/Q/T/Z commands support this. Default 0.
 *   valign       "top" (default) | "middle"  — centers the text block vertically.
 *
 * Inline <b>/<strong> render bold, <i>/<em> italic, <u> underlined. Sizes with CSS width.
 * The outline color can be overridden with the --leaf-outline custom property.
 */
(() => {
  const LEAF = "M275.18 582.49 C234.63 561.62 215.95 551.84 213.29 539.45 C210.62 527.06 185.73 403.68 233.11 328.25 C280.50 252.82 308.47 231.76 308.47 231.76 C308.47 231.76 371.21 286.15 386.74 328.25 C402.26 370.36 438.42 465.72 409.51 539.45 C404.68 551.75 350.10 582.49 350.10 582.49 C350.10 582.49 315.73 603.36 275.18 582.49Z";
  const NS = "http://www.w3.org/2000/svg";
  const rotatePath = (d, deg) => {
    if (!deg || /[a-zHVA]/.test(d.replace(/[\d.\-+eE\s,]/g, ""))) return d;
    const rad = deg * Math.PI / 180, cos = Math.cos(rad), sin = Math.sin(rad);
    return d.replace(/([MLCSQT])([^A-Za-z]*)/g, (m, cmd, nums) => {
      const v = nums.trim().split(/[\s,]+/).map(Number), out = [];
      for (let i = 0; i + 1 < v.length; i += 2) {
        const x = v[i], y = v[i + 1];
        out.push((x * cos - y * sin).toFixed(2), (x * sin + y * cos).toFixed(2));
      }
      return cmd + out.join(" ");
    });
  };
  const measureCanvas = document.createElement("canvas").getContext("2d");

  class LeafText extends HTMLElement {
    static get observedAttributes() { return ["font-size","font-family","padding","outline","fit","path","align","valign","text-rotate"]; }
    constructor() {
      super();
      this.attachShadow({ mode: "open" }).innerHTML = `
        <style>
          :host{display:block;contain:content}
          svg{display:block;width:100%;height:auto;overflow:visible}
          .outline{fill:none;stroke:var(--leaf-outline,currentColor);stroke-width:1;vector-effect:non-scaling-stroke;opacity:.6}
          text{fill:currentColor}
        </style>
        <svg><path class="shape" fill="none" stroke="none"/><g class="rot"><path class="outline" hidden/><g class="lines"></g></g></svg>`;
      this._svg = this.shadowRoot.querySelector("svg");
      this._shape = this.shadowRoot.querySelector(".shape");
      this._outline = this.shadowRoot.querySelector(".outline");
      this._rot = this.shadowRoot.querySelector(".rot");
      this._lines = this.shadowRoot.querySelector(".lines");
      this._mo = new MutationObserver(() => this._schedule());
    }
    connectedCallback() {
      this._mo.observe(this, { childList: true, characterData: true, subtree: true });
      document.fonts?.addEventListener("loadingdone", this._onFonts = () => this._schedule());
      this._schedule();
    }
    disconnectedCallback() {
      this._mo.disconnect();
      document.fonts?.removeEventListener("loadingdone", this._onFonts);
    }
    attributeChangedCallback() { this._schedule(); }
    _schedule() { cancelAnimationFrame(this._raf); this._raf = requestAnimationFrame(() => this._render()); }

    _tokens() {
      const out = [];
      const walk = (node, st) => {
        for (const n of node.childNodes) {
          if (n.nodeType === 3) {
            // Split on ordinary whitespace only; a non-breaking space keeps words together.
            for (const w of n.textContent.split(/[^\S\u00a0]+/)) if (w) out.push({ text: w, ...st });
          } else if (n.nodeType === 1) {
            if (n.tagName === "BR") { out.push({ br: true }); continue; }
            walk(n, {
              bold: st.bold || /^(B|STRONG)$/.test(n.tagName),
              italic: st.italic || /^(I|EM)$/.test(n.tagName),
              underline: st.underline || n.tagName === "U",
            });
          }
        }
      };
      walk(this, { bold: false, italic: false, underline: false });
      return out;
    }

    _render() {
      const upright = this.getAttribute("path") || LEAF;
      const tRot = parseFloat(this.getAttribute("text-rotate")) || 0;
      // Lay the text out horizontally inside the shape rotated the other way,
      // then rotate the whole drawing back so the shape is upright and the text is turned.
      const d = rotatePath(upright, -tRot);
      const family = this.getAttribute("font-family") || '"Source Sans 3", sans-serif';
      const pad = parseFloat(this.getAttribute("padding") ?? 6);
      const reqSize = parseFloat(this.getAttribute("font-size") ?? 12);
      const fit = this.getAttribute("fit") || "shrink";
      const align = this.getAttribute("align") || "center";
      const valign = this.getAttribute("valign") || "top";

      this._shape.setAttribute("d", upright);
      const vb = this._shape.getBBox();
      this._shape.setAttribute("d", d);
      this._outline.setAttribute("d", d);
      this._outline.hidden = !this.hasAttribute("outline");
      this._rot.setAttribute("transform", tRot ? `rotate(${tRot})` : "");
      const bb = this._shape.getBBox();
      if (!bb.width) return;
      const m = 2;
      this._svg.setAttribute("viewBox", `${vb.x - m} ${vb.y - m} ${vb.width + 2*m} ${vb.height + 2*m}`);

      const tokens = this._tokens();
      const inside = (x, y) => {
        const p = this._svg.createSVGPoint(); p.x = x; p.y = y;
        return this._shape.isPointInFill(p);
      };
      // Horizontal span inside the shape at a given y (largest contiguous run), inset by pad.
      const step = Math.max(0.5, bb.width / 400);
      // Chord lookups depend only on the path and padding, so cache them across renders.
      const cacheKey = `${d}|${pad}`;
      if (this._chordKey !== cacheKey) { this._chordKey = cacheKey; this._chordCache = new Map(); }
      const chordCache = this._chordCache;
      const chordAt = (y) => {
        const key = Math.round(y * 2);
        if (chordCache.has(key)) return chordCache.get(key);
        const r = chordScan(y);
        chordCache.set(key, r);
        return r;
      };
      const chordScan = (y) => {
        let best = null, start = null;
        for (let x = bb.x; x <= bb.x + bb.width + step; x += step) {
          const inn = x <= bb.x + bb.width && inside(x, y);
          if (inn && start === null) start = x;
          if (!inn && start !== null) { if (!best || x - start > best[1] - best[0]) best = [start, x - step]; start = null; }
        }
        if (!best) return null;
        const [a, b] = [best[0] + pad, best[1] - pad];
        return b > a ? [a, b] : null;
      };

      const layout = (size, offset = 0) => {
        const lh = size * 1.25, asc = size * 0.8, desc = size * 0.25;
        const font = (t) => `${t.italic ? "italic " : ""}${t.bold ? 700 : 400} ${size}px ${family}`;
        const width = (text, t) => { measureCanvas.font = font(t); return measureCanvas.measureText(text).width; };
        const lines = []; let i = 0;
        for (let base = bb.y + pad + asc + offset; base + desc <= bb.y + bb.height - pad && i < tokens.length; base += lh) {
          const top = chordAt(base - asc), bot = chordAt(base + desc);
          if (!top || !bot) continue;
          const a = Math.max(top[0], bot[0]), b = Math.min(top[1], bot[1]);
          if (b - a < size) continue;
          const line = { base, a, b, words: [], w: 0 };
          while (i < tokens.length) {
            const t = tokens[i];
            if (t.br) { i++; break; }
            const ww = width(t.text, t);
            const sp = line.words.length ? width(" ", t) : 0;
            if (line.words.length && line.w + sp + ww > b - a) break;
            if (!line.words.length && ww > b - a) { line.words.push({ ...t, ww }); line.w = ww; i++; break; }
            line.words.push({ ...t, ww, sp }); line.w += sp + ww; i++;
          }
          if (line.words.length) lines.push(line);
        }
        return { lines, done: i >= tokens.length, size, asc, desc };
      };

      let result = layout(reqSize);
      if (fit === "shrink" && !result.done) {
        let lo = 4, hi = reqSize;
        for (let k = 0; k < 10; k++) {
          const mid = (lo + hi) / 2, r = layout(mid);
          if (r.done) { lo = mid; result = r; } else hi = mid;
        }
        if (!result.done) result = layout(lo);
      }
      if (valign === "middle" && result.done && result.lines.length) {
        // Slide the starting line down until the gaps above and below the text block balance.
        const top = bb.y + pad, bot = bb.y + bb.height - pad;
        // Negative while the block sits high (more room below), positive once it sits low.
        const imbalance = (r) => {
          const first = r.lines[0], last = r.lines[r.lines.length - 1];
          return (first.base - r.asc - top) - (bot - (last.base + r.desc));
        };
        let best = result, bestDiff = Math.abs(imbalance(result));
        const stepY = result.size * 0.6;
        for (let off = stepY; off < bb.height; off += stepY) {
          const r = layout(result.size, off);
          if (!r.done || !r.lines.length) break;
          const im = imbalance(r);
          if (Math.abs(im) < bestDiff) { best = r; bestDiff = Math.abs(im); }
          if (im > 0) break; // block is now below center; the best offset is behind us
        }
        result = best;
      }

      this._lines.replaceChildren();
      for (const L of result.lines) {
        const text = document.createElementNS(NS, "text");
        text.setAttribute("y", L.base.toFixed(2));
        text.setAttribute("font-size", result.size);
        text.setAttribute("font-family", family);
        const avail = L.b - L.a;
        const last = L === result.lines[result.lines.length - 1];
        let x = align === "center" ? L.a + (avail - L.w) / 2 : L.a;
        let extra = 0;
        if (align === "justify" && !last && L.words.length > 1) extra = (avail - L.w) / (L.words.length - 1);
        text.setAttribute("x", x.toFixed(2));
        for (const w of L.words) {
          const ts = document.createElementNS(NS, "tspan");
          if (w.bold) ts.setAttribute("font-weight", "700");
          if (w.italic) ts.setAttribute("font-style", "italic");
          if (w.underline) ts.setAttribute("text-decoration", "underline");
          ts.textContent = (w.sp ? " " : "") + w.text;
          if (extra && w.sp) { ts.setAttribute("dx", extra.toFixed(2)); }
          text.appendChild(ts);
        }
        this._lines.appendChild(text);
      }
      this.toggleAttribute("overflow", !result.done);
    }
  }
  if (!customElements.get("leaf-text")) customElements.define("leaf-text", LeafText);
})();
