# Configuración exclusiva del nuevo administrador

No copiar valores ni permisos del administrador original. No compartir contraseñas por chat.

## Cloudflare R2

Crear bucket PRIVADO `visor-reservas-sunass-runtime`, almacenamiento Standard. No activar r2.dev ni dominio público. No modificar el bucket original. Crear una credencial S3 nueva con Object Read & Write limitada SOLO a este bucket. Nunca seleccionar todos los buckets. Conservar el Access Key ID y Secret Access Key exclusivamente para las variables de Vercel del nuevo proyecto.

CORS del bucket nuevo:
```json
[{"AllowedOrigins":["https://visor-reservas-sunass.vercel.app"],"AllowedMethods":["PUT"],"AllowedHeaders":["Content-Type"],"ExposeHeaders":["ETag"],"MaxAgeSeconds":600}]
```

Los Excel se cargan cifrados AES-GCM mediante URL firmada (10 minutos). Los JSON públicos se sirven por la API del nuevo dominio: no hay acceso público a sesiones, originales o cargas del bucket.

## Vercel → visor-reservas-sunass → Settings → Environment Variables → Production

| Variable | Valor a configurar |
|---|---|
| ADMIN_ORIGIN | `https://visor-reservas-sunass.vercel.app` |
| ADMIN_PASSWORD_HASH | Nuevo hash PBKDF2-SHA256: `600000$sal_base64$hash_base64`. Generarlo con el script inferior usando la misma contraseña conocida. |
| ADMIN_ENCRYPTION_KEY | Nueva clave aleatoria de 32 bytes en base64, independiente del original. |
| R2_ENDPOINT | Endpoint S3 oficial mostrado por Cloudflare para la cuenta, `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| R2_BUCKET | `visor-reservas-sunass-runtime` |
| R2_ACCESS_KEY | ID de la credencial NUEVA limitada al bucket nuevo. |
| R2_SECRET_KEY | Secreto de esa credencial nueva. |

Marcar hash, clave de cifrado y credenciales R2 como sensibles. No utilizar prefijo VITE_. No se requieren RUNTIME_PUBLIC_BASE ni VITE_RUNTIME_CURRENT_URL: la lectura usa `/runtime/` del propio dominio. No abrir ni copiar variables del proyecto original.

Desde PowerShell, en la carpeta del repositorio nuevo:
```
powershell -File .\scripts\configurar-secretos.ps1 -Kind PasswordHash
```
Pegar el portapapeles en ADMIN_PASSWORD_HASH. La contraseña se pide enmascarada solo localmente y nunca se escribe a disco. Usa sal nueva; no se copia el hash original.
```
powershell -File .\scripts\configurar-secretos.ps1 -Kind EncryptionKey
```
Pegar el portapapeles en ADMIN_ENCRYPTION_KEY. Después: `Set-Clipboard -Value ""`.

No ejecutar estos comandos desde una conversación ni compartir su resultado. La verificación de la contraseña conocida debe hacerla el usuario en `/admin` tras publicar.

## Uso

1. Iniciar sesión (cookie propia HttpOnly, Secure, SameSite Strict, una hora; CSRF y origen obligatorio).
2. Cargar Excel financiero con Implementacion, Ejecucion y Ejeseparado. Indicar la fecha institucional real de actualización, que es distinta del corte financiero leído del Excel y de la fecha/hora de activación.
3. Cargar y validar: aún no cambia current.json. Revisar corte, EPS, registros, advertencias y totales anterior/propuesto.
4. Activar actualización explícitamente. Una escritura condicional del puntero activa conjuntamente finanzas y maestro. Una vista previa obsoleta se rechaza. Abrir el visor o recargar para leer la versión nueva de manera consistente.
5. Recuperar: marcar confirmación explícita y recuperar únicamente la versión anterior. No se borran respaldos.

Las cargas de maestro conservan íntegramente las finanzas. Las cargas financieras conservan el maestro. El estado inicial usa los JSON ya publicados, fecha 26/10/2026; compilar, ingresar o validar no cambia esa fecha.

No activar Excel ficticios en producción. Las pruebas usan memoria y directorios temporales. No publicar antes de configurar y comprobar el bucket y los secretos propios.
