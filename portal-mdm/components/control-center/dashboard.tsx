import { PageHeader } from "@/components/ui/page-header";
import { HeroKpis } from "./hero-kpis";
import {
  DwhStateCard,
  EtlHealthCard,
  EtlTrendCard,
  LastSyncBadge,
  QualitySummaryCard,
} from "./dashboard-cards";
import { DashboardRefreshControl } from "./dashboard-refresh-control";
import { SystemStatusStrip } from "./system-status-strip";
import { LiveRunsPanel } from "./live-runs-panel";
import { AlertFeedLive } from "./alert-feed-live";

interface DashboardProps {
  title: string;
  description?: string;
}

/**
 * Dashboard Control Center V2.
 *
 * Five zones:
 *   1. PageHeader with inline SystemStatusStrip pills + refresh controls.
 *   2. Hero KPIs — 6 tiles (Pipeline Score, Active Runs, Filas, Fallos, Cuarentena, Alertas).
 *   3. Live Panel (Active runs + Alert feed) | ETL Trend with range selector.
 *   4. DWH State + Data Freshness | Quality Summary.
 *   5. ETL Health Heatmap (14 days, full width).
 */
export function Dashboard({ title, description }: DashboardProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* Zone 1: Header */}
      <PageHeader
        title={title}
        description={description}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <SystemStatusStrip />
            <div className="flex items-center gap-2">
              <DashboardRefreshControl />
              <LastSyncBadge />
            </div>
          </div>
        }
      />

      {/* Zone 2: Hero KPIs */}
      <HeroKpis />

      {/* Zone 3: Live Panel + ETL Trend */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-1">
          <LiveRunsPanel />
          <AlertFeedLive />
        </div>
        <div className="lg:col-span-2">
          <EtlTrendCard />
        </div>
      </section>

      {/* Zone 4: DWH State + Quality */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <DwhStateCard />
        </div>
        <div className="lg:col-span-2">
          <QualitySummaryCard />
        </div>
      </section>

      {/* Zone 5: Health Heatmap full width */}
      <section>
        <EtlHealthCard />
      </section>
    </div>
  );
}
