import { type HTMLAttributes } from "react";
import styles from "./Badge.module.css";

type Tone = "neutral" | "success" | "warning" | "danger";

/**
 * Status pill (FEAT-UX4). Tone changes color **and** the caller always supplies text — color
 * is never the sole signal (WCAG 1.4.1). Used for the register's allocation status.
 */
export function Badge({
  tone = "neutral",
  className,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  const cls = [styles.badge, styles[tone], className].filter(Boolean).join(" ");
  return <span className={cls} {...rest} />;
}
