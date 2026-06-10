"use client";

/**
 * components/ui/form-field.tsx
 * =============================
 * Wrapper accesible para un control de formulario: Label, control,
 * mensaje de error/ayuda. Single source para layout y aria wiring.
 *
 * Convive con `<FormDialog>` pero NO depende de él — se puede usar en
 * cualquier formulario del portal.
 */

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  help?: string;
  /** El control (Input, select, textarea, etc.). Se le pasan id y aria. */
  children: React.ReactElement;
  className?: string;
}

export function FormField({
  id,
  label,
  required,
  error,
  help,
  children,
  className,
}: FormFieldProps) {
  const helpId = help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = error ? errorId : helpId;

  // Inyecta id + aria-invalid + aria-describedby al child sin obligar
  // al consumidor a pasarlos a mano.
  const control = React.cloneElement(children, {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
  } as React.HTMLAttributes<HTMLElement>);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required ? (
          <span aria-hidden className="ml-1 text-[var(--color-destructive)]">
            *
          </span>
        ) : null}
      </Label>
      {control}
      {error ? (
        <p
          id={errorId}
          className="text-xs text-[var(--color-destructive)]"
          role="alert"
        >
          {error}
        </p>
      ) : help ? (
        <p id={helpId} className="text-xs text-[var(--color-text-muted)]">
          {help}
        </p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Variantes especializadas                                                   */
/* -------------------------------------------------------------------------- */

type PasswordInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">;

/**
 * Input de contraseña con toggle visibilidad. No maneja label/error —
 * úsalo dentro de `<FormField>`.
 */
export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ className, ...props }, ref) {
    const [visible, setVisible] = React.useState(false);
    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? "text" : "password"}
          className={cn("pr-10", className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-[var(--color-text-muted)] transition hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
        >
          {visible ? (
            <EyeOff aria-hidden className="h-4 w-4" />
          ) : (
            <Eye aria-hidden className="h-4 w-4" />
          )}
        </button>
      </div>
    );
  },
);
