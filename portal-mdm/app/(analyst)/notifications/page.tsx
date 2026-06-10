import type { Metadata } from "next";

export const metadata: Metadata = { title: "Notificaciones" };
export const dynamic = "force-dynamic";

export default function NotificationsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Notificaciones</h1>
      <p className="text-muted-foreground mt-1">
        Alertas ETL y calidad de datos.
      </p>
    </div>
  );
}
