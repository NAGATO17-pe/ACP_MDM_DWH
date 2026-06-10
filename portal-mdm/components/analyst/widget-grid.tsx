"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { Plus, Save, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WidgetCard } from "./widget-card";
import { PlotlyWidget } from "./plotly-widget";
import type { WidgetConfigFormData } from "./widget-config-modal";
import type { PlotlyFigure } from "./plotly-widget";

export interface WidgetState extends WidgetConfigFormData {
  figure: PlotlyFigure | null;
  loading: boolean;
  error: string | null;
}

interface WidgetGridProps {
  widgets: WidgetState[];
  editMode: boolean;
  saving: boolean;
  onReorder: (newOrder: WidgetState[]) => void;
  onAddWidget: () => void;
  onEditWidget: (id: string) => void;
  onRemoveWidget: (id: string) => void;
  onToggleEdit: () => void;
  onSave: () => void;
}

export function WidgetGrid({
  widgets,
  editMode,
  saving,
  onReorder,
  onAddWidget,
  onEditWidget,
  onRemoveWidget,
  onToggleEdit,
  onSave,
}: WidgetGridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = widgets.findIndex((w) => w.id === String(active.id));
    const newIdx = widgets.findIndex((w) => w.id === String(over.id));
    if (oldIdx !== -1 && newIdx !== -1) {
      onReorder(arrayMove(widgets, oldIdx, newIdx));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Mi Workspace</h1>
        <div className="flex gap-2">
          {editMode && (
            <Button size="sm" onClick={onAddWidget}>
              <Plus className="h-4 w-4 mr-1" /> Widget
            </Button>
          )}
          {editMode && (
            <Button size="sm" onClick={onSave} disabled={saving}>
              <Save className="h-4 w-4 mr-1" />
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onToggleEdit}>
            <LayoutGrid className="h-4 w-4 mr-1" />
            {editMode ? "Salir de edición" : "Editar layout"}
          </Button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={widgets.map((w) => w.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-4 gap-4 auto-rows-[160px]">
            {widgets.map((w) => (
              <WidgetCard
                key={w.id}
                id={w.id}
                titulo={w.titulo}
                size={w.size}
                editMode={editMode}
                onEdit={() => onEditWidget(w.id)}
                onRemove={() => onRemoveWidget(w.id)}
              >
                <PlotlyWidget
                  figure={w.figure}
                  loading={w.loading}
                  error={w.error}
                  className="h-full"
                />
              </WidgetCard>
            ))}

            {editMode && (
              <button
                onClick={onAddWidget}
                className="col-span-1 row-span-1 rounded-xl border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                <Plus className="h-6 w-6" />
                <span className="text-xs">Agregar</span>
              </button>
            )}
          </div>
        </SortableContext>
      </DndContext>

      {widgets.length === 0 && !editMode && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <LayoutGrid className="h-10 w-10 opacity-30" />
          <p className="text-sm">Tu workspace está vacío.</p>
          <Button variant="outline" size="sm" onClick={onToggleEdit}>
            Empezar a configurar widgets
          </Button>
        </div>
      )}
    </div>
  );
}
