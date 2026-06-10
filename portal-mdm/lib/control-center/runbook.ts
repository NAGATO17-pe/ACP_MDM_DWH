export const RUNBOOK: Array<{ keywords: string[]; action: string }> = [
  {
    keywords: ["circuit", "rechazo", "rejection"],
    action:
      "Revisar registros rechazados en Cuarentena → Calidad. Abrir corrida de reconciliación desde Monitor ETL.",
  },
  {
    keywords: ["timeout", "tiempo"],
    action:
      "Verificar carga en SQL Server. Considerar aumentar timeoutSec en la configuración de la corrida.",
  },
  {
    keywords: ["constraint", "duplicado", "unique"],
    action:
      "Revisar duplicados en Bronce. Ejecutar deduplicación antes de relanzar la corrida.",
  },
  {
    keywords: ["connection", "conexión", "connect"],
    action:
      "Verificar conectividad con SQL Server. Revisar cadena de conexión en .env.",
  },
  {
    keywords: ["quality", "calidad", "validación"],
    action:
      "Revisar registros en Cuarentena → Calidad de Datos. Resolver o descartar antes de continuar.",
  },
];
