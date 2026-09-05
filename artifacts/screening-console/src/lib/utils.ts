import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function cx(...parts: Array<string | false | undefined | null>): string {
  return parts.filter(Boolean).join(' ');
}

export function fmtMs(ms?: number): string {
  return ms == null ? '—' : `${(ms / 1000).toFixed(1)}s`;
}

export function fmtDate(value?: string): string {
  return value
    ? new Date(value).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';
}

export function mask(value?: string): string {
  return value ? `${value.slice(0, 3)}···${value.slice(-3)}` : '—';
}

export function pct(value?: number): string {
  return value == null ? '—' : `${value.toFixed(1)}%`;
}

export function titleCase(value?: string): string {
  return value
    ? value
        .toLowerCase()
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (m) => m.toUpperCase())
    : '—';
}

export function riskClass(score: number): 'score-low' | 'score-medium' | 'score-high' {
  if (score <= 20) return 'score-low';
  if (score <= 50) return 'score-medium';
  return 'score-high';
}

export function riskRingClass(score: number): 'ring-low' | 'ring-medium' | 'ring-high' {
  if (score <= 20) return 'ring-low';
  if (score <= 50) return 'ring-medium';
  return 'ring-high';
}
