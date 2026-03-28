# Studio IA (MVP mejorado)

Ahora el editor sí genera **resultados reales en imágenes** (procesa píxeles con canvas)
y añade segmentación de persona con IA para operaciones como cambio de fondo/ropa.

## Funcionalidades reales

- Carga imagen o video.
- Imagen: aplica cambios reales sobre los píxeles.
- Cambio de fondo con segmentación de persona (BodyPix + TensorFlow.js).
- Cambio de color de "ropa" (tinte sobre región de persona detectada).
- Ajustes de brillo, contraste, saturación, blanco y negro y vintage.
- Historial, deshacer, restaurar y exportación PNG.

## Cómo ejecutar

```bash
python3 -m http.server 8000
```

Abre `http://localhost:8000`.

## Prompts ejemplo

- `cambia el fondo`
- `cambia el fondo y sube brillo 20`
- `cambia ropa a rojo`
- `sube contraste 25 y saturacion`
- `blanco y negro`

## Nota sobre video

- En video, este MVP mantiene edición de vista previa.
- Para exportación final real de video por prompt se recomienda backend con FFmpeg + modelo IA.
