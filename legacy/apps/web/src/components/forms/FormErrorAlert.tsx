import styles from "./FormErrorAlert.module.css";

export type FormErrorAlertProps = {
  message: string | null | undefined;
};

/** Inline mutation/API failure message (design tokens, RTL-safe margins). */
export function FormErrorAlert({ message }: FormErrorAlertProps) {
  if (message == null) {
    return null;
  }
  return (
    <div className={styles.root} role="alert">
      {message}
    </div>
  );
}
