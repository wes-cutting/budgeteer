# SPIKE-06 — design-system + routing bake-off (THROWAWAY)

Disposable harness for [`docs/spikes/06-design-system-routing.md`](../../docs/spikes/06-design-system-routing.md).
**Not the V1 app.** Deps are gitignored; discard this whole folder once findings are absorbed
into `ADR-0005`/`ADR-0006`.

It rebuilds a representative **Account Register** (table + add-form + filter + delete + an
allocation-editor **Dialog**) to bake off three axes on real rendered output:

- **Routing:** React Router vs TanStack Router
- **Styling:** CSS custom-property tokens + CSS Modules vs Tailwind
- **A11y primitives:** React Aria Components vs Radix Primitives (the Dialog)

## Commands

```
npm install
npm run typecheck
npm run build:lead      # React Router + tokens/CSS-Modules + React Aria
npm run measure         # gzipped JS size per built variant
npm run axe             # jsdom + axe-core scan of the Dialog variants
```
