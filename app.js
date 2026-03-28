const mediaInput = document.getElementById('mediaInput');
const promptInput = document.getElementById('promptInput');
const applyBtn = document.getElementById('applyBtn');
const undoBtn = document.getElementById('undoBtn');
const resetBtn = document.getElementById('resetBtn');
const exportBtn = document.getElementById('exportBtn');

const originalViewer = document.getElementById('originalViewer');
const editedViewer = document.getElementById('editedViewer');
const historyList = document.getElementById('historyList');

const state = {
  file: null,
  type: null,
  objectUrl: null,
  edits: [],
  style: {
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

mediaInput.addEventListener('change', onMediaSelected);
applyBtn.addEventListener('click', onApplyPrompt);
undoBtn.addEventListener('click', undoEdit);
resetBtn.addEventListener('click', resetAll);
exportBtn.addEventListener('click', exportEdited);

function onMediaSelected(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  cleanupObjectUrl();
  state.file = file;
  state.type = file.type.startsWith('video') ? 'video' : 'image';
  state.objectUrl = URL.createObjectURL(file);
  state.edits = [];
  resetStyle();

  renderOriginal();
  renderEdited();
  renderHistory();
}

function onApplyPrompt() {
  if (!state.file) {
    alert('Primero sube una imagen o video.');
    return;
  }

  const prompt = promptInput.value.trim();
  if (!prompt) {
    alert('Escribe una instrucción de edición.');
    return;
  }

  const instructions = parsePrompt(prompt);
  instructions.forEach((i) => applyInstruction(i));
  state.edits.push(prompt);

  renderEdited();
  renderHistory();
  promptInput.value = '';
}

function parsePrompt(prompt) {
  const p = prompt.toLowerCase();
  const instructions = [];

  if (p.includes('brillo')) instructions.push({ type: 'brightness', value: 1.15 });
  if (p.includes('menos brillo')) instructions.push({ type: 'brightness', value: 0.9 });
  if (p.includes('contraste')) instructions.push({ type: 'contrast', value: 1.15 });
  if (p.includes('satur')) instructions.push({ type: 'saturate', value: 1.2 });
  if (p.includes('blanco y negro')) instructions.push({ type: 'grayscale', value: 1 });
  if (p.includes('vintage')) instructions.push({ type: 'sepia', value: 0.75 });
  if (p.includes('desenfo')) instructions.push({ type: 'blur', value: 1.5 });
  if (p.includes('fondo')) {
    if (p.includes('playa')) instructions.push({ type: 'background', value: 'linear-gradient(120deg,#5ac8fa,#0060c8)' });
    else if (p.includes('negro')) instructions.push({ type: 'background', value: '#121212' });
    else if (p.includes('blanco')) instructions.push({ type: 'background', value: '#f3f3f3' });
    else instructions.push({ type: 'background', value: '#29335c' });
  }
  if (p.includes('ropa')) {
    // Placeholder: para una IA real se haría segmentación por máscara + inpainting.
    instructions.push({ type: 'hueRotate', value: 35 });
  }

  if (!instructions.length) {
    instructions.push({ type: 'brightness', value: 1.05 });
  }

  return instructions;
}

function applyInstruction(instruction) {
  switch (instruction.type) {
    case 'brightness':
      state.style.brightness *= instruction.value;
      break;
    case 'contrast':
      state.style.contrast *= instruction.value;
      break;
    case 'saturate':
      state.style.saturate *= instruction.value;
      break;
    case 'hueRotate':
      state.style.hueRotate += instruction.value;
      break;
    case 'blur':
      state.style.blur += instruction.value;
      break;
    case 'grayscale':
      state.style.grayscale = Math.max(state.style.grayscale, instruction.value);
      break;
    case 'sepia':
      state.style.sepia = Math.max(state.style.sepia, instruction.value);
      break;
    case 'background':
      state.style.background = instruction.value;
      break;
    default:
      break;
  }
}

function buildMediaElement(readonly = false) {
  if (state.type === 'video') {
    const video = document.createElement('video');
    video.src = state.objectUrl;
    video.controls = true;
    video.loop = true;
    video.muted = readonly;
    return video;
  }

  const image = document.createElement('img');
  image.src = state.objectUrl;
  image.alt = readonly ? 'Archivo original' : 'Archivo editado';
  return image;
}

function renderOriginal() {
  originalViewer.classList.remove('empty');
  originalViewer.innerHTML = '';
  originalViewer.appendChild(buildMediaElement(true));
}

function renderEdited() {
  editedViewer.classList.remove('empty');
  editedViewer.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.style.width = '100%';
  wrapper.style.height = '100%';
  wrapper.style.background = state.style.background;
  wrapper.style.display = 'flex';
  wrapper.style.alignItems = 'center';
  wrapper.style.justifyContent = 'center';
  wrapper.style.borderRadius = '10px';

  const media = buildMediaElement(false);
  media.style.filter = [
    `brightness(${state.style.brightness})`,
    `contrast(${state.style.contrast})`,
    `saturate(${state.style.saturate})`,
    `hue-rotate(${state.style.hueRotate}deg)`,
    `blur(${state.style.blur}px)`,
    `grayscale(${state.style.grayscale})`,
    `sepia(${state.style.sepia})`
  ].join(' ');

  wrapper.appendChild(media);
  editedViewer.appendChild(wrapper);
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

function undoEdit() {
  if (!state.edits.length) return;
  state.edits.pop();
  rebuildStyleFromHistory();
  renderEdited();
  renderHistory();
}

function resetAll() {
  if (!state.file) return;
  state.edits = [];
  resetStyle();
  renderEdited();
  renderHistory();
}

function rebuildStyleFromHistory() {
  resetStyle();
  state.edits.forEach((prompt) => {
    parsePrompt(prompt).forEach((i) => applyInstruction(i));
  });
}

function resetStyle() {
  state.style = {
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

async function exportEdited() {
  if (!state.file) {
    alert('No hay archivo para exportar.');
    return;
  }

  if (state.type === 'video') {
    alert('Exportación de video no está implementada en este MVP.');
    return;
  }

  const img = new Image();
  img.src = state.objectUrl;

  await img.decode();

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');

  if (state.style.background !== 'transparent') {
    ctx.fillStyle = '#20242f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.filter = [
    `brightness(${state.style.brightness})`,
    `contrast(${state.style.contrast})`,
    `saturate(${state.style.saturate})`,
    `hue-rotate(${state.style.hueRotate}deg)`,
    `blur(${state.style.blur}px)`,
    `grayscale(${state.style.grayscale})`,
    `sepia(${state.style.sepia})`
  ].join(' ');

  ctx.drawImage(img, 0, 0);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.file.name.replace(/\.[^.]+$/, '')}-editado.png`;
  a.click();
  URL.revokeObjectURL(url);
}

function cleanupObjectUrl() {
  if (state.objectUrl) {
    URL.revokeObjectURL(state.objectUrl);
  }
}

window.addEventListener('beforeunload', cleanupObjectUrl);
