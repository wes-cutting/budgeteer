import { describe, expect, test } from "vitest";
import { render } from "@testing-library/react";
import { ProgressBar } from "./index";
import styles from "./ProgressBar.module.css";

/** The decorative track + its fill child (the track is the sole aria-hidden node). */
function parts(container: HTMLElement) {
  const track = container.querySelector('[aria-hidden="true"]') as HTMLElement;
  return { track, fill: track.firstElementChild as HTMLElement };
}

describe("ProgressBar (FEAT-UX13)", () => {
  test("is decorative — aria-hidden, no progressbar role (the figure is carried by adjacent text)", () => {
    const { container, queryByRole } = render(<ProgressBar ratio={0.5} />);
    expect(parts(container).track.getAttribute("aria-hidden")).toBe("true");
    expect(queryByRole("progressbar")).toBeNull();
  });

  test("fill width tracks the ratio and clamps to [0, 100]%", () => {
    expect(parts(render(<ProgressBar ratio={0.5} />).container).fill.style.width).toBe("50%");
    expect(parts(render(<ProgressBar ratio={0} />).container).fill.style.width).toBe("0%");
    expect(parts(render(<ProgressBar ratio={-2} />).container).fill.style.width).toBe("0%");
  });

  test("a ratio past 100% forces the over treatment: width clamps to 100% and the hatch SHAPE applies", () => {
    // Even though the caller passed `accent`, exceeding the max forces `over` — so colour is paired
    // with the non-colour hatch shape, never the sole signal.
    const { fill } = parts(render(<ProgressBar ratio={1.4} tone="accent" />).container);
    expect(fill.style.width).toBe("100%");
    expect(fill.className).toContain(styles.over);
  });

  test("tone selects the fill class", () => {
    expect(
      parts(render(<ProgressBar ratio={0.9} tone="caution" />).container).fill.className,
    ).toContain(styles.caution);
    expect(
      parts(render(<ProgressBar ratio={0.4} tone="success" />).container).fill.className,
    ).toContain(styles.success);
  });
});
