import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMontant(montant: number, devise = "USD"): string {
  if (montant >= 1_000_000_000)
    return `${(montant / 1_000_000_000).toFixed(1)} Md ${devise}`;
  if (montant >= 1_000_000)
    return `${(montant / 1_000_000).toFixed(1)} M ${devise}`;
  if (montant >= 1_000)
    return `${(montant / 1_000).toFixed(1)} K ${devise}`;
  return `${montant} ${devise}`;
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  }).format(new Date(date));
}
