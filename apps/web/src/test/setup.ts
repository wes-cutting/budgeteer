import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Unmount React trees between tests so the jsdom DOM doesn't leak across cases.
afterEach(() => {
  cleanup();
});

// jsdom (as of v25) does not implement the Pointer Capture API. Radix's Toast swipe handler calls
// `hasPointerCapture`/`(set|release)PointerCapture` on pointer events, so stub them as no-ops for the
// unit environment (real Chromium provides them — the e2e/axe suite exercises the true behaviour).
if (typeof Element !== "undefined" && !Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
}
