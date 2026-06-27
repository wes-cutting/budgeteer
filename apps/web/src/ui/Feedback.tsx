import { type HTMLAttributes, type ReactNode } from "react";
import styles from "./Feedback.module.css";

/** Inline error / important message (FEAT-UX4). `role="alert"`; conveyed by text, not color. */
export function Alert({ className, children, ...rest }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p role="alert" className={[styles.alert, className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </p>
  );
}

/** First-run / no-data state (FEAT-UX4) — a title plus an optional next action. */
export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className={styles.empty}>
      <p className={styles.emptyTitle}>{title}</p>
      {children}
    </div>
  );
}

/** Loading placeholder (FEAT-UX4). Bars are decorative (`aria-hidden`); a polite status
 *  announces "Loading…" to assistive tech. */
export function Skeleton({ label = "Loading…", rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div className={styles.skeletonWrap}>
      <span className="sr-only" role="status">
        {label}
      </span>
      {Array.from({ length: rows }).map((_, i) => (
        <span key={i} aria-hidden="true" className={styles.skeletonBar} />
      ))}
    </div>
  );
}
