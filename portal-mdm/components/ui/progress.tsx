"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative h-2 w-full overflow-hidden rounded-full bg-[var(--color-surface-2)]",
          className
        )}
        {...props}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
      >
        <div
          className="h-full w-full flex-1 bg-[var(--color-primary)] transition-all duration-500 ease-in-out"
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    );
  }
);

Progress.displayName = "Progress";

export { Progress };
