"use client";

import * as ToastPrimitive from "@radix-ui/react-toast";
import { X } from "lucide-react";
import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const ToastProvider = ToastPrimitive.Provider;

export const ToastViewport = forwardRef<
  React.ComponentRef<typeof ToastPrimitive.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Viewport
    ref={ref}
    className={cn(
      "fixed bottom-4 right-4 z-[9999] flex w-[380px] max-w-[calc(100vw-2rem)] flex-col gap-2",
      className,
    )}
    {...props}
  />
));
ToastViewport.displayName = "ToastViewport";

const toastVariants = cva(
  [
    "group relative flex w-full items-start gap-3 overflow-hidden rounded-lg border p-4 shadow-lg",
    "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-4",
    "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-right-full",
    "data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]",
    "data-[swipe=end]:animate-out",
  ],
  {
    variants: {
      variant: {
        default:
          "border-[var(--color-border)] bg-[var(--color-surface)]",
        success:
          "border-[var(--color-success)]/40 bg-[color-mix(in_oklab,var(--color-success)_8%,var(--color-surface))]",
        destructive:
          "border-[var(--color-destructive)]/40 bg-[color-mix(in_oklab,var(--color-destructive)_8%,var(--color-surface))]",
        warning:
          "border-[var(--color-warning)]/40 bg-[color-mix(in_oklab,var(--color-warning)_8%,var(--color-surface))]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface ToastProps
  extends React.ComponentPropsWithoutRef<typeof ToastPrimitive.Root>,
    VariantProps<typeof toastVariants> {}

export const Toast = forwardRef<
  React.ComponentRef<typeof ToastPrimitive.Root>,
  ToastProps
>(({ className, variant, ...props }, ref) => (
  <ToastPrimitive.Root
    ref={ref}
    className={cn(toastVariants({ variant }), className)}
    {...props}
  />
));
Toast.displayName = "Toast";

export const ToastTitle = forwardRef<
  React.ComponentRef<typeof ToastPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Title
    ref={ref}
    className={cn("text-sm font-semibold leading-tight text-[var(--color-text)]", className)}
    {...props}
  />
));
ToastTitle.displayName = "ToastTitle";

export const ToastDescription = forwardRef<
  React.ComponentRef<typeof ToastPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Description
    ref={ref}
    className={cn("text-sm text-[var(--color-text-muted)]", className)}
    {...props}
  />
));
ToastDescription.displayName = "ToastDescription";

export const ToastAction = forwardRef<
  React.ComponentRef<typeof ToastPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Action
    ref={ref}
    className={cn(
      "ml-auto shrink-0 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium transition",
      "hover:bg-[var(--color-surface-2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
      className,
    )}
    {...props}
  />
));
ToastAction.displayName = "ToastAction";

export const ToastClose = forwardRef<
  React.ComponentRef<typeof ToastPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Close
    ref={ref}
    className={cn(
      "absolute right-2 top-2 rounded-sm opacity-50 transition hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
      "group-hover:opacity-100",
      className,
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
    <span className="sr-only">Cerrar</span>
  </ToastPrimitive.Close>
));
ToastClose.displayName = "ToastClose";
