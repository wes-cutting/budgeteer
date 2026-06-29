import { jsxs as a, jsx as t } from "react/jsx-runtime";
import { useState as D, useId as L } from "react";
const O = "_figure_zugbe_1", H = "_caption_zugbe_10", I = "_svg_zugbe_17", W = "_grid_zugbe_23", q = "_zero_zugbe_28", E = "_axis_zugbe_33", F = "_serieslabel_zugbe_38", R = "_toggle_zugbe_43", T = "_table_zugbe_63", U = "_num_zugbe_81", B = "_srOnly_zugbe_86", n = {
  figure: O,
  caption: H,
  svg: I,
  grid: W,
  zero: q,
  axis: E,
  serieslabel: F,
  toggle: R,
  table: T,
  num: U,
  srOnly: B
}, v = [
  { key: "assetsCents", label: "Assets", token: "var(--chart-1)", dash: "0", marker: "circle" },
  {
    key: "liabilitiesCents",
    label: "Liabilities",
    token: "var(--chart-2)",
    dash: "6 4",
    marker: "square"
  },
  { key: "netCents", label: "Net worth", token: "var(--chart-3)", dash: "2 3", marker: "triangle" }
], l = (s) => (s < 0 ? "-" : "") + "$" + Math.abs(s / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), y = (s) => {
  const [o, r] = s.split("-");
  return new Date(Number(o), Number(r) - 1, 1).toLocaleString("en-US", { month: "short" });
};
function V({ kind: s, cx: o, cy: r, fill: g }) {
  return s === "square" ? /* @__PURE__ */ t("rect", { x: o - 4, y: r - 4, width: 8, height: 8, fill: g }) : s === "triangle" ? /* @__PURE__ */ t("polygon", { points: `${o},${r - 5} ${o + 5},${r + 4} ${o - 5},${r + 4}`, fill: g }) : /* @__PURE__ */ t("circle", { cx: o, cy: r, r: 4.5, fill: g });
}
function J({ data: s, title: o }) {
  const [r, g] = D(!0), x = L(), d = 640, p = 320, i = { top: 16, right: 96, bottom: 36, left: 64 }, f = d - i.left - i.right, k = p - i.top - i.bottom, N = s.flatMap((e) => [e.assetsCents, e.liabilitiesCents, e.netCents]), u = Math.min(0, ...N), $ = Math.max(0, ...N), _ = (e) => i.left + (s.length === 1 ? f / 2 : f * e / (s.length - 1)), c = (e) => i.top + k - k * (e - u) / ($ - u || 1), w = Array.from({ length: 5 }, (e, m) => u + ($ - u) * m / 4), b = s[0], h = s[s.length - 1], M = b && h ? `Net worth over ${s.length} months, ${y(b.period)} to ${y(h.period)}: assets ${l(b.assetsCents)} to ${l(h.assetsCents)}, liabilities ${l(b.liabilitiesCents)} to ${l(h.liabilitiesCents)}, net worth ${l(b.netCents)} to ${l(h.netCents)}.` : "No data.";
  return /* @__PURE__ */ a("figure", { className: n.figure, children: [
    /* @__PURE__ */ t("figcaption", { className: n.caption, children: o }),
    /* @__PURE__ */ t(
      "svg",
      {
        className: n.svg,
        viewBox: `0 0 ${d} ${p}`,
        role: "img",
        "aria-label": M,
        preserveAspectRatio: "xMidYMid meet",
        children: /* @__PURE__ */ a("g", { "aria-hidden": "true", children: [
          w.map((e, m) => /* @__PURE__ */ a("g", { children: [
            /* @__PURE__ */ t("line", { x1: i.left, x2: d - i.right, y1: c(e), y2: c(e), className: n.grid }),
            /* @__PURE__ */ t("text", { x: i.left - 8, y: c(e) + 4, className: n.axis, textAnchor: "end", children: l(e) })
          ] }, m)),
          /* @__PURE__ */ t("line", { x1: i.left, x2: d - i.right, y1: c(0), y2: c(0), className: n.zero }),
          s.map((e, m) => /* @__PURE__ */ t("text", { x: _(m), y: p - i.bottom + 20, className: n.axis, textAnchor: "middle", children: y(e.period) }, e.period)),
          v.map((e) => {
            const m = s.map((A, j) => `${_(j)},${c(A[e.key])}`).join(" "), S = h ? h[e.key] : 0, C = _(s.length - 1), z = c(S);
            return /* @__PURE__ */ a("g", { children: [
              /* @__PURE__ */ t(
                "polyline",
                {
                  points: m,
                  fill: "none",
                  stroke: e.token,
                  strokeWidth: 2.5,
                  strokeDasharray: e.dash,
                  strokeLinejoin: "round"
                }
              ),
              /* @__PURE__ */ t(V, { kind: e.marker, cx: C, cy: z, fill: e.token }),
              /* @__PURE__ */ t("text", { x: C + 10, y: z + 4, className: n.serieslabel, fill: e.token, children: e.label })
            ] }, e.key);
          })
        ] })
      }
    ),
    /* @__PURE__ */ t(
      "button",
      {
        type: "button",
        className: n.toggle,
        "aria-expanded": r,
        "aria-controls": x,
        onClick: () => g((e) => !e),
        children: r ? "Hide data table" : "Show data table"
      }
    ),
    /* @__PURE__ */ t("div", { id: x, hidden: !r, children: /* @__PURE__ */ a("table", { className: n.table, children: [
      /* @__PURE__ */ a("caption", { className: n.srOnly, children: [
        o,
        " — figures"
      ] }),
      /* @__PURE__ */ t("thead", { children: /* @__PURE__ */ a("tr", { children: [
        /* @__PURE__ */ t("th", { scope: "col", children: "Month" }),
        v.map((e) => /* @__PURE__ */ t("th", { scope: "col", className: n.num, children: e.label }, e.key))
      ] }) }),
      /* @__PURE__ */ t("tbody", { children: s.map((e) => /* @__PURE__ */ a("tr", { children: [
        /* @__PURE__ */ t("th", { scope: "row", children: e.period }),
        /* @__PURE__ */ t("td", { className: n.num, children: l(e.assetsCents) }),
        /* @__PURE__ */ t("td", { className: n.num, children: l(e.liabilitiesCents) }),
        /* @__PURE__ */ t("td", { className: n.num, children: l(e.netCents) })
      ] }, e.period)) })
    ] }) })
  ] });
}
export {
  J as AccessibleChart
};
