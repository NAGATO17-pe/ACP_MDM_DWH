import { PageSkeleton } from "@/components/ui/page-skeleton";

export default function DashboardLoading() {
  return <PageSkeleton template="dashboard" kpiCount={4} cardCount={6} />;
}
