const CYRILLIC_TO_LATIN_PLATE: Record<string, string> = {
  А: "A",
  В: "B",
  Е: "E",
  К: "K",
  М: "M",
  Н: "H",
  О: "O",
  Р: "P",
  С: "C",
  Т: "T",
  У: "Y",
  Х: "X",
};

export function normalizeBulgarianPhone(input: string): string {
  let value = input.trim().replace(/[\s().-]/g, "");
  if (value.startsWith("00")) value = `+${value.slice(2)}`;

  if (value.startsWith("+359")) {
    return `+359${value.slice(4).replace(/\D/g, "")}`;
  }

  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("359")) return `+${digits}`;
  if (digits.startsWith("0")) return `+359${digits.slice(1)}`;

  // Fallback for already-local mobile numbers without leading 0.
  if (digits.length === 9) return `+359${digits}`;
  return value.startsWith("+") ? `+${digits}` : digits;
}

export function normalizeRegistrationNumber(input: string): string {
  const upper = input.trim().toUpperCase();
  const transliterated = [...upper]
    .map((char) => CYRILLIC_TO_LATIN_PLATE[char] ?? char)
    .join("");
  return transliterated.replace(/[^A-Z0-9]/g, "");
}

export function normalizePolicyNumber(input: string): string {
  return input.trim().toUpperCase().replace(/[\s-]/g, "");
}
