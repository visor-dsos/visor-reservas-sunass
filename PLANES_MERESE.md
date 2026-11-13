# Planes de intervenciones MERESE — descarga por EPS

## Fuente y selección
- Hoja `Base Trabajable`; TEMA = MRSE (normalización de espacios y mayúsculas).
- COD_EP exacto en D, MEDIDA en J, montos de los cinco años en K:O.
- Nombre canónico y metadatos regulatorios proceden del visor, no del nombre/fórmulas externos del libro.
- La columna G contiene un cálculo referido al 31/12/2025; no se usa como año vigente ni duración.
- Se selecciona un único conjunto marcado `Ultima Reso = SI` por COD_EP. F_INI y resolución son trazabilidad auxiliar; una diferencia con el inicio del visor no excluye medidas. Múltiples conjuntos marcados vigentes quedan pendientes, sin mezclarlos.
- La incorporación inicial añade exclusivamente planes, vinculados mediante SHA-256 a los bytes financieros de `20261026T213538Z_762f8667`. No reemplaza finanzas, manifiesto activo ni su fecha. El respaldo inicial del backend sirve estos planes por EPS y los incorpora al almacenamiento independiente cuando se prepara una nueva versión.

## Resultado inicial
342 medidas MRSE, 50 EPS. Se conservaron sin recalcular los 42 casos inicialmente conciliados (280 medidas, S/ 108,478,821.67).
Los siete casos adicionales con metadatos regulatorios concilian exactamente: COD_EP 14, 43, 45, 31, 37, 42, 16.
49 EPS comparables: S/ 131,631,684.67; diferencia con la estimación anual del mismo universo: S/ 0.
COD_EP 8 (Tumbes): 9 medidas por S/ 300,000. Sin fecha de inicio, duración ni año vigente en los datos del visor; se muestran como no disponibles y no se inventa conciliación.
Total de planes disponibles (50 EPS): S/ 131,931,684.67. La diferencia nacional de S/ 300,000 corresponde exclusivamente al plan de Tumbes, fuera del universo con estimación regulatoria disponible.
COD_EP 43 no tiene resolución informada: se mantiene explícitamente no disponible; su único plan marcado SI concilia por S/ 1,613,000.
Los vacíos dentro del PR se conservan; los totales son importes disponibles, no imputaciones de cero. Los años fuera de la duración conocida dicen «No aplica».

## Actualización y seguridad
La carga financiera procesa Base Trabajable y crea `planes_merese.json` en la misma versión que las finanzas. La previsualización informa medidas/EPS/pendientes. Solo la activación explícita del puntero hace vigente el conjunto. El rollback recupera los planes de esa misma versión. La actualización del maestro conserva los planes financieros.
Si falta Base Trabajable, la nueva versión informa planes no disponibles; nunca arrastra silenciosamente planes de otra versión.
La API pública entrega únicamente el plan de la EPS solicitada (Excel de dos hojas) y verifica el hash financiero. No expone el conjunto completo, el Excel institucional, rutas privadas ni enlaces de SharePoint.
El visor original, sus credenciales, finanzas y almacenamiento no se modifican.

## Verificación
33 comprobaciones dirigidas iniciales satisfactorias (Excel, cinco años, texto literal, totales, vigencia, activación/rollback y aislamiento).
Tras la aclaración metodológica: comprobación específica de los ocho casos restantes, preservación de metadatos del visor y generación XLSX; los 42 anteriores no se repitieron.
UI local comprobada: botón junto a ficha, diálogo, búsqueda, preselección, confirmación, descarga real COD_EP 10, filtros globales intactos y GRD deshabilitado. TypeScript y build completados; build local contiene la nueva funcionalidad. Descarga pública se comprueba después del despliegue.
