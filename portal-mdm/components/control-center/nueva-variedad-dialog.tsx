"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormDialog } from "@/components/ui/form-dialog";
import { FormField } from "@/components/ui/form-field";
import {
  CrearVariedadInput,
  type CrearVariedadInput as CrearVariedadInputType,
} from "@/lib/schemas/catalogos";
import { useCrearVariedad } from "@/hooks/use-catalogos";
import { useToast } from "@/hooks/use-toast";

/**
 * Dialog para crear una variedad en `Silver.Dim_Variedad`.
 * Visible solo para admin.
 */
export function NuevaVariedadDialog() {
  const mutation = useCrearVariedad();
  const { toast } = useToast();

  return (
    <FormDialog<typeof CrearVariedadInput>
      trigger={
        <Button className="gap-1.5">
          <Plus aria-hidden className="h-4 w-4" />
          Nueva variedad
        </Button>
      }
      title="Nueva variedad"
      description={
        <>
          Se creará activa en{" "}
          <span className="font-mono">Silver.Dim_Variedad</span>.
        </>
      }
      schema={CrearVariedadInput}
      defaultValues={{ nombreVariedad: "", breeder: "" }}
      submitLabel="Crear variedad"
      submittingLabel="Creando…"
      onSubmit={async (values, { close }) => {
        const res = await mutation.mutateAsync(values as CrearVariedadInputType);
        toast({
          variant: "success",
          title: "Variedad creada",
          description: res.mensaje,
        });
        close();
      }}
    >
      {(form) => (
        <>
          <FormField
            id="nombreVariedad"
            label="Nombre de la variedad"
            required
            error={form.formState.errors.nombreVariedad?.message}
            help="Texto único — debe coincidir con el nombre oficial de la variedad."
          >
            <Input
              autoFocus
              placeholder="Ej. Sweet Sapphire"
              maxLength={150}
              {...form.register("nombreVariedad")}
            />
          </FormField>

          <FormField
            id="breeder"
            label="Breeder (opcional)"
            error={form.formState.errors.breeder?.message}
            help="Quién la desarrolló o tiene la propiedad intelectual."
          >
            <Input
              placeholder="Casa propietaria, ej. Sun World"
              maxLength={100}
              {...form.register("breeder")}
            />
          </FormField>
        </>
      )}
    </FormDialog>
  );
}
