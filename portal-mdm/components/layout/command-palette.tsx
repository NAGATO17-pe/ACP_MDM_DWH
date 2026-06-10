"use client";

import { Command } from "cmdk";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  LogOut,
  Monitor,
  Moon,
  PlayCircle,
  RefreshCw,
  Search,
  Sparkles,
  Squirrel,
  StretchHorizontal,
  Zap,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { usePreferencias } from "@/components/providers/preferencias-provider";
import { useToast } from "@/hooks/use-toast";
import type { NavGroup } from "@/components/layout/role-shell";

/**
 * Paleta de comandos (⌘K / Ctrl+K).
 *
 * Construida sobre `cmdk` (Radix-style headless) + Radix Dialog para el
 * overlay/portal. Sigue las reglas del portal:
 *   - tokens semánticos (cero hex inline)
 *   - focus rings visibles, touch targets ≥44px
 *   - cero emojis, solo `lucide-react`
 *   - `prefers-reduced-motion`: cmdk no anima por defecto, Dialog usa
 *     clases `data-[state=*]:animate-in/out` que Tailwind respeta.
 *
 * Secciones:
 *   1. Navegación — items derivados del `navGroups` del shell del rol
 *   2. Preferencias — atajos a densidad/tema (sin abrir /configuracion)
 *   3. Sesión — cerrar sesión
 *
 * Atajos: ⌘K, Ctrl+K. Tecla "/" si el foco no está en input.
 */
export function CommandPalette({ navGroups }: { navGroups: NavGroup[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { densidad, tema, setDensidad, setTema } = usePreferencias();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMetaK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (isMetaK) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === "/" && !open) {
        const t = e.target as HTMLElement | null;
        const tag = t?.tagName;
        const isEditable =
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          (t?.isContentEditable ?? false);
        if (!isEditable) {
          e.preventDefault();
          setOpen(true);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function runAndClose(fn: () => void) {
    setOpen(false);
    // microtask para que el dialog termine de cerrar antes de navegar
    queueMicrotask(fn);
  }

  function navegarA(href: string, label: string) {
    runAndClose(() => {
      router.push(href);
      toast({
        title: "Navegando",
        description: label,
        duration: 1800,
      });
    });
  }

  function aplicarDensidad(d: "compacta" | "comoda") {
    runAndClose(() => {
      setDensidad(d);
      toast({
        variant: "success",
        title: "Densidad actualizada",
        description: d === "compacta" ? "Tablas compactas" : "Tablas cómodas",
        duration: 1800,
      });
    });
  }

  function aplicarTema(t: "oscuro" | "sistema") {
    runAndClose(() => {
      setTema(t);
      toast({
        variant: "success",
        title: "Tema actualizado",
        description: t === "oscuro" ? "Tema oscuro" : "Seguir al sistema",
        duration: 1800,
      });
    });
  }

  function refrescarTodo() {
    runAndClose(() => {
      queryClient.invalidateQueries({ queryKey: ["cc"] });
      toast({
        variant: "success",
        title: "Datos actualizados",
        description: "Todas las queries del Control Center se refrescarán.",
        duration: 2000,
      });
    });
  }

  function cerrarSesion() {
    runAndClose(() => {
      const form = document.createElement("form");
      form.method = "post";
      form.action = "/api/auth/logout";
      document.body.appendChild(form);
      form.submit();
    });
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          )}
        />
        <DialogPrimitive.Content
          aria-label="Paleta de comandos"
          className={cn(
            "fixed left-1/2 top-[20%] z-[61] w-[min(640px,calc(100vw-2rem))] -translate-x-1/2",
            "overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl outline-none",
            "data-[state=open]:animate-in data-[state=open]:zoom-in-95 data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=closed]:fade-out-0",
          )}
        >
          <DialogPrimitive.Title className="sr-only">
            Paleta de comandos
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Busca páginas, cambia preferencias o cierra sesión.
          </DialogPrimitive.Description>

          <Command
            label="Paleta de comandos"
            className="flex flex-col"
            // cmdk hace fuzzy match por defecto; queremos un orden estable
            shouldFilter={true}
          >
            <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-3.5">
              <Search
                aria-hidden
                className="h-4 w-4 text-[var(--color-text-muted)]"
              />
              <Command.Input
                autoFocus
                placeholder="Buscar páginas, ajustes o acciones…"
                className={cn(
                  "h-12 w-full bg-transparent text-sm text-[var(--color-text)] outline-none",
                  "placeholder:text-[var(--color-text-muted)]",
                )}
              />
              <kbd className="hidden rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-text-muted)] sm:inline">
                Esc
              </kbd>
            </div>

            <Command.List
              className={cn(
                "max-h-[420px] overflow-y-auto p-1.5",
                "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2",
                "[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold",
                "[&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.12em]",
                "[&_[cmdk-group-heading]]:text-[var(--color-text-muted)]",
              )}
            >
              <Command.Empty className="py-8 text-center text-sm text-[var(--color-text-muted)]">
                Sin resultados
              </Command.Empty>

              {navGroups.map((group, gi) => (
                <Command.Group
                  key={group.title ?? `nav-${gi}`}
                  heading={group.title ?? "Navegación"}
                >
                  {group.items.map((item) => (
                    <PaletteItem
                      key={item.href}
                      value={`nav ${item.label} ${item.href}`}
                      icon={item.icon}
                      label={item.label}
                      hint={item.href}
                      onSelect={() => navegarA(item.href, item.label)}
                      trailing={
                        <ArrowRight
                          aria-hidden
                          className="h-3.5 w-3.5 text-[var(--color-text-muted)]"
                        />
                      }
                    />
                  ))}
                </Command.Group>
              ))}

              <Command.Group heading="Acciones rápidas">
                <PaletteItem
                  value="accion lanzar corrida etl ejecutar pipeline"
                  icon={<PlayCircle aria-hidden className="h-4 w-4 text-[var(--color-success)]" />}
                  label="Lanzar nueva corrida ETL"
                  hint="/etl-monitor/lanzar"
                  onSelect={() => navegarA("/etl-monitor/lanzar", "Lanzar corrida ETL")}
                  trailing={<ArrowRight aria-hidden className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />}
                />
                <PaletteItem
                  value="accion alertas criticas incidencias pendientes"
                  icon={<Zap aria-hidden className="h-4 w-4 text-[var(--color-destructive)]" />}
                  label="Ver alertas críticas"
                  hint="/alerts"
                  onSelect={() => navegarA("/alerts", "Alertas")}
                  trailing={<ArrowRight aria-hidden className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />}
                />
                <PaletteItem
                  value="accion refrescar actualizar datos dashboard todo"
                  icon={<RefreshCw aria-hidden className="h-4 w-4 text-[var(--color-text-muted)]" />}
                  label="Refrescar todo"
                  hint="Invalida todas las queries"
                  onSelect={refrescarTodo}
                />
              </Command.Group>

              <Command.Group heading="Preferencias">
                <PaletteItem
                  value="preferencias densidad comoda comodo tabla espaciado"
                  icon={
                    <StretchHorizontal
                      aria-hidden
                      className="h-4 w-4 text-[var(--color-text-muted)]"
                    />
                  }
                  label="Tablas cómodas"
                  hint={densidad === "comoda" ? "Actual" : "Aplicar"}
                  onSelect={() => aplicarDensidad("comoda")}
                />
                <PaletteItem
                  value="preferencias densidad compacta tabla espaciado"
                  icon={
                    <Squirrel
                      aria-hidden
                      className="h-4 w-4 text-[var(--color-text-muted)]"
                    />
                  }
                  label="Tablas compactas"
                  hint={densidad === "compacta" ? "Actual" : "Aplicar"}
                  onSelect={() => aplicarDensidad("compacta")}
                />
                <PaletteItem
                  value="preferencias tema oscuro dark"
                  icon={
                    <Moon
                      aria-hidden
                      className="h-4 w-4 text-[var(--color-text-muted)]"
                    />
                  }
                  label="Tema oscuro"
                  hint={tema === "oscuro" ? "Actual" : "Aplicar"}
                  onSelect={() => aplicarTema("oscuro")}
                />
                <PaletteItem
                  value="preferencias tema sistema auto"
                  icon={
                    <Monitor
                      aria-hidden
                      className="h-4 w-4 text-[var(--color-text-muted)]"
                    />
                  }
                  label="Seguir tema del sistema"
                  hint={tema === "sistema" ? "Actual" : "Aplicar"}
                  onSelect={() => aplicarTema("sistema")}
                />
                <PaletteItem
                  value="preferencias configuracion ajustes"
                  icon={
                    <Sparkles
                      aria-hidden
                      className="h-4 w-4 text-[var(--color-text-muted)]"
                    />
                  }
                  label="Abrir Configuración"
                  hint="/configuracion"
                  onSelect={() => navegarA("/configuracion", "Configuración")}
                />
              </Command.Group>

              <Command.Group heading="Sesión">
                <PaletteItem
                  value="sesion cerrar logout salir"
                  icon={
                    <LogOut
                      aria-hidden
                      className="h-4 w-4 text-[var(--color-destructive)]"
                    />
                  }
                  label="Cerrar sesión"
                  hint="POST /api/auth/logout"
                  destructive
                  onSelect={cerrarSesion}
                />
              </Command.Group>
            </Command.List>

            <footer className="flex items-center justify-between gap-3 border-t border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-[11px] text-[var(--color-text-muted)]">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <Kbd>↑</Kbd>
                  <Kbd>↓</Kbd>
                  <span>navegar</span>
                </span>
                <span className="flex items-center gap-1">
                  <Kbd>↵</Kbd>
                  <span>seleccionar</span>
                </span>
              </div>
              <span className="flex items-center gap-1">
                <Kbd>⌘</Kbd>
                <Kbd>K</Kbd>
                <span>abrir / cerrar</span>
              </span>
            </footer>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function PaletteItem({
  value,
  icon,
  label,
  hint,
  trailing,
  destructive,
  onSelect,
}: {
  value: string;
  icon: React.ReactNode;
  label: string;
  hint?: string;
  trailing?: React.ReactNode;
  destructive?: boolean;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className={cn(
        "flex min-h-[40px] cursor-pointer select-none items-center gap-3 rounded-md px-2.5 py-2 text-sm",
        "outline-none transition-colors",
        "data-[selected=true]:bg-[var(--color-surface-2)] data-[selected=true]:text-[var(--color-text)]",
        destructive
          ? "text-[var(--color-destructive)]"
          : "text-[var(--color-text-secondary)]",
      )}
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {hint ? (
        <span className="hidden text-[11px] text-[var(--color-text-muted)] sm:inline">
          {hint}
        </span>
      ) : null}
      {trailing}
    </Command.Item>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-0.5 font-medium text-[var(--color-text)]">
      {children}
    </kbd>
  );
}

/**
 * Botón "Buscar… ⌘K" para colocar en la header del shell.
 * Sólo dispara la apertura via evento — el palette mismo se mantiene
 * desacoplado del shell (vive en otro componente, escucha el teclado).
 */
export function CommandPaletteTrigger() {
  return (
    <button
      type="button"
      onClick={() => {
        // Reusa el listener global enviando un keydown sintético
        const ev = new KeyboardEvent("keydown", {
          key: "k",
          ctrlKey: true,
          bubbles: true,
        });
        window.dispatchEvent(ev);
      }}
      className={cn(
        "flex h-8 items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2.5 text-xs text-[var(--color-text-muted)]",
        "transition hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
      )}
      aria-label="Abrir paleta de comandos"
    >
      <Search aria-hidden className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Buscar…</span>
      <span className="ml-2 hidden items-center gap-0.5 sm:flex">
        <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1 py-0.5 text-[10px] font-medium text-[var(--color-text)]">
          ⌘
        </kbd>
        <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1 py-0.5 text-[10px] font-medium text-[var(--color-text)]">
          K
        </kbd>
      </span>
    </button>
  );
}
