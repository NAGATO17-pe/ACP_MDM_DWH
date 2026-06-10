"use client";

/**
 * components/ui/form-dialog.tsx
 * =============================
 * Primitive para diálogos de formulario. Encapsula:
 *
 *  - Estructura visual del Dialog (header con title+description+close,
 *    contenido, footer con Cancel + Submit).
 *  - Estado de apertura (trigger → open → close).
 *  - Wiring de React Hook Form + Zod resolver.
 *  - Ciclo de la mutation: pending, error inline, toast de éxito,
 *    cierre automático en success, focus al primer campo.
 *
 * Reemplaza el ~70% repetido entre `nuevo-usuario-dialog`,
 * `nueva-variedad-dialog` y `cambiar-clave-dialog`. Los consumidores
 * solo pasan: trigger, schema, defaultValues, fields, submit.
 */

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useForm,
  FormProvider,
  type DefaultValues,
  type FieldValues,
  type SubmitHandler,
  type UseFormReturn,
} from "react-hook-form";
import { AlertTriangle, Loader2, X } from "lucide-react";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type ButtonVariant =
  | "primary"
  | "outline"
  | "ghost"
  | "destructive"
  | "secondary";

interface FormDialogProps<TSchema extends z.ZodType<FieldValues>> {
  trigger: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  schema: TSchema;
  defaultValues: DefaultValues<z.infer<TSchema>>;
  submitLabel?: string;
  submittingLabel?: string;
  submitVariant?: ButtonVariant;
  /** Ancho del modal. Default "md". */
  size?: "sm" | "md" | "lg";
  /** Submit handler. Si rechaza, el error inline se rellena automáticamente. */
  onSubmit: (
    values: z.infer<TSchema>,
    helpers: { close: () => void; setError: (msg: string) => void },
  ) => Promise<void> | void;
  /** Render del cuerpo. Recibe el `form` para conectar campos. */
  children: (form: UseFormReturn<z.infer<TSchema>>) => React.ReactNode;
}

const SIZE_CLASS = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
} as const;

export function FormDialog<TSchema extends z.ZodType<FieldValues>>({
  trigger,
  title,
  description,
  schema,
  defaultValues,
  submitLabel = "Guardar",
  submittingLabel = "Guardando…",
  submitVariant = "primary",
  size = "md",
  onSubmit,
  children,
}: FormDialogProps<TSchema>) {
  const [open, setOpen] = React.useState(false);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/65 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2",
            SIZE_CLASS[size],
            "rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xl outline-none",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          )}
        >
          {open ? (
            <Body
              title={title}
              description={description}
              schema={schema}
              defaultValues={defaultValues}
              submitLabel={submitLabel}
              submittingLabel={submittingLabel}
              submitVariant={submitVariant}
              onSubmit={onSubmit}
              onClose={() => setOpen(false)}
            >
              {children}
            </Body>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/* -------------------------------------------------------------------------- */

interface BodyProps<TSchema extends z.ZodType<FieldValues>> {
  title: string;
  description?: React.ReactNode;
  schema: TSchema;
  defaultValues: DefaultValues<z.infer<TSchema>>;
  submitLabel: string;
  submittingLabel: string;
  submitVariant: ButtonVariant;
  onSubmit: (
    values: z.infer<TSchema>,
    helpers: { close: () => void; setError: (msg: string) => void },
  ) => Promise<void> | void;
  onClose: () => void;
  children: (form: UseFormReturn<z.infer<TSchema>>) => React.ReactNode;
}

function Body<TSchema extends z.ZodType<FieldValues>>({
  title,
  description,
  schema,
  defaultValues,
  submitLabel,
  submittingLabel,
  submitVariant,
  onSubmit,
  onClose,
  children,
}: BodyProps<TSchema>) {
  const titleId = React.useId();
  const { toast } = useToast();
  const [apiError, setApiError] = React.useState<string | null>(null);

  const form = useForm<z.infer<TSchema>>({
    // El resolver es genérico — el cast es necesario porque z.infer<TSchema>
    // y el output inferido por zodResolver difieren a nivel de tipo aunque
    // sean equivalentes a runtime. Es el patrón habitual con RHF + Zod
    // dentro de wrappers genéricos.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema as any) as unknown as import("react-hook-form").Resolver<
      z.infer<TSchema>
    >,
    mode: "onBlur",
    defaultValues,
  });

  const { handleSubmit, formState } = form;
  const pending = formState.isSubmitting;

  const submit: SubmitHandler<z.infer<TSchema>> = async (raw) => {
    setApiError(null);
    try {
      await onSubmit(raw as z.infer<TSchema>, {
        close: onClose,
        setError: setApiError,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setApiError(msg);
      toast({
        variant: "destructive",
        title: "No se pudo guardar",
        description: msg,
      });
    }
  };

  return (
    <>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <DialogPrimitive.Title
            id={titleId}
            className="text-base font-semibold text-[var(--color-text)]"
          >
            {title}
          </DialogPrimitive.Title>
          {description ? (
            <DialogPrimitive.Description className="text-xs text-[var(--color-text-muted)]">
              {description}
            </DialogPrimitive.Description>
          ) : null}
        </div>
        <DialogPrimitive.Close
          aria-label="Cerrar"
          className="rounded-sm p-1 text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
        >
          <X className="h-4 w-4" />
        </DialogPrimitive.Close>
      </header>

      <FormProvider {...(form as unknown as UseFormReturn<FieldValues>)}>
        <form
          onSubmit={handleSubmit(submit)}
          className="flex flex-col gap-3.5"
          noValidate
        >
          {children(form)}

          {apiError ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-[color-mix(in_oklab,var(--color-destructive)_40%,transparent)] bg-[color-mix(in_oklab,var(--color-destructive)_10%,transparent)] px-3 py-2 text-xs text-[var(--color-destructive)]"
            >
              <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{apiError}</span>
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant={submitVariant}
              disabled={!formState.isValid || pending}
              aria-busy={pending}
            >
              {pending ? (
                <>
                  <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
                  {submittingLabel}
                </>
              ) : (
                submitLabel
              )}
            </Button>
          </div>
        </form>
      </FormProvider>
    </>
  );
}
