// Stable equality for request payloads read back from PostgreSQL JSONB.
export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const data = value as Record<string, unknown>;
    return `{${Object.keys(data)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(data[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
