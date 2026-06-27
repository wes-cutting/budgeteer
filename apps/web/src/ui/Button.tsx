import { type ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

type Variant = "default" | "accent" | "danger" | "ghost";

/**
 * Styled `<button>` (FEAT-UX4). A thin wrapper: forwards every native button prop (so
 * `aria-label`, `onClick`, `disabled`, `type` pass straight through and existing test
 * selectors keep working) and adds a token-styled variant. Defaults to `type="button"`.
 */
export function Button({
  variant = "default",
  className,
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const cls = [styles.btn, styles[variant], className].filter(Boolean).join(" ");
  return <button type={type} className={cls} {...rest} />;
}
