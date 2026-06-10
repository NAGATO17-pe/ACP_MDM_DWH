"use client";

import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/ui/form-dialog";
import { FormField, PasswordInput } from "@/components/ui/form-field";
import { CambiarClaveInput } from "@/lib/schemas/configuracion";
import { useChangePassword } from "@/hooks/use-configuracion";
import { useToast } from "@/hooks/use-toast";

/**
 * Cambia la contraseña del usuario actual.
 * Validación Zod: mínimo 8 chars, confirmar coincide, distinta a la actual.
 */
export function CambiarClaveDialog() {
  const mutation = useChangePassword();
  const { toast } = useToast();

  return (
    <FormDialog<typeof CambiarClaveInput>
      trigger={
        <Button variant="outline" size="sm" className="gap-1.5">
          <KeyRound aria-hidden className="h-4 w-4" />
          Cambiar contraseña
        </Button>
      }
      title="Cambiar contraseña"
      description="Mínimo 8 caracteres. La sesión actual no se cerrará."
      schema={CambiarClaveInput}
      defaultValues={{
        claveActual: "",
        claveNueva: "",
        claveConfirmar: "",
      }}
      submitLabel="Cambiar contraseña"
      submittingLabel="Cambiando…"
      onSubmit={async (values, { close }) => {
        const res = await mutation.mutateAsync({
          claveActual: values.claveActual,
          claveNueva: values.claveNueva,
        });
        toast({ variant: "success", title: res.mensaje });
        close();
      }}
    >
      {(form) => {
        const errors = form.formState.errors;
        return (
          <>
            <FormField
              id="claveActual"
              label="Contraseña actual"
              error={errors.claveActual?.message}
            >
              <PasswordInput autoFocus {...form.register("claveActual")} />
            </FormField>

            <FormField
              id="claveNueva"
              label="Nueva contraseña"
              error={errors.claveNueva?.message}
            >
              <PasswordInput {...form.register("claveNueva")} />
            </FormField>

            <FormField
              id="claveConfirmar"
              label="Confirmar nueva contraseña"
              error={errors.claveConfirmar?.message}
            >
              <PasswordInput {...form.register("claveConfirmar")} />
            </FormField>
          </>
        );
      }}
    </FormDialog>
  );
}
