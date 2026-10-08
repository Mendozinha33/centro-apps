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
