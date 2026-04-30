"use client";

import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";
import { ToastContext, useToastState } from "@/hooks/use-toast";

export function Toaster() {
  const state = useToastState();

  return (
    <ToastContext.Provider value={state}>
      <ToastProvider swipeDirection="right">
        {state.toasts.map(({ id, title, description, open, variant, duration: _duration, ...props }) => (
          <Toast
            key={id}
            open={open}
            variant={variant}
            onOpenChange={(isOpen) => {
              if (!isOpen) state.dismiss(id);
            }}
            {...props}
          >
            <div className="flex flex-1 flex-col gap-1">
              {title ? <ToastTitle>{title}</ToastTitle> : null}
              {description ? <ToastDescription>{description}</ToastDescription> : null}
            </div>
            <ToastClose />
          </Toast>
        ))}
        <ToastViewport />
      </ToastProvider>
    </ToastContext.Provider>
  );
}
