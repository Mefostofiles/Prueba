const mediaInput = document.getElementById('mediaInput');
const backgroundInput = document.getElementById('backgroundInput');
const promptInput = document.getElementById('promptInput');
const applyBtn = document.getElementById('applyBtn');
const undoBtn = document.getElementById('undoBtn');
const resetBtn = document.getElementById('resetBtn');
const exportBtn = document.getElementById('exportBtn');
const statusText = document.getElementById('statusText');

const originalViewer = document.getElementById('originalViewer');
const editedViewer = document.getElementById('editedViewer');
const historyList = document.getElementById('historyList');

const state = {
  file: null,
  type: null,
  objectUrl: null,
  backgroundFile: null,
  backgroundUrl: null,
  edits: [],
  imageBaseData: null,
  currentImageData: null,
  videoStyle: {
    brightness: 1,
    contrast: 1,
    saturate: 1,
    hueRotate: 0,
    blur: 0,
    grayscale: 0,
    sepia: 0,
    background: 'transparent'
  }
};

let bodyPixNet = null;

mediaInput.addEventListener('change', onMediaSelected);
backgroundInput.addEventListener('change', onBackgroundSelected);
applyBtn.addEventListener('click', onApplyPrompt);
undoBtn.addEventListener('click', undoEdit);
resetBtn.addEventListener('click', resetAll);
exportBtn.addEventListener('click', exportEdited);

function setStatus(text) {
  statusText.textContent = text;
}

async function onMediaSelected(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  cleanupObjectUrls();
  state.file = file;
  state.type = file.type.startsWith('video') ? 'video' : 'image';
  state.objectUrl = URL.createObjectURL(file);
  state.edits = [];
  resetVideoStyle();

  if (state.type === 'image') {
    await initializeImageBuffers();
  }

  renderOriginal();
  await renderEdited();
  renderHistory();
  setStatus(`Archivo cargado: ${file.name}`);
}

function onBackgroundSelected(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (state.backgroundUrl) URL.revokeObjectURL(state.backgroundUrl);

  state.backgroundFile = file;
  state.backgroundUrl = URL.createObjectURL(file);
  setStatus(`Fondo cargado: ${file.name}`);
}

async function initializeImageBuffers() {
  const img = await loadImage(state.objectUrl);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  state.imageBaseData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  state.currentImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
}

async function onApplyPrompt() {
  if (!state.file) {
    alert('Primero sube una imagen o video.');
    return;
  }

  const prompt = promptInput.value.trim();
  if (!prompt) {
    alert('Escribe una instrucción de edición.');
    return;
  }

  state.edits.push(prompt);
  await rebuildFromHistory();
  await renderEdited();
  renderHistory();
  promptInput.value = '';
}

async function rebuildFromHistory() {
  if (state.type === 'image') {
    state.currentImageData = new ImageData(
      new Uint8ClampedArray(state.imageBaseData.data),
      state.imageBaseData.width,
      state.imageBaseData.height
    );

    for (const prompt of state.edits) {
      await applyImagePrompt(prompt);
    }

    setStatus('Edición aplicada sobre píxeles reales.');
    return;
  }

  resetVideoStyle();
  for (const prompt of state.edits) {
    applyVideoPrompt(prompt);
  }
  setStatus('Video: vista previa actualizada (render final en siguiente fase).');
}

function parsePercent(prompt, keyword, fallback = 15) {
  const regex = new RegExp(`${keyword}\\s*(\\d{1,3})`, 'i');
  const match = prompt.match(regex);
  return match ? Number(match[1]) : fallback;
}

async function applyImagePrompt(prompt) {
  const p = prompt.toLowerCase();

  if (p.includes('fondo') && p.includes('cambia')) {
    await applyBackgroundReplacement();
  }

  if (p.includes('ropa') && p.includes('cambia')) {
    const color = detectColor(p);
    await recolorPerson(color);
  }

  if (p.includes('brillo')) {
    const amount = parsePercent(prompt, 'brillo', 15);
    applyFilter((r, g, b) => [r + (255 * amount) / 100, g + (255 * amount) / 100, b + (255 * amount) / 100]);
  }

  if (p.includes('contraste')) {
    const amount = parsePercent(prompt, 'contraste', 20);
    const factor = (259 * (amount + 255)) / (255 * (259 - amount));
    applyFilter((r, g, b) => [
      factor * (r - 128) + 128,
      factor * (g - 128) + 128,
      factor * (b - 128) + 128
    ]);
  }

  if (p.includes('satur')) {
    applySaturation(1.25);
  }

  if (p.includes('blanco y negro')) {
    applyFilter((r, g, b) => {
      const y = 0.299 * r + 0.587 * g + 0.114 * b;
      return [y, y, y];
    });
  }

  if (p.includes('vintage')) {
    applySepia();
  }
}

function applyVideoPrompt(prompt) {
  const p = prompt.toLowerCase();
  if (p.includes('brillo')) state.videoStyle.brightness *= 1.15;
  if (p.includes('contraste')) state.videoStyle.contrast *= 1.15;
  if (p.includes('satur')) state.videoStyle.saturate *= 1.2;
  if (p.includes('blanco y negro')) state.videoStyle.grayscale = 1;
  if (p.includes('vintage')) state.videoStyle.sepia = 0.75;
  if (p.includes('desenfo')) state.videoStyle.blur += 1.5;
  if (p.includes('ropa')) state.videoStyle.hueRotate += 35;
}

function applyFilter(transform) {
  const data = state.currentImageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = transform(data[i], data[i + 1], data[i + 2]);
    data[i] = clamp255(r);
    data[i + 1] = clamp255(g);
    data[i + 2] = clamp255(b);
  }
}

function applySaturation(factor) {
  applyFilter((r, g, b) => {
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    return [
      gray + (r - gray) * factor,
      gray + (g - gray) * factor,
      gray + (b - gray) * factor
    ];
  });
}

function applySepia() {
  applyFilter((r, g, b) => [
    0.393 * r + 0.769 * g + 0.189 * b,
    0.349 * r + 0.686 * g + 0.168 * b,
    0.272 * r + 0.534 * g + 0.131 * b
  ]);
}

async function applyBackgroundReplacement() {
  const personMask = await getPersonMask();
  if (!personMask) {
    setStatus('No se detectó persona para reemplazo de fondo.');
    return;
  }

  const width = state.currentImageData.width;
  const height = state.currentImageData.height;
  let bgPixels = null;

  if (state.backgroundUrl) {
    const bg = await loadImage(state.backgroundUrl);
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = width;
    bgCanvas.height = height;
    const bgCtx = bgCanvas.getContext('2d');
    bgCtx.drawImage(bg, 0, 0, width, height);
    bgPixels = bgCtx.getImageData(0, 0, width, height).data;
  }

  const data = state.currentImageData.data;
  for (let i = 0; i < personMask.length; i += 1) {
    const pixelIndex = i * 4;
    const isPerson = personMask[i] === 1;
    if (isPerson) continue;

    if (bgPixels) {
      data[pixelIndex] = bgPixels[pixelIndex];
      data[pixelIndex + 1] = bgPixels[pixelIndex + 1];
      data[pixelIndex + 2] = bgPixels[pixelIndex + 2];
      data[pixelIndex + 3] = 255;
    } else {
      data[pixelIndex] = 32;
      data[pixelIndex + 1] = 36;
      data[pixelIndex + 2] = 48;
      data[pixelIndex + 3] = 255;
    }
  }
}

async function recolorPerson(hexColor) {
  const personMask = await getPersonMask();
  if (!personMask) {
    setStatus('No se detectó persona para cambio de ropa/color.');
    return;
  }

  const tint = hexToRgb(hexColor);
  const data = state.currentImageData.data;

  for (let i = 0; i < personMask.length; i += 1) {
    if (personMask[i] !== 1) continue;
    const px = i * 4;
    data[px] = clamp255(data[px] * 0.45 + tint.r * 0.55);
    data[px + 1] = clamp255(data[px + 1] * 0.45 + tint.g * 0.55);
    data[px + 2] = clamp255(data[px + 2] * 0.45 + tint.b * 0.55);
  }
}

async function getPersonMask() {
  try {
    if (!bodyPixNet) {
      setStatus('Cargando modelo IA de segmentación...');
      bodyPixNet = await bodyPix.load();
    }

    const imageElement = await imageDataToImage(state.currentImageData);
    const segmentation = await bodyPixNet.segmentPerson(imageElement, {
      internalResolution: 'medium',
      segmentationThreshold: 0.7
    });
    return segmentation.data;
  } catch (error) {
    console.error(error);
    setStatus('No se pudo usar el modelo IA (revisa conexión/CDN).');
    return null;
  }
}

function renderOriginal() {
  originalViewer.classList.remove('empty');
  originalViewer.innerHTML = '';

  if (state.type === 'video') {
    const video = document.createElement('video');
    video.src = state.objectUrl;
    video.controls = true;
    originalViewer.appendChild(video);
    return;
  }

  const img = document.createElement('img');
  img.src = state.objectUrl;
  img.alt = 'Original';
  originalViewer.appendChild(img);
}

async function renderEdited() {
  editedViewer.classList.remove('empty');
  editedViewer.innerHTML = '';

  if (state.type === 'video') {
    const wrapper = document.createElement('div');
    wrapper.style.width = '100%';
    wrapper.style.height = '100%';
    wrapper.style.background = state.videoStyle.background;

    const video = document.createElement('video');
    video.src = state.objectUrl;
    video.controls = true;
    video.style.filter = [
      `brightness(${state.videoStyle.brightness})`,
      `contrast(${state.videoStyle.contrast})`,
      `saturate(${state.videoStyle.saturate})`,
      `hue-rotate(${state.videoStyle.hueRotate}deg)`,
      `blur(${state.videoStyle.blur}px)`,
      `grayscale(${state.videoStyle.grayscale})`,
      `sepia(${state.videoStyle.sepia})`
    ].join(' ');

    wrapper.appendChild(video);
    editedViewer.appendChild(wrapper);
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.width = state.currentImageData.width;
  canvas.height = state.currentImageData.height;
  const ctx = canvas.getContext('2d');
  ctx.putImageData(state.currentImageData, 0, 0);
  editedViewer.appendChild(canvas);
}

function renderHistory() {
  historyList.innerHTML = '';
  if (!state.edits.length) {
    const li = document.createElement('li');
    li.textContent = 'Sin ediciones aplicadas.';
    historyList.appendChild(li);
    return;
  }

  state.edits.forEach((edit, index) => {
    const li = document.createElement('li');
    li.textContent = `${index + 1}. ${edit}`;
    historyList.appendChild(li);
  });
}

async function undoEdit() {
  if (!state.edits.length) return;
  state.edits.pop();
  await rebuildFromHistory();
  await renderEdited();
  renderHistory();
}

async function resetAll() {
  if (!state.file) return;
  state.edits = [];
  if (state.type === 'image') {
    state.currentImageData = new ImageData(
      new Uint8ClampedArray(state.imageBaseData.data),
      state.imageBaseData.width,
      state.imageBaseData.height
    );
  } else {
    resetVideoStyle();
  }

  await renderEdited();
  renderHistory();
  setStatus('Restaurado al original.');
}

async function exportEdited() {
  if (!state.file) {
    alert('No hay archivo para exportar.');
    return;
  }

  if (state.type === 'video') {
    alert('Exportación de video requiere backend/FFmpeg (siguiente fase).');
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.width = state.currentImageData.width;
  canvas.height = state.currentImageData.height;
  const ctx = canvas.getContext('2d');
  ctx.putImageData(state.currentImageData, 0, 0);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.file.name.replace(/\.[^.]+$/, '')}-editado-real.png`;
  a.click();
  URL.revokeObjectURL(url);

  setStatus('Imagen exportada con cambios reales.');
}

function detectColor(text) {
  if (text.includes('rojo')) return '#d7263d';
  if (text.includes('azul')) return '#2f6df6';
  if (text.includes('verde')) return '#2cb67d';
  if (text.includes('negro')) return '#1d1d1d';
  if (text.includes('blanco')) return '#f5f5f5';
  return '#7f5af0';
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const num = Number.parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

function clamp255(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function resetVideoStyle() {
  state.videoStyle = {
    brightness: 1,
    contrast: 1,
    saturate: 1,
    hueRotate: 0,
    blur: 0,
    grayscale: 0,
    sepia: 0,
    background: 'transparent'
  };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function imageDataToImage(imageData) {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d');
  ctx.putImageData(imageData, 0, 0);
  return loadImage(canvas.toDataURL('image/png'));
}

function cleanupObjectUrls() {
  if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
  if (state.backgroundUrl) URL.revokeObjectURL(state.backgroundUrl);
}

window.addEventListener('beforeunload', cleanupObjectUrls);
