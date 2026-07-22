// Daily EUR->RSD exchange rate, used only to DISPLAY competitor/own-price figures in euros —
// nothing is ever stored in this currency, prices remain RSD in the database throughout.

const RSD_PER_EUR = 117.4; // fallback used if the live rate can't be fetched
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // once per day

let cachedRate: number | null = null;
let cachedAt = 0;

export async function getEurRsdRate(): Promise<number> {
  const now = Date.now();
  if (cachedRate !== null && now - cachedAt < CACHE_TTL_MS) {
    return cachedRate;
  }

  try {
    const res = await fetch("https://open.er-api.com/v6/latest/EUR", {
      next: { revalidate: 86400 },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json() as { rates?: { RSD?: number } };
    const rate = json.rates?.RSD;
    cachedRate = typeof rate === "number" && rate > 0 ? rate : RSD_PER_EUR;
  } catch {
    cachedRate = RSD_PER_EUR;
  }

  cachedAt = now;
  return cachedRate;
}

export function formatEur(rsd: number, rate: number): string {
  return `${Math.round(rsd / rate)} €`;
}
