import { PageSkeleton } from "@/components/ui/page-skeleton";

export default function DwhLoading() {
  return <PageSkeleton template="dashboard-with-table" kpiCount={4} tableRows={10} />;
}
