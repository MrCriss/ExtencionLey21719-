# Auditor Ley 21.719 (v0.2.0)

Extensión de Chrome (Manifest V3) que revisa el sitio abierto y señala alertas visibles frente a la Ley 21.719.
Todo se analiza localmente; no se envía nada a servidores.

## Qué hace
- Revisa 19 puntos y muestra cada uno como **Alerta**, **Por revisar**, **Sin hallazgos** o **No aplica**.
- En cada mensaje indica **dónde se genera** (pie de página, `<head>`, formulario, aviso de cookies…), la ruta CSS del elemento y un botón **«Ver en la página»** que lo resalta.
- Para alertas y puntos por revisar, lista **posibles soluciones**.
- Lee la política de datos (si es del mismo sitio) y busca los 15 puntos del art. 14 ter (letras a–l).
- Lista 13 obligaciones **de verificación manual** que no se ven desde el navegador (art. 14 sexies, 15 ter, 15 bis, etc.).
- **Descargar PDF** y **Descargar JSON** del informe.

## Instalar para probar
1. Descomprime la carpeta.
2. Abre `chrome://extensions` y activa «Modo desarrollador».
3. Pulsa «Cargar descomprimida» y elige la carpeta.
4. Abre un sitio, haz clic en el ícono de la extensión; el análisis corre solo. «Volver a analizar» lo repite.

## Estructura
- `rules.json`: reglas (área, artículo, título, soluciones), puntos de la política, puntos manuales y nota de vigencia.
- `scanner.js`: lee la página (enlaces, formularios, rastreadores, cookies, política) y devuelve hechos con su ubicación.
- `checks.js`: convierte los hechos en resultados (estado, detalle, ubicaciones, soluciones).
- `pdf.js`: generador de PDF sin dependencias.
- `popup.html/css/js`: interfaz, resaltado en la página y descargas.

## Verificación contra la ley
Artículos contrastados con el texto oficial (Diario Oficial N° 44.023, 13-12-2024, CVE 2583630). Los artículos son los de la Ley 19.628 tal como los reemplaza el artículo primero de la Ley 21.719.

| Regla | Artículos |
|---|---|
| Enlace y contenido de la política | 14 ter (a–l), 3 g |
| Responsable, contacto, derechos | 14 ter (b, c, f, g), 4, 10, 11, 34 bis b |
| Rastreadores, aviso de cookies | 12 |
| Publicidad y perfiles | 8 b, 8 bis, 14 ter l |
| Contenido de terceros, transferencia internacional | 12, 15 bis, 27, 28, 14 ter h |
| Formularios | 12, 14 ter, 14 quáter, 3 c, 15 bis |
| Datos sensibles, salud, biométricos | 2 g, 16, 16 bis, 16 ter |
| Menores | 16 quáter |
| Geolocalización | 16 sexies |
| HTTPS | 14 quinquies, 3 f |

## Vigencia
El texto publicado fija la vigencia el 1 dic 2026. El Congreso despachó el 17 nov 2026 un proyecto que la posterga al 15 oct 2027; solo produce efecto al publicarse. Verifica su estado en LeyChile o el Diario Oficial.

## Límites
Es una revisión por estructura y palabras clave: puede dar falsos positivos y negativos. No certifica cumplimiento legal. No ve base de licitud, contratos, seguridad interna ni registros. No ve formularios enviados solo con JavaScript, ni avisos de cookies dentro de iframes o shadow DOM. No aplica el régimen diferenciado para pymes (art. 14 septies), que fijará la Agencia.

## Antes de publicar en la Chrome Web Store
Agrega una política de privacidad y una licencia (MIT o Apache 2.0).
