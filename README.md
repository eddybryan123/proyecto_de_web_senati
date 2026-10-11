# Nexo Store

Tienda online adaptable con catálogo de productos, carrito y pedidos coordinados por WhatsApp. Incluye un panel para administrar productos, páginas, marca y navegación. Los datos se guardan en un archivo SQLite local; no hace falta instalar PostgreSQL ni configurar un servidor de base de datos.

## Requisitos

- Node.js 20.9 o posterior.
- npm.

## Instalación local en Windows

En la carpeta del proyecto, instala las dependencias:

```powershell
npm.cmd install
```

Crea `.env.local` copiando el archivo de ejemplo si todavía no existe:

```powershell
Copy-Item .env.example .env.local
```

Abre `.env.local` y cambia `ADMIN_PASSWORD` y `JWT_SECRET` por valores propios. La base de datos se crea automáticamente en `data/cms.sqlite` al iniciar la aplicación:

```dotenv
DATABASE_PATH=./data/cms.sqlite
```

Inicia la tienda:

```powershell
npm.cmd run dev
```

Abre [http://localhost:3000](http://localhost:3000) para ver la tienda y [http://localhost:3000/admin](http://localhost:3000/admin) para entrar al panel. El correo y la contraseña iniciales se leen de `ADMIN_EMAIL` y `ADMIN_PASSWORD` en `.env.local`. Cambiar estas variables después de crear el administrador no cambia la contraseña que ya está guardada en SQLite.

Si ya tenías datos en `data/cms.sqlite`, la aplicación conserva las tablas y el contenido existentes, y crea la tabla de productos al arrancar. Haz una copia de ese archivo antes de actualizar el proyecto. Los archivos de base de datos y los secretos locales no se incluyen en Git.

Al crear el catálogo por primera vez aparecen cuatro productos tecnológicos de ejemplo: audífonos Bluetooth, laptop, mouse y teclado. Sus precios son demostrativos; puedes editarlos o eliminarlos desde **Productos**.

En el panel:

1. En **Productos**, agrega los artículos, su descripción y precio en soles, y elige si se muestran en la tienda.
2. En **Apariencia**, configura el WhatsApp de pedidos con código de país y solo 8–15 dígitos (por ejemplo, `51987654321`).
3. Abre la tienda, agrega productos al carrito, escribe tu nombre y envía el pedido. El cliente y la tienda coordinan el pago y la entrega por WhatsApp; no se procesa un pago en línea.

## Base de datos y copias de seguridad

La aplicación usa SQLite a través de `sql.js`. El esquema se crea y actualiza al iniciar; `DATABASE_PATH` permite cambiar la ubicación del archivo. Para respaldar la tienda, detén el servidor y copia el archivo de esa ruta. Las imágenes del logotipo se guardan en `public/uploads/` y también deben incluirse en las copias.

En un hosting como Render, el sistema de archivos predeterminado puede ser efímero. Para conservar productos, páginas y configuración, configura un disco persistente en el servicio y establece `DATABASE_PATH` en una ruta dentro de ese disco (por ejemplo, `/var/data/cms.sqlite`). El archivo `render.yaml` no crea un disco ni cobra recursos por defecto; no uses el almacenamiento efímero para datos que debas conservar.

## Funcionalidades

- Catálogo público responsivo y precios en soles peruanos.
- Ilustraciones vectoriales originales para audífonos, laptops, mouse, teclados y accesorios.
- Carrito con cantidades, nombre del cliente y nota opcional.
- Envío del detalle del pedido a WhatsApp, sin pasarela de pago.
- Panel con sesión de administrador y gestión de productos activos u ocultos.
- Personalización de la marca, colores, logotipo y teléfono de WhatsApp.
- Gestión de páginas, bloques de contenido y menú de navegación.
- Carga de JPG, PNG, WebP y AVIF de hasta 8 MB; las imágenes se convierten a WebP.
- API de administración protegida con cookie de sesión `httpOnly`.

## API REST

Las rutas de administración requieren la sesión emitida por `POST /api/auth/login`.

| Método | Ruta | Acceso | Uso |
| --- | --- | --- | --- |
| `GET` | `/api/products` | Público / administrador | Listar productos visibles; el administrador también ve los ocultos |
| `POST` | `/api/products` | Administrador | Crear un producto |
| `PUT` | `/api/products/{id}` | Administrador | Actualizar un producto |
| `DELETE` | `/api/products/{id}` | Administrador | Eliminar un producto |
| `POST` | `/api/auth/login` | Público | Validar credenciales e iniciar sesión |
| `POST` | `/api/auth/logout` | Público | Cerrar sesión |
| `GET` | `/api/auth/session` | Sesión | Consultar la sesión actual |
| `GET` / `PATCH` | `/api/site-config` | Público / administrador | Leer o actualizar la marca y el contacto |
| `GET` / `PUT` | `/api/menu` | Público / administrador | Leer o actualizar el menú |
| `GET` / `POST` | `/api/pages` | Público / administrador | Listar páginas o crear un borrador |
| `GET` / `PUT` / `DELETE` | `/api/pages/{id-o-slug}` | Público / administrador | Leer, actualizar o eliminar una página |
| `POST` | `/api/media` | Administrador | Optimizar y guardar una imagen |

## Seguridad

- No publiques `.env.local`, la base SQLite ni copias de seguridad.
- En producción, usa una contraseña de administrador y un `JWT_SECRET` aleatorios de al menos 32 caracteres, además de HTTPS.
- Configura almacenamiento persistente para la base SQLite y para `public/uploads/` al desplegar.
