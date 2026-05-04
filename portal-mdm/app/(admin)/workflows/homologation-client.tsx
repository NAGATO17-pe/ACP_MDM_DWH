"use client";

import { useState, useMemo, useEffect } from "react";
import { 
  CheckCircle2, 
  Database, 
  Filter, 
  Layers, 
  RefreshCcw, 
  Save, 
  ShieldAlert, 
  Trash2, 
  XCircle,
  Search,
  ChevronLeft,
  ChevronRight,
  Info,
  Zap,
  Sparkles
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { 
  getCatalogOptions, 
  resolveHomologation, 
  rejectHomologation,
  runReinjection,
  getReinjectionStats
} from "@/lib/api/homologation";
import type { HomologationRecord } from "@/lib/schemas/homologation";
import { cn } from "@/lib/utils";

interface HomologationClientProps {
  initialData: HomologationRecord[];
  reinyeccionCount: number;
}

export function HomologationClient({ initialData, reinyeccionCount }: HomologationClientProps) {
  const { toast } = useToast();
  const [data, setData] = useState(initialData);
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [globalLoading, setGlobalLoading] = useState(false);
  
  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;
  
  // Filtros
  const [tableFilter, setTableFilter] = useState("all");
  const [fieldFilter, setFieldFilter] = useState("all");
  const [search, setSearch] = useState("");

  // Opciones de Catálogo (Cache local por campo)
  const [catalogCache, setCatalogCache] = useState<Record<string, string[]>>({});

  // Cargar catálogos cuando cambia el filtro de campo
  useEffect(() => {
    async function loadCatalog() {
      if (fieldFilter !== "all" && !catalogCache[fieldFilter]) {
        try {
          const options = await getCatalogOptions(fieldFilter);
          setCatalogCache(prev => ({ ...prev, [fieldFilter]: options }));
        } catch (e) {
          console.error("Error loading catalog", e);
        }
      }
    }
    loadCatalog();
  }, [fieldFilter, catalogCache]);

  const tableOptions = useMemo(() => Array.from(new Set(initialData.map(d => d.tabla))).sort(), [initialData]);
  const fieldOptions = useMemo(() => Array.from(new Set(initialData.map(d => d.campo))).sort(), [initialData]);

  const filteredData = useMemo(() => {
    return data.filter(d => {
      const matchTable = tableFilter === "all" || d.tabla === tableFilter;
      const matchField = fieldFilter === "all" || d.campo === fieldFilter;
      const matchSearch = !search || 
        d.texto_crudo.toLowerCase().includes(search.toLowerCase()) || 
        d.tabla.toLowerCase().includes(search.toLowerCase());
      return matchTable && matchField && matchSearch;
    });
  }, [data, tableFilter, fieldFilter, search]);

  // Resetear página al filtrar
  useEffect(() => {
    setCurrentPage(1);
  }, [tableFilter, fieldFilter, search]);

  const totalPages = Math.ceil(filteredData.length / pageSize);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  // Selección automática de alta confianza
  useEffect(() => {
    const highConfIds = initialData
      .filter(d => d.score >= 0.95)
      .map(d => d.id_registro);
    setSelectedIds(new Set(highConfIds));
    
    const initialCorrections: Record<string, string> = {};
    initialData.forEach(d => {
      if (d.valor_sugerido) initialCorrections[d.id_registro] = d.valor_sugerido;
    });
    setCorrections(initialCorrections);
  }, [initialData]);

  const toggleSelect = (id: string | number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredData.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredData.map(d => d.id_registro)));
  };

  const handleSaveSelected = async () => {
    if (selectedIds.size === 0) return;
    setGlobalLoading(true);
    let success = 0;
    let failed = 0;

    for (const id of Array.from(selectedIds)) {
      const record = data.find(d => d.id_registro === id);
      const correction = corrections[id];
      if (record && correction) {
        try {
          await resolveHomologation(record.tabla, id, correction);
          success++;
        } catch (e) {
          failed++;
        }
      }
    }

    toast({
      title: "Proceso completado",
      description: `Se guardaron ${success} registros correctamente. ${failed ? `${failed} fallaron.` : ""}`,
      variant: failed ? "destructive" : "default"
    });
    
    // Refresh local data (remove saved)
    setData(prev => prev.filter(d => !selectedIds.has(d.id_registro)));
    setSelectedIds(new Set());
    setGlobalLoading(false);
  };

  const handleRejectSelected = async () => {
    if (selectedIds.size === 0) return;
    setGlobalLoading(true);
    let success = 0;

    for (const id of Array.from(selectedIds)) {
      const record = data.find(d => d.id_registro === id);
      if (record) {
        try {
          await rejectHomologation(record.tabla, id);
          success++;
        } catch (e) {}
      }
    }

    toast({
      title: "Registros rechazados",
      description: `Se eliminaron ${success} registros de la cola.`,
    });
    
    setData(prev => prev.filter(d => !selectedIds.has(d.id_registro)));
    setSelectedIds(new Set());
    setGlobalLoading(false);
  };

  const handleReinject = async () => {
    setGlobalLoading(true);
    try {
      const res = await runReinjection();
      toast({
        title: "Reinyección exitosa",
        description: res.mensaje || `${res.reinyectados} registros vueltos a encolar.`,
      });
    } catch (e) {
      toast({ title: "Error en reinyección", variant: "destructive" });
    }
    setGlobalLoading(false);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Herramienta de Reinyección */}
      {reinyeccionCount > 0 && (
        <Card className="border-primary/20 bg-primary/5 overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
             <RefreshCcw className="h-24 w-24 rotate-12" />
          </div>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <RefreshCcw className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-lg">Re-Inyección MDM</CardTitle>
                <CardDescription className="text-primary/70 font-medium">
                  {reinyeccionCount} registros resueltos listos para reprocesar en el Pipeline.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <p className="text-sm text-muted-foreground flex-1">
                Los registros que has homologado se enviarán de vuelta a la capa Bronce para que el motor ETL los procese con sus nuevos valores canónicos.
              </p>
              <Button onClick={handleReinject} disabled={globalLoading} className="gap-2 shadow-lg shadow-primary/20 shrink-0">
                <Zap className="h-4 w-4" />
                Ejecutar Reprocesamiento
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Barra de Herramientas */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-card p-4 rounded-xl border border-border/40 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por dato o tabla..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Select value={tableFilter} onValueChange={setTableFilter}>
            <SelectTrigger className="h-9 w-[160px] text-xs">
              <SelectValue placeholder="Tabla" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las tablas</SelectItem>
              {tableOptions.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fieldFilter} onValueChange={setFieldFilter}>
            <SelectTrigger className="h-9 w-[160px] text-xs">
              <SelectValue placeholder="Campo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los campos</SelectItem>
              {fieldOptions.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
          {(tableFilter !== "all" || fieldFilter !== "all" || search) && (
            <Button variant="ghost" size="sm" onClick={() => { setTableFilter("all"); setFieldFilter("all"); setSearch(""); }} className="h-9 px-2 text-muted-foreground hover:text-destructive">
              <XCircle className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto border-t md:border-t-0 pt-3 md:pt-0">
          <Button 
            variant="outline" 
            size="sm" 
            disabled={selectedIds.size === 0 || globalLoading}
            onClick={handleRejectSelected}
            className="flex-1 md:flex-none gap-2 hover:bg-destructive/5 hover:text-destructive hover:border-destructive/30"
          >
            <Trash2 className="h-4 w-4" />
            Rechazar ({selectedIds.size})
          </Button>
          <Button 
            variant="default" 
            size="sm" 
            disabled={selectedIds.size === 0 || globalLoading}
            onClick={handleSaveSelected}
            className="flex-1 md:flex-none gap-2 shadow-md"
          >
            <Save className="h-4 w-4" />
            Guardar Seleccionados
          </Button>
        </div>
      </div>

      {/* Grid de Homologación */}
      <div className="rounded-xl border border-border/40 bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border/40">
              <tr>
                <th className="p-4 text-left w-10">
                   <input 
                    type="checkbox" 
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    checked={selectedIds.size === filteredData.length && filteredData.length > 0}
                    onChange={toggleAll}
                   />
                </th>
                <th className="p-4 text-left font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Origen</th>
                <th className="p-4 text-left font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Dato Crudo</th>
                <th className="p-4 text-left font-semibold text-muted-foreground uppercase tracking-wider text-[10px] w-[280px]">Corrección Sugerida</th>
                <th className="p-4 text-left font-semibold text-muted-foreground uppercase tracking-wider text-[10px] w-[140px]">Confianza</th>
                <th className="p-4 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {paginatedData.map((d) => {
                const options = catalogCache[d.campo] || [];
                const isFact = d.tabla.toLowerCase().includes("fact");
                const hasOptions = options.length > 0;
                
                return (
                  <tr key={d.id_registro} className={cn(
                    "transition-colors hover:bg-muted/30",
                    selectedIds.has(d.id_registro) && "bg-primary/5"
                  )}>
                    <td className="p-4">
                      <input 
                        type="checkbox" 
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        checked={selectedIds.has(d.id_registro)}
                        onChange={() => toggleSelect(d.id_registro)}
                      />
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-lg border",
                          isFact ? "bg-blue-500/10 border-blue-500/20 text-blue-600" : "bg-purple-500/10 border-purple-500/20 text-purple-600"
                        )}>
                          {isFact ? <Layers className="h-4 w-4" /> : <Database className="h-4 w-4" />}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-xs truncate max-w-[120px]">{d.tabla}</span>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">{d.campo}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                       <code className="text-xs font-mono bg-destructive/5 text-destructive px-2 py-1 rounded border border-destructive/10">
                        {d.texto_crudo}
                       </code>
                    </td>
                    <td className="p-4">
                      {hasOptions ? (
                        <Select 
                          value={corrections[d.id_registro] || ""} 
                          onValueChange={(val) => setCorrections(prev => ({ ...prev, [d.id_registro]: val }))}
                        >
                          <SelectTrigger className={cn(
                            "h-9 text-xs font-medium border-primary/20 focus:ring-primary/10",
                            !corrections[d.id_registro] && "text-muted-foreground italic border-dashed"
                          )}>
                            <SelectValue placeholder="Seleccionar oficial..." />
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px]">
                            {options.map(opt => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="relative">
                          <Input 
                            value={corrections[d.id_registro] || ""}
                            onChange={(e) => setCorrections(prev => ({ ...prev, [d.id_registro]: e.target.value }))}
                            className="h-9 text-xs font-medium border-primary/20 pr-8"
                            placeholder="Corrección libre..."
                          />
                          <Sparkles className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-primary/40" />
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                       <div className="flex flex-col gap-1.5 w-full max-w-[100px]">
                          <div className="flex items-center justify-between text-[10px] font-bold">
                             <span className={cn(
                               d.score >= 0.85 ? "text-emerald-600" : "text-amber-600"
                             )}>{Math.round(d.score * 100)}%</span>
                             <Sparkles className={cn("h-3 w-3", d.score >= 0.9 ? "text-primary animate-pulse" : "text-muted-foreground/30")} />
                          </div>
                          <Progress value={d.score * 100} className={cn(
                            "h-1.5",
                            d.score >= 0.85 ? "[&>div]:bg-emerald-500" : "[&>div]:bg-amber-500"
                          )} />
                       </div>
                    </td>
                    <td className="p-4 text-right">
                       <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground opacity-30 hover:opacity-100">
                          <Info className="h-4 w-4" />
                       </Button>
                    </td>
                  </tr>
                );
              })}
              {paginatedData.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                       <CheckCircle2 className="h-12 w-12 text-emerald-500/20" />
                       <span className="text-sm font-medium">No hay sugerencias que coincidan con los criterios.</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer con Paginación */}
        <div className="bg-muted/30 border-t border-border/40 p-4 flex items-center justify-between">
          <div className="text-xs text-muted-foreground font-medium">
            Mostrando <span className="text-foreground">{paginatedData.length}</span> de <span className="text-foreground">{filteredData.length}</span> registros
            {totalPages > 1 && ` (Página ${currentPage} de ${totalPages})`}
          </div>
          
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="h-8 gap-1 text-[11px] font-bold"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Anterior
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  // Lógica simple para mostrar páginas cercanas
                  let pageNum = i + 1;
                  if (totalPages > 5 && currentPage > 3) {
                    pageNum = currentPage - 3 + i;
                    if (pageNum + 5 > totalPages) pageNum = totalPages - 4 + i;
                  }
                  if (pageNum <= 0) return null;
                  if (pageNum > totalPages) return null;

                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      className={cn(
                        "h-8 w-8 text-[11px] font-bold p-0",
                        currentPage === pageNum ? "shadow-md" : ""
                      )}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="h-8 gap-1 text-[11px] font-bold"
              >
                Siguiente
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
