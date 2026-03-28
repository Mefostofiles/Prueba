# Studio IA (MVP)

Prototipo de aplicación web para editar fotos y videos por prompt de manera **no destructiva**.

## Qué hace este MVP

- Carga una imagen o video.
- Mantiene el original intacto en una vista separada.
- Aplica una capa de ediciones por prompt en la vista editada.
- Guarda historial de operaciones, con deshacer y restaurar.
- Exporta imagen editada (PNG).

## Cómo usar

```bash
python3 -m http.server 8000
```

Luego abre `http://localhost:8000`.

## Ejemplos de prompt

- `sube brillo y contraste`
- `cambia el fondo a playa`
- `pon blanco y negro`
- `cambia ropa a negro`

## Nota profesional

Este proyecto deja la estructura lista para conectar motores de IA reales
(segmentación, inpainting, reemplazo de fondo y edición de video por prompt)
mediante un backend/API sin tocar la lógica no destructiva del front.
