"use client";

/**
 * components/providers/session-expired-handler.tsx
 * =================================================
 * Listener global del evento `acp:session-expired`.
 *
 * Cuando cualquier wrapper de fetch (`fetchAndParse`, `fetchOk`, los
 * inline en mutations) detecta un 401, llama a `dispatchSessionExpired`
 * — este componente captura ese evento UNA vez y ejecuta la cadena:
 *
 *   1. Cancela todas las queries TanStack en vuelo (evita N toasts).
 *   2. Limpia el cache de TanStack para que al volver a entrar todo
 *      se recargue con la nueva sesión.
 *   3. POST /api/auth/logout para limpiar la cookie httpOnly.
 *   4. Toast con copy canónico — un solo mensaje, no por query.
 *   5. router.replace a /login?next=<ruta actual>&reason=expired,
 *      sin agregar entrada al history (para que back no vuelva al
 *      dashboard sin sesión).
 *
 * Montado en cada layout protegido: (admin), (analyst), (executive).
 * En cada uno renderiza `null` — solo conecta listeners.
 */

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LogOut } from "lucide-react";

import { SESSION_EXPIRED_EVENT } from "@/lib/api/session-events";

export function SessionExpiredHandler() {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const handledRef = useRef<boolean>(false);

  // `pathname` debe ir por ref para que el listener lea el valor más
  // reciente sin re-suscribirse en cada navegación.
  const pathnameRef = useRef<string | null>(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onExpired = async () => {
      if (handledRef.current) return;
      handledRef.current = true;

      // 1 + 2: detén el storm de queries.
      try {
        await queryClient.cancelQueries();
      } catch {
        // ignore — best effort
      }
      queryClient.clear();

      // 3: limpia cookie en el servidor (best-effort, no bloqueamos).
      void fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        keepalive: true,
      }).catch(() => undefined);

      // 4: toast canónico.
      toast.error("Sesión expirada", {
        description: "Vuelve a iniciar sesión para continuar.",
        icon: <LogOut className="h-4 w-4" aria-hidden />,
        duration: 6_000,
      });

      // 5: redirige preservando dónde estaba el usuario.
      const current = pathnameRef.current ?? "/";
      const isOnLogin = current.startsWith("/login");
      const next = isOnLogin
        ? "/"
        : encodeURIComponent(current);
      router.replace(
        isOnLogin
          ? "/login?reason=expired"
          : `/login?reason=expired&next=${next}`,
      );
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
    };
  }, [queryClient, router]);

  return null;
}
