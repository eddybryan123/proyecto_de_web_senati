# Nexo CMS

Sistema de gestión de contenidos adaptable con sitio público y panel de administración. El contenido del sitio, los colores, el logotipo y la navegación se administran desde el panel, sin modificar el código.

## Requisitos

- Node.js 20.9 o posterior.
- npm.
- PostgreSQL 14 o posterior y una base de datos local llamada `nexo_cms`.

La aplicación usa Next.js para el sitio, el panel y su API REST; PostgreSQL para guardar los datos; JWT en cookies `httpOnly` para las sesiones y Sharp para optimizar imágenes.

## Instalación y ejecución

```powershell
npm.cmd install
```

Instala PostgreSQL desde [postgresql.org/download/windows](https://www.postgresql.org/download/windows/) y anota la contraseña que elegiste para el usuario `postgres`. Abre **SQL Shell (psql)**, acepta `localhost`, el puerto `5432` y la base inicial `postgres`; inicia sesión con el usuario `postgres` y esa contraseña. En la consola de PostgreSQL, crea una base de datos vacía:

```sql
CREATE DATABASE nexo_cms;
```

En la carpeta del proyecto, crea `.env.local` a partir de `.env.example` si aún no existe:

```powershell
Copy-Item .env.example .env.local
```

Abre `.env.local` y reemplaza `CAMBIA_ESTA_CLAVE` por la contraseña de PostgreSQL. Si la contraseña contiene caracteres reservados de URL (por ejemplo `@`, `:`, `/` o `#`), codifícala para la URL o elige una contraseña fuerte sin esos caracteres. El resto de la cadena local ya apunta a la base `nexo_cms`.

```dotenv
DATABASE_URL=postgresql://postgres:TU_CLAVE@localhost:5432/nexo_cms
DATABASE_SSL=false
```

La aplicación crea las tablas y los datos iniciales al arrancar por primera vez:

```powershell
npm.cmd run dev
```

Visita [http://localhost:3000](http://localhost:3000) para ver el sitio y [http://localhost:3000/admin](http://localhost:3000/admin) para entrar al panel. PostgreSQL debe estar ejecutándose; en Windows puedes comprobar el servicio **postgresql-x64-XX** en la aplicación Servicios.

La configuración de demostración de `.env.example` inicia con:

- Correo: `admin@nexo.local`
- Contraseña: `NexoDemo2026!`

Cambia estas credenciales y `JWT_SECRET` antes de desplegar la aplicación. La cuenta administradora se crea al inicializar la base de datos por primera vez. Para cambiar la contraseña después de la creación, actualiza el usuario mediante un proceso administrativo seguro; cambiar `ADMIN_PASSWORD` en el archivo de entorno no reemplaza automáticamente la contraseña almacenada.

## Publicación en Render

El archivo [`render.yaml`](./render.yaml) define un servicio Node.js y una base de datos PostgreSQL de Render. Para publicarlos:

1. Inicia sesión en Render y elige **New → Blueprint**.
2. Conecta el repositorio `eddybryan123/proyecto_de_web_senati` y selecciona la rama `main`.
3. Antes de aplicar el Blueprint, proporciona `ADMIN_EMAIL` y un `ADMIN_PASSWORD` fuerte en Render. No uses ni publiques la contraseña de PostgreSQL local.
4. Confirma la creación de los recursos y espera a que termine el primer despliegue. Render generará `JWT_SECRET` y conectará la app a PostgreSQL.
5. Abre la URL del servicio y añade `/admin/login` para entrar al panel.

El plan gratuito es apropiado para una demostración, pero tiene límites importantes: el servicio web puede tardar en despertar después de inactividad; PostgreSQL gratuito vence a los 30 días; y las imágenes cargadas al panel se guardan en el sistema de archivos efímero, por lo que pueden perderse al reiniciar, suspender o volver a desplegar el servicio. Revisa los límites actuales de Render antes de usarlo para conservar datos importantes.

La base local no se copia automáticamente a Render. La app creará el esquema y el contenido inicial en la base remota al arrancar por primera vez.

Comandos disponibles en PowerShell:

```powershell
npm.cmd run dev      # servidor de desarrollo
npm.cmd run lint     # revisión estática
npm.cmd run build    # compilación de producción
npm.cmd run start    # servidor de producción
npm.cmd run db:migrate-sqlite # importar la base local SQLite existente
```

Las imágenes optimizadas se guardan en `public/uploads/`. Haz copias de seguridad de este directorio y de la base PostgreSQL al desplegar.

## Funcionalidades

- Sitio público responsivo con bloques de portada, texto, tarjetas y llamada a la acción.
- Panel con inicio de sesión, resumen, editor de páginas y borradores/publicación.
- Personalización de marca, descripción, logo y cuatro colores globales.
- Menú editable con orden, visibilidad y destinos.
- Carga de JPG, PNG, WebP y AVIF de hasta 8 MB. Sharp corrige la orientación, convierte a WebP y crea versiones responsivas.
- Endpoints de administración protegidos por sesión de rol administrador.
- Los borradores no aparecen en páginas públicas ni en la API pública.

## Persistencia y modelo de datos

PostgreSQL mantiene las entidades normalizadas: `users`, `site_config`, `pages`, `page_components` y `menu_items`. Cada tabla tiene una responsabilidad, y las claves/relaciones separan usuarios, configuración, páginas, navegación y bloques. La estructura modular se almacena como `JSONB` en `page_components.content_json`, vinculada a `pages` con borrado en cascada.

Si ya usabas el CMS con SQLite, conserva `data/cms.sqlite`. Inicia la aplicación una vez para crear las tablas de PostgreSQL, detenla con `Ctrl+C` y ejecuta `npm.cmd run db:migrate-sqlite`. El comando copia los usuarios (incluido el hash de contraseña), los ajustes, las páginas, los bloques y el menú; es seguro volver a ejecutarlo. El archivo SQLite no se borra.

El diagrama entidad-relación está en [`docs/er-diagram.svg`](./docs/er-diagram.svg).

## API REST

Las rutas de administración requieren la cookie de sesión emitida por `POST /api/auth/login`. La colección importable de Postman, con ejemplos y autenticación mediante cookie, está en [`postman_collection.json`](./postman_collection.json).

| Método | Ruta | Acceso | Uso |
| --- | --- | --- | --- |
| `POST` | `/api/auth/login` | Público | Validar credenciales e iniciar sesión |
| `POST` | `/api/auth/logout` | Público | Cerrar sesión |
| `GET` | `/api/auth/session` | Sesión | Consultar la sesión actual |
| `GET` | `/api/site-config` | Público | Leer identidad visual |
| `PATCH` | `/api/site-config` | Administrador | Actualizar marca y colores |
| `GET` | `/api/menu` | Público | Leer enlaces visibles del menú |
| `PUT` | `/api/menu` | Administrador | Reemplazar y ordenar enlaces |
| `GET` | `/api/pages` | Público / admin | Listar páginas publicadas; con sesión, también borradores |
| `POST` | `/api/pages` | Administrador | Crear un borrador |
| `GET` | `/api/pages/{id-o-slug}` | Público / admin | Leer página publicada o, con sesión, un borrador |
| `PUT` | `/api/pages/{id-o-slug}` | Administrador | Actualizar página y bloques |
| `DELETE` | `/api/pages/{id-o-slug}` | Administrador | Eliminar página y sus bloques |
| `POST` | `/api/media` | Administrador | Optimizar una imagen (`multipart/form-data`, campo `file`) |

Los colores deben ser HEX `#RRGGBB`. Los destinos del menú admiten rutas locales, HTTPS y `mailto:`. Los bloques aceptados son `hero`, `text`, `cards` y `cta`.

## Seguridad y despliegue

- Guarda `DATABASE_URL` y los secretos en el gestor de variables de entorno de tu proveedor y no publiques `.env.local`.
- Usa un `JWT_SECRET` aleatorio con al menos 32 caracteres y HTTPS en producción; la cookie se marca `Secure` automáticamente en `NODE_ENV=production`.
- El login compara contraseñas con bcrypt y la cookie de sesión es `httpOnly`, `SameSite=Strict` y expira a las 8 horas.
- Configura PostgreSQL administrado y almacenamiento persistente para `public/uploads/`. En proveedores que requieren TLS, establece `DATABASE_SSL=true`; el servidor valida los certificados. El disco local de medios es efímero en despliegues serverless, así que migra las imágenes a almacenamiento de objetos para producción.
