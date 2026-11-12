import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...classi: ClassValue[]): string {
  return twMerge(clsx(classi))
}
