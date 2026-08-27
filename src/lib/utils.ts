import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  if (value >= 10000) return `${(value / 10000).toFixed(2)}万`
  return value.toFixed(2)
}

export function formatNumber(value: number): string {
  return value.toLocaleString("zh-CN")
}
