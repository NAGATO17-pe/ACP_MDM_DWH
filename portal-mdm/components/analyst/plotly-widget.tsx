"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const Plot = dynamic(
  () =>
    import("react-plotly.js/factory").then(({ default: createPlotlyComponent }) =>
      import("plotly.js-dist-min").then((Plotly) =>
        createPlotlyComponent(Plotly as unknown as Parameters<typeof createPlotlyComponent>[0]),
      ),
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="w-full h-full min-h-[160px] rounded-lg" />,
  },
);

export interface PlotlyFigure {
  data: Plotly.Data[];
  layout?: Partial<Plotly.Layout>;
  meta?: Record<string, unknown>;
}

interface PlotlyWidgetProps {
  figure: PlotlyFigure | null;
  loading?: boolean;
  error?: string | null;
  className?: string;
}

export function PlotlyWidget({
  figure,
  loading = false,
  error = null,
  className,
}: PlotlyWidgetProps) {
  if (loading) {
    return <Skeleton className={cn("w-full min-h-[160px] rounded-lg", className)} />;
  }

  if (error) {
    return (
      <div
        className={cn(
          "flex items-center justify-center min-h-[120px] rounded-lg",
          "bg-destructive/10 text-destructive text-sm px-4 text-center",
          className,
        )}
      >
        {error}
      </div>
    );
  }

  if (!figure) {
    return (
      <div
        className={cn(
          "flex items-center justify-center min-h-[120px] rounded-lg",
          "bg-muted/30 text-muted-foreground text-sm",
          className,
        )}
      >
        Sin datos
      </div>
    );
  }

  const layout: Partial<Plotly.Layout> = {
    autosize: true,
    margin: { t: 30, b: 40, l: 40, r: 10 },
    paper_bgcolor: "transparent",
    plot_bgcolor: "transparent",
    font: { color: "#e2e8f0", size: 11 },
    ...figure.layout,
  };

  return (
    <Plot
      data={figure.data}
      layout={layout}
      config={{ responsive: true, displayModeBar: false }}
      style={{ width: "100%", height: "100%" }}
      className={className}
    />
  );
}
