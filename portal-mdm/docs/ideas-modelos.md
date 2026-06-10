# Ideas — Módulo Modelos (pospuesto)

Ruta futura: `/models` · Rol: `analyst`

---

## Qué sería este módulo

Espacio donde el analista registra, consulta y compara modelos estadísticos o ML
entrenados sobre los datos del DWH. No es un entrenador de modelos — es un
**registro y visor** de modelos ya entrenados.

---

## Ideas de features

### Registro de modelos
- Nombre, descripción, tipo (regresión, clasificación, serie temporal, etc.)
- Tabla/vista del DWH sobre la que fue entrenado
- Fecha de entrenamiento y versión
- Métricas de evaluación (R², MAE, RMSE, accuracy, etc.)
- Archivo del modelo (pickle / joblib / ONNX)
- Autor (usuario analista que lo registró)

### Comparador de modelos
- Side-by-side de métricas entre versiones del mismo modelo
- Gráfica de degradación de performance en el tiempo
- "¿Cuál versión usar en producción?"

### Predicciones on-demand
- El analista selecciona un modelo registrado
- Sube o selecciona un conjunto de datos de entrada (desde el DWH)
- El backend (FastAPI) corre la inferencia y devuelve resultados
- Visualización de predicciones con Plotly (ya disponible en el stack)

### Linaje modelo → datos
- Qué vista del DWH alimenta el modelo
- Qué ETL corrió para generar esos datos
- Si el ETL cambió, alerta de "posible drift"

### Alertas de drift
- Comparar distribución de features hoy vs cuando se entrenó
- Alerta cuando la distribución cambia significativamente (KL divergence, PSI)

---

## Stack técnico pensado

| Componente | Herramienta |
|---|---|
| Serialización de modelos | joblib / ONNX |
| Inferencia en backend | FastAPI + joblib.load |
| Métricas | scikit-learn metrics |
| Drift detection | evidently (Python) |
| Visualización | Plotly (ya en el stack) |
| Storage de artefactos | Sistema de archivos / S3 |

---

## Dependencias previas necesarias

- El módulo de **Reportes** debe estar maduro (para reutilizar el patrón de vistas analíticas)
- El módulo de **Exploración DWH** debe estar listo (para seleccionar datasets de entrada)
- El backend FastAPI debe tener endpoints analíticos estables

---

## Prioridad sugerida: Fase 3

No implementar hasta que Fase 1 y Fase 2 estén en producción y haya demanda
real de los analistas para registrar modelos.
