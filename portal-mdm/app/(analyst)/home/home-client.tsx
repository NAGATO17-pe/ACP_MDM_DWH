"use client";

import { useState } from "react";
import { WidgetGrid } from "@/components/analyst/widget-grid";
import { WidgetConfigModal } from "@/components/analyst/widget-config-modal";
import type { WidgetConfigFormData } from "@/components/analyst/widget-config-modal";
import { useAnalystHome } from "@/hooks/use-analyst-home";

export function HomeClient() {
  const {
    widgets,
    editMode,
    saving,
    toggleEditMode,
    addWidget,
    updateWidget,
    removeWidget,
    reorderWidgets,
    saveLayout,
  } = useAnalystHome();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState<Partial<WidgetConfigFormData> | undefined>(
    undefined,
  );

  function handleOpenAdd() {
    setEditingWidget(undefined);
    setModalOpen(true);
  }

  function handleOpenEdit(id: string) {
    const w = widgets.find((x) => x.id === id);
    if (w) setEditingWidget(w);
    setModalOpen(true);
  }

  async function handleModalSave(config: WidgetConfigFormData) {
    setModalOpen(false);
    if (editingWidget?.id) {
      await updateWidget(config);
    } else {
      await addWidget(config);
    }
  }

  return (
    <>
      <div className="p-6">
        <WidgetGrid
          widgets={widgets}
          editMode={editMode}
          saving={saving}
          onReorder={reorderWidgets}
          onAddWidget={handleOpenAdd}
          onEditWidget={handleOpenEdit}
          onRemoveWidget={removeWidget}
          onToggleEdit={toggleEditMode}
          onSave={saveLayout}
        />
      </div>
      <WidgetConfigModal
        open={modalOpen}
        initial={editingWidget}
        onClose={() => setModalOpen(false)}
        onSave={handleModalSave}
      />
    </>
  );
}
