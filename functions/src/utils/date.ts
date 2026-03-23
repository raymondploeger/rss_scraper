export function toDate(value: unknown): Date {
  if (!value) {
    return new Date(0);
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }

  return new Date(String(value));
}

export function hoursBetween(left: unknown, right: unknown): number {
  return Math.abs(toDate(left).getTime() - toDate(right).getTime()) / (1000 * 60 * 60);
}

export function subtractDays(days: number): Date {
  const result = new Date();
  result.setDate(result.getDate() - days);
  return result;
}

