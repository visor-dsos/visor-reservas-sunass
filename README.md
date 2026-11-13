# VISOR DE RESERVAS MERESE, GRD Y ACC — SUNASS

Sitio independiente basado en Reservas del commit `6cce98f804c7b05ff64f81293031253599b788c0`. Sin interfaz de priorización AT, mapas, administración ni enlaces a otros módulos. Alerta SUNASS y funciones financieras conservadas.

- Repositorio: https://github.com/visor-dsos/visor-reservas-sunass
- Proyecto Vercel: `visor-reservas-sunass`, rama `main`, Vite, salida `dist`.
- Sitio previsto: https://visor-reservas-sunass.vercel.app/
- Desarrollo: Node 22 o superior; `corepack pnpm install --frozen-lockfile`, `pnpm dev` (http://127.0.0.1:8780/).
- Validación: `pnpm typecheck`, `pnpm build`; vista compilada: `pnpm preview`.

## Datos y actualizaciones independientes

Todos los recursos se sirven desde este mismo proyecto. No existen URLs de datos del portal original ni credenciales, API, sincronización automática, R2 o variables de entorno necesarias.

La versión inicial conserva las finanzas publicadas el 26/10/2026, sus valores nulos y 50 COD_EP/25 ODS. `public/data/reservas/contexto.json` contiene únicamente instituciones y atributos estadísticos existentes, sin geometrías. La fecha financiera NO se cambia por compilar o publicar.

Para actualizar, obtener los derivados financieros validados con la misma estructura, sin cambiar fórmulas, y preparar una carpeta propia con `finanzas_eps.json`, `maestro_eps.json` y `manifest.json`. Este último requiere `version` (formato YYYYMMDDTHHMMSSZ_8hex), `status: "validated"` y `updated_at` (fecha real de la información). Ejecutar:

```
node scripts/actualizar-datos.mjs C:/ruta/carpeta-version
```

El script comprueba códigos/importes, conserva null y escribe una versión nueva antes de activar el puntero local mediante rename. No sustituye la validación financiera previa del productor de los derivados ni importa Excel. No escribe en el proyecto original. Un fallo anterior a la activación conserva el puntero anterior. Las versiones anteriores se conservan.

Revisar localmente MERESE/GRD, comparar cortes y publicar solo los cambios aprobados mediante commit/push al remoto `visor-reservas-sunass`; Vercel despliega únicamente este proyecto. No usar el remoto del visor original.

## Fichas y fotos

`public/data/intervention-photos/` guarda 86 WebP ya optimizados (aprox. 29 MB), máximo tres fotos distintas por EPS utilizadas por las fichas. El catálogo mínimo conserva COD_EP/código de intervención/descripción/año; no contiene geometrías. Mantener manifiesto, catálogo y archivos consistentes. No son una galería ni un módulo geográfico. Solo MERESE consulta las fotos bajo demanda; GRD no carga imágenes ni genera sección fotográfica.

## Integridad

`src/reserveMonitoring*`, `regulatoryExecution`, `reserveSelection`, `reserveAnalytics` y el motor financiero conservan las fórmulas de origen. Se conserva matemática compartida aunque la interfaz y consultas de ranking AT no se ofrecen. `REGIÓN` es solo el encabezado visual ODS de Alerta SUNASS. No sustituye Región geográfica Costa/Sierra/Selva.

No copiar `.env`, `.git`, `.vercel` ni credenciales desde el original. No hay recursos compartidos en tiempo de ejecución; las actualizaciones de ambos sitios son independientes.
