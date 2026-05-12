import { Check } from "lucide-react";

export interface StepperStep {
  key: string;
  label: string;
}

interface StepperProps {
  steps: readonly StepperStep[];
  /** Index of the current step (0-based). */
  currentIndex: number;
  /** When true, treats `currentIndex` as completed too (e.g. status === aprobado). */
  currentIsDone?: boolean;
  /** Optional aria-label for the underlying ordered list. */
  ariaLabel?: string;
}

/**
 * Horizontal step indicator (Pendiente → En revisión → Decisión).
 * Used by workflows; reusable for any sequential pipeline visualization.
 */
export function Stepper({
  steps,
  currentIndex,
  currentIsDone = false,
  ariaLabel = "Progreso",
}: StepperProps) {
  return (
    <ol className="flex items-center gap-3" aria-label={ariaLabel}>
      {steps.map((step, i) => {
        const done = i < currentIndex || (i === currentIndex && currentIsDone);
        const current = i === currentIndex;
        return (
          <li key={step.key} className="flex items-center gap-2">
            <span
              aria-hidden
              className={
                done
                  ? "bg-[var(--color-success)] text-white inline-flex h-6 w-6 items-center justify-center rounded-full text-xs"
                  : current
                    ? "bg-[var(--color-primary)] text-white inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ring-2 ring-[var(--color-primary)]/30"
                    : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] inline-flex h-6 w-6 items-center justify-center rounded-full text-xs"
              }
            >
              {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span
              className={
                done || current
                  ? "text-xs font-medium"
                  : "text-xs text-[var(--color-text-muted)]"
              }
            >
              {step.label}
            </span>
            {i < steps.length - 1 && (
              <span
                aria-hidden
                className={
                  done
                    ? "bg-[var(--color-success)] h-px w-8"
                    : "bg-[var(--color-border)] h-px w-8"
                }
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
