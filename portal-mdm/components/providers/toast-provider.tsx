"use client";

import * as React from "react";
import { ToastContext, useToastState } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const state = useToastState();

  return (
    <ToastContext.Provider value={state}>
      {children}
      <Toaster />
    </ToastContext.Provider>
  );
}
