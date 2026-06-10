import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mi Workspace" };
export const dynamic = "force-dynamic";

export default function AnalystHomePage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Mi Workspace</h1>
      <p className="text-muted-foreground mt-1">
        Tu espacio de análisis personal. Próximamente: widgets configurables.
      </p>
    </div>
  );
}
