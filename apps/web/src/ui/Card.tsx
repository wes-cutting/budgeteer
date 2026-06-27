import { type HTMLAttributes } from "react";
import styles from "./Card.module.css";

/** Surface container (FEAT-UX4) — groups a region (e.g. the register's filter + list). */
export function Card({ className, ...rest }: HTMLAttributes<HTMLElement>) {
  return <section className={[styles.card, className].filter(Boolean).join(" ")} {...rest} />;
}
