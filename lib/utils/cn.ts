type ClassValue = string | false | null | undefined;

// Kleiner Ersatz für clsx/classnames, um keine neue Abhängigkeit für einen
// simplen String-Join einzuführen — reicht für die Varianten-Zusammensetzung
// in components/ui/*.
export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}
