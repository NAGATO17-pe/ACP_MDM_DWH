"use client";

import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormDialog } from "@/components/ui/form-dialog";
import { FormField } from "@/components/ui/form-field";
import {
  BackendRol,
  CrearUsuarioInput,
  ROL_LABEL,
  type CrearUsuarioInput as CrearUsuarioInputType,
} from "@/lib/schemas/configuracion";
import { useCreateUser } from "@/hooks/use-configuracion";
import { useToast } from "@/hooks/use-toast";

/**
 * Dialog admin para crear un nuevo usuario.
 * Validación local con Zod via RHF; el FormDialog maneja errores + toast.
 */
export function NuevoUsuarioDialog() {
  const mutation = useCreateUser();
  const { toast } = useToast();

  return (
    <FormDialog<typeof CrearUsuarioInput>
      trigger={
        <Button size="sm" className="gap-1.5">
          <UserPlus aria-hidden className="h-4 w-4" />
          Nuevo usuario
        </Button>
      }
      title="Nuevo usuario"
      description="El usuario podrá iniciar sesión inmediatamente con la contraseña asignada."
      schema={CrearUsuarioInput}
      defaultValues={{
        nombreUsuario: "",
        nombreDisplay: "",
        email: "",
        clave: "",
        rol: "viewer",
      }}
      submitLabel="Crear usuario"
      submittingLabel="Creando…"
      onSubmit={async (values, { close }) => {
        const u = await mutation.mutateAsync(values as CrearUsuarioInputType);
        toast({
          variant: "success",
          title: "Usuario creado",
          description: `${u.nombreDisplay} (${u.nombreUsuario})`,
        });
        close();
      }}
    >
      {(form) => {
        const errors = form.formState.errors;
        return (
          <>
            <FormField
              id="nombreUsuario"
              label="Nombre de usuario"
              required
              error={errors.nombreUsuario?.message}
              help="Sin espacios. Solo letras, números, punto, guión y guión bajo."
            >
              <Input
                autoFocus
                placeholder="juan.perez"
                maxLength={100}
                {...form.register("nombreUsuario")}
              />
            </FormField>

            <FormField
              id="nombreDisplay"
              label="Nombre completo"
              required
              error={errors.nombreDisplay?.message}
            >
              <Input
                placeholder="Juan Pérez"
                maxLength={200}
                {...form.register("nombreDisplay")}
              />
            </FormField>

            <FormField
              id="email"
              label="Correo (opcional)"
              error={errors.email?.message}
            >
              <Input
                type="email"
                placeholder="juan.perez@empresa.pe"
                maxLength={200}
                {...form.register("email")}
              />
            </FormField>

            <FormField
              id="clave"
              label="Contraseña inicial"
              required
              error={errors.clave?.message}
              help="Mínimo 8 caracteres. El usuario podrá cambiarla luego."
            >
              <Input
                type="password"
                maxLength={200}
                {...form.register("clave")}
              />
            </FormField>

            <FormField
              id="rol"
              label="Rol"
              required
              error={errors.rol?.message}
              help="Define qué módulos del portal podrá acceder."
            >
              <select
                className="bg-[var(--color-surface-2)] w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text)] transition focus:border-[var(--color-primary)] focus:outline-none disabled:opacity-60"
                {...form.register("rol")}
              >
                {BackendRol.options.map((r) => (
                  <option key={r} value={r}>
                    {ROL_LABEL[r]}
                  </option>
                ))}
              </select>
            </FormField>
          </>
        );
      }}
    </FormDialog>
  );
}
