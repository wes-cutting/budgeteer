import { type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import styles from "./Field.module.css";

/** Labelled form field (FEAT-UX4). Renders a `<label htmlFor>` tied to the control passed as
 *  children — preserves the explicit label association the e2e/unit tests rely on. */
export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint ? <span className={styles.hint}>{hint}</span> : null}
    </div>
  );
}

/** Styled `<input>` — thin wrapper, forwards every native prop (id, type, value, aria-*). */
export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={[styles.control, className].filter(Boolean).join(" ")} {...rest} />;
}

/** Styled `<select>` — thin wrapper, forwards every native prop. */
export function Select({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={[styles.control, className].filter(Boolean).join(" ")} {...rest} />;
}
