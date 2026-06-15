/** Format a money amount with a currency symbol, e.g. `euro(0.1)` → "€0.10". */
export function euro(amount: number, currency = "EUR"): string {
  const symbol = currency === "EUR" ? "€" : `${currency} `;
  return `${symbol}${amount.toFixed(2)}`;
}

/** Wrap a string as an MCP text tool result. */
export function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}
