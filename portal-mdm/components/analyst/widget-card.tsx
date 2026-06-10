"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface WidgetCardProps {
  id: string;
  titulo: string;
  size: "sm" | "md" | "lg";
  editMode: boolean;
  onEdit: () => void;
  onRemove: () => void;
  children: React.ReactNode;
}

const SIZE_CLASSES: Record<"sm" | "md" | "lg", string> = {
  sm: "col-span-1 row-span-1",
  md: "col-span-2 row-span-1",
  lg: "col-span-2 row-span-2",
};

export function WidgetCard({
  id,
  titulo,
  size,
  editMode,
  onEdit,
  onRemove,
  children,
}: WidgetCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !editMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative flex flex-col rounded-xl border bg-card",
        SIZE_CLASSES[size],
        isDragging && "opacity-50 z-50 shadow-2xl",
      )}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-xs font-semibold text-muted-foreground truncate">
          {titulo}
        </span>
        {editMode && (
          <div className="flex items-center gap-1 shrink-0 ml-2">
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-0.5"
              aria-label="Arrastrar widget"
            >
              <GripVertical className="h-4 w-4" />
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onEdit}
              aria-label="Editar widget"
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:text-destructive"
              onClick={onRemove}
              aria-label="Eliminar widget"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
      <div className="flex-1 p-3 min-h-[120px]">
        {children}
      </div>
    </div>
  );
}
