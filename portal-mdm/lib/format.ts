const dateFmt = new Intl.DateTimeFormat("es-PE", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const dateTimeFmt = new Intl.DateTimeFormat("es-PE", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const numberFmt = new Intl.NumberFormat("es-PE");

export function formatDate(iso: string): string {
  try {
    return dateFmt.format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatDateTime(iso: string): string {
  try {
    return dateTimeFmt.format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatNumber(n: number): string {
  return numberFmt.format(n);
}

export function formatPercent(n: number, fractionDigits = 1): string {
  return `${n.toFixed(fractionDigits)}%`;
}
