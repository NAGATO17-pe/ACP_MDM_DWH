import { PageSkeleton } from "@/components/ui/page-skeleton";

export default function EtlMonitorLoading() {
  return <PageSkeleton template="table" tableRows={10} />;
}
