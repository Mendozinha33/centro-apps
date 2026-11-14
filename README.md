# Apps Mendoza — Centro de aplicaciones

Página de inicio con el listado de las aplicaciones propias.
Es una única página (`index.html`) sin nada que instalar ni compilar.

Para añadir una aplicación nueva, se añade su bloque a la lista `APLICACIONES`
que hay dentro de `index.html`: nombre, categoría, estado, acceso, dirección,
resumen y los puntos de "qué puedes hacer con ella".

## Mis Excel (`/excel`)

Nube personal de ficheros de Excel, con la misma cuenta que Mi calendario.

- `api/excel.js`: carpetas, ficheros y versiones (tablas `excel_carpetas`, `excel_ficheros`,
  `excel_versiones`, que se crean solas). Los ficheros se suben y bajan tal cual (sin base64),
  hasta 4 MB, y se guardan las 10 últimas versiones de cada uno.
- `excel/motor.js`: abre, recalcula y guarda. Lee con SheetJS, recalcula con HyperFormula
  (licencia GPL v3, uso personal) y al guardar **solo reescribe las celdas cambiadas** dentro del
  .xlsx original, así que gráficos, tablas, formatos y macros no se tocan. Los .xls se ven pero no
  se editan; los .csv se guardan con su mismo separador y codificación.
- `excel/lib/`: las tres librerías, servidas desde aquí mismo (SheetJS 0.18.5, HyperFormula 3.4.0,
  fflate). No dependen de webs de terceros.
- `excel/pdf.js`: «PDF a Excel». Lee el texto del PDF en el navegador con pdf.js (`excel/lib/pdf.min.js`,
  versión 3.11.174 legacy), lo coloca en filas y columnas según su posición y crea un .xlsx con los
  importes, porcentajes y fechas como números. El PDF no se guarda; solo el Excel resultante.
  Los PDF escaneados (una imagen, sin texto) no se pueden convertir y la app lo avisa.

## Mis vídeos (`/videos`)

Poner logos y fotos encima de un vídeo para subirlo a redes sociales, con la misma cuenta que Mi calendario.

- `api/imagenes.js`: la biblioteca «Mis imágenes» (tabla `video_imagenes`, se crea sola). Imágenes PNG, JPG,
  WEBP o GIF de hasta 3 MB; la app las reduce antes de subirlas (2000 px por el lado largo) y conserva la
  transparencia de los logos. Cada imagen tiene nombre y grupo.
- `videos/index.html`: el editor. El vídeo **no se sube al servidor**: se prepara en el navegador con
  Mediabunny (`videos/lib/mediabunny.min.mjs`, versión 1.65.1, licencia MPL 2.0), que lee el vídeo,
  dibuja los logos en cada fotograma y crea un MP4 (H.264 + AAC). Los vídeos girados del móvil se
  enderezan antes de poner los logos. La vista previa usa la misma cuenta de posiciones (`caja()`) que el
  vídeo final. Lo último que se puso en el vídeo se recuerda en ese navegador para el siguiente.
- Necesita Chrome, Edge o Safari actualizados (WebCodecs).

### Mis vídeos: música de fondo y varias imágenes (noviembre 2026)

- Varias imágenes a la vez: en «Añadir logos o fotos» se tocan las que se quieran y «Añadir las N».
- Música de fondo: 6 canciones propias en `videos/musica/*.mp3`, creadas por programa para esta app
  (sin grabaciones ni muestras de terceros), y canciones subidas por el usuario, que se guardan solo en
  el navegador de ese aparato (IndexedDB `mis_videos`). Volumen de la música, volumen del sonido del
  vídeo, segundo de inicio y entrada/salida suave. La canción se repite si el vídeo es más largo.
- Al preparar el vídeo, el sonido se mezcla aparte (OfflineAudioContext) y se añade como pista AAC.
  Si el navegador no sabe crear AAC se usa `videos/lib/mediabunny-aac-encoder.min.mjs`
  (@mediabunny/aac-encoder 1.66.0, MPL 2.0, basado en el codificador AAC de FFmpeg, LGPL 2.1;
  licencias en `videos/lib/licencias/`). Mediabunny actualizado a 1.66.0; se carga con un importmap.
- Arreglo: la librería se cargaba con una ruta relativa que fallaba al entrar por `/videos` sin barra final.

## Usuarios (`/usuarios`)

Botón «Usuarios» en la cabecera del centro. El titular (la primera cuenta, la que tiene la columna
`titular` vacía) da de alta a otras personas con su correo y una contraseña provisional, les pone una
contraseña nueva o las da de baja. Cualquiera puede cambiar su propia contraseña.

- Los usuarios dados de alta **comparten los datos del titular** en todas las apps: su pase de sesión
  lleva `id` = id del titular (con el que trabajan todas las funciones de `/api`) y `persona` = su propio id.
- `lib/comun.js`: `prepararUsuarios()` añade las columnas `titular` y `alta` a `usuarios` (se hace solo);
  `quienEsVivo()` comprueba que la persona sigue existiendo (con una memoria de 60 s), así que una baja
  corta el acceso en menos de un minuto. Todas las funciones de `/api` lo usan.
- `api/acceso.js`: acciones `usuarios`, `alta`, `baja` y `nuevaClave` (solo el titular).
- El Archivo de nóminas tiene su propio acceso y no cambia.
