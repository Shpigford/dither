import { ditherImage, generateSvg, generateGradientGrid, PRESETS } from '../core/index.js';

// ============================================================
// STATE
// ============================================================
let sourceImage = null;
let luminanceGrid = null;
let gridCols = 0, gridRows = 0;
let isGeneratedSource = false;

let currentPalette = ['#000000', '#ffffff'];
let currentPercentages = [50, 50];

// ============================================================
// DOM REFS
// ============================================================
const $ = id => document.getElementById(id);

// ============================================================
// IMAGE LOADER
// ============================================================
function loadImage(file) {
  const img = new Image();
  img.onload = () => {
    sourceImage = img;
    isGeneratedSource = false;
    processImage();
  };
  img.src = URL.createObjectURL(file);
}

function processImage() {
  if (!sourceImage) return;

  const cellSize = parseInt($('cellSize').value);
  gridCols = Math.ceil(sourceImage.width / cellSize);
  gridRows = Math.ceil(sourceImage.height / cellSize);

  const tmpCanvas = document.createElement('canvas');
  tmpCanvas.width = sourceImage.width;
  tmpCanvas.height = sourceImage.height;
  const ctx = tmpCanvas.getContext('2d');
  ctx.drawImage(sourceImage, 0, 0);
  const imageData = ctx.getImageData(0, 0, sourceImage.width, sourceImage.height);
  const data = imageData.data;

  luminanceGrid = new Array(gridRows);
  for (let gy = 0; gy < gridRows; gy++) {
    luminanceGrid[gy] = new Array(gridCols);
    for (let gx = 0; gx < gridCols; gx++) {
      let totalLum = 0;
      let count = 0;
      const startX = gx * cellSize;
      const startY = gy * cellSize;
      const endX = Math.min(startX + cellSize, sourceImage.width);
      const endY = Math.min(startY + cellSize, sourceImage.height);

      for (let py = startY; py < endY; py++) {
        for (let px = startX; px < endX; px++) {
          const i = (py * sourceImage.width + px) * 4;
          const lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
          totalLum += lum;
          count++;
        }
      }
      luminanceGrid[gy][gx] = count > 0 ? totalLum / count : 0;
    }
  }

  showCanvas();
  render();
}

// ============================================================
// GRADIENT GENERATOR
// ============================================================
function getGradientDimensions() {
  const w = parseInt($('gradientWidth').value);
  const ratio = $('aspectRatio').value;
  if (ratio === 'custom') return { w, h: parseInt($('gradientHeight').value) };
  const [rw, rh] = ratio.split(':').map(Number);
  return { w, h: Math.round(w * rh / rw) };
}

function doGenerateGradient() {
  const type = $('gradientType').value;
  const { w, h } = getGradientDimensions();
  const cellSize = parseInt($('cellSize').value);
  const angle = parseInt($('gradAngle').value);

  const result = generateGradientGrid(type, w, cellSize, h, angle);
  luminanceGrid = result.grid;
  gridCols = result.cols;
  gridRows = result.rows;
  sourceImage = { width: w, height: h };
  isGeneratedSource = true;

  showCanvas();
  render();
}

function showCanvas() {
  $('dropZone').classList.add('has-image');
  $('preview').style.display = 'block';
}

// ============================================================
// CANVAS RENDERER
// ============================================================
function render() {
  if (!luminanceGrid) return;

  const settings = getSettings();
  const cellSize = settings.cellSize;
  const dithered = ditherImage(luminanceGrid, gridCols, gridRows, settings);

  const canvas = $('preview');
  const width = gridCols * cellSize;
  const height = gridRows * cellSize;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = settings.palette[settings.palette.length - 1];
  ctx.fillRect(0, 0, width, height);

  for (let y = 0; y < gridRows; y++) {
    for (let x = 0; x < gridCols; x++) {
      const cell = dithered[y][x];
      if (cell.colorIndex === settings.palette.length - 1) continue;

      const cx = x * cellSize + cellSize / 2;
      const cy = y * cellSize + cellSize / 2;

      ctx.fillStyle = settings.palette[cell.colorIndex];

      if (settings.style === 'scaled') {
        if (cell.size < 0.01) continue;
        drawShape(ctx, settings.shape, cx, cy, cellSize, cell.size);
      } else {
        drawShape(ctx, settings.shape, cx, cy, cellSize, 1.0);
      }
    }
  }
}

function drawShape(ctx, shape, cx, cy, cellSize, sizeFactor) {
  const half = (cellSize / 2) * sizeFactor;
  if (half < 0.5) return;

  switch (shape) {
    case 'circle':
      ctx.beginPath();
      ctx.arc(cx, cy, half, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'square':
      ctx.fillRect(cx - half, cy - half, half * 2, half * 2);
      break;
    case 'diamond':
      ctx.beginPath();
      ctx.moveTo(cx, cy - half);
      ctx.lineTo(cx + half, cy);
      ctx.lineTo(cx, cy + half);
      ctx.lineTo(cx - half, cy);
      ctx.closePath();
      ctx.fill();
      break;
  }
}

// ============================================================
// SETTINGS
// ============================================================
function getSettings() {
  return {
    pattern: $('patternType').value,
    mode: $('ditherMode').value,
    style: $('ditherStyle').value,
    shape: $('shapeType').value,
    cellSize: parseInt($('cellSize').value),
    angle: parseInt($('angle').value),
    scale: parseInt($('scale').value),
    offsetX: parseInt($('offsetX').value),
    offsetY: parseInt($('offsetY').value),
    palette: [...currentPalette],
    percentages: [...currentPercentages]
  };
}

// ============================================================
// PALETTE
// ============================================================
function buildPaletteUI() {
  const container = $('paletteEntries');
  const count = parseInt($('colorCount').value);

  while (currentPalette.length < count) {
    const gray = Math.round((currentPalette.length / count) * 255);
    const hex = '#' + gray.toString(16).padStart(2, '0').repeat(3);
    currentPalette.push(hex);
    currentPercentages.push(Math.round(100 / count));
  }
  currentPalette.length = count;
  currentPercentages.length = count;
  normalizePercentages();

  container.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const entry = document.createElement('div');
    entry.className = 'palette-entry';

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = currentPalette[i];
    colorInput.dataset.index = i;
    colorInput.addEventListener('input', e => {
      currentPalette[parseInt(e.target.dataset.index)] = e.target.value;
      e.target.nextElementSibling.value = e.target.value;
      render();
    });

    const hexInput = document.createElement('input');
    hexInput.type = 'text';
    hexInput.value = currentPalette[i];
    hexInput.dataset.index = i;
    hexInput.addEventListener('change', e => {
      const val = e.target.value;
      if (/^#[0-9a-fA-F]{6}$/.test(val)) {
        const idx = parseInt(e.target.dataset.index);
        currentPalette[idx] = val;
        e.target.previousElementSibling.value = val;
        render();
      }
    });

    const pctSlider = document.createElement('input');
    pctSlider.type = 'range';
    pctSlider.min = 5;
    pctSlider.max = 90;
    pctSlider.value = currentPercentages[i];
    pctSlider.dataset.index = i;
    pctSlider.addEventListener('input', e => {
      const idx = parseInt(e.target.dataset.index);
      currentPercentages[idx] = parseInt(e.target.value);
      normalizePercentages(idx);
      updatePctLabels();
      render();
    });

    const pctLabel = document.createElement('span');
    pctLabel.className = 'pct-val';
    pctLabel.textContent = currentPercentages[i] + '%';

    entry.appendChild(colorInput);
    entry.appendChild(hexInput);
    entry.appendChild(pctSlider);
    entry.appendChild(pctLabel);
    container.appendChild(entry);
  }
}

function normalizePercentages(changedIdx) {
  const n = currentPercentages.length;
  if (changedIdx !== undefined) {
    const fixed = currentPercentages[changedIdx];
    const remaining = 100 - fixed;
    const others = [];
    let othersSum = 0;
    for (let i = 0; i < n; i++) {
      if (i !== changedIdx) {
        others.push(i);
        othersSum += currentPercentages[i];
      }
    }
    if (othersSum > 0) {
      for (const i of others) {
        currentPercentages[i] = Math.max(5, Math.round((currentPercentages[i] / othersSum) * remaining));
      }
    }
  }

  const sum = currentPercentages.reduce((a, b) => a + b, 0);
  if (sum !== 100 && n > 0) {
    currentPercentages[n - 1] += 100 - sum;
  }
}

function updatePctLabels() {
  const entries = document.querySelectorAll('.palette-entry');
  entries.forEach((entry, i) => {
    const slider = entry.querySelector('input[type="range"]');
    const label = entry.querySelector('.pct-val');
    if (slider && label) {
      slider.value = currentPercentages[i];
      label.textContent = currentPercentages[i] + '%';
    }
  });
}

function applyPreset(name) {
  const preset = PRESETS[name];
  if (!preset) return;
  currentPalette = [...preset.colors];
  currentPercentages = [...preset.percentages];
  $('colorCount').value = preset.colors.length;
  buildPaletteUI();
  render();
}

// ============================================================
// EXPORT
// ============================================================
function exportSvg() {
  const svg = generateSvg(luminanceGrid, gridCols, gridRows, getSettings());
  if (!svg) return;
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'dither.svg';
  a.click();
  URL.revokeObjectURL(url);
}

function exportPng() {
  const canvas = $('preview');
  if (!canvas.width) return;
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = 'dither.png';
  a.click();
}

// ============================================================
// UI WIRING
// ============================================================
function updateVisibility() {
  const mode = $('ditherMode').value;
  $('angleRow').classList.toggle('hidden', mode !== 'linear');
  $('scaleRow').classList.toggle('hidden', mode !== 'radial');
  $('offsetXRow').classList.toggle('hidden', mode !== 'radial');
  $('offsetYRow').classList.toggle('hidden', mode !== 'radial');
}

function updateSliderLabels() {
  $('cellSizeVal').textContent = $('cellSize').value;
  $('angleVal').textContent = $('angle').value + '\u00B0';
  $('scaleVal').textContent = (parseInt($('scale').value) / 100).toFixed(1);
  $('offsetXVal').textContent = $('offsetX').value;
  $('offsetYVal').textContent = $('offsetY').value;
}

function init() {
  // File loading
  $('loadBtn').addEventListener('click', () => $('fileInput').click());
  $('fileInput').addEventListener('change', e => {
    if (e.target.files[0]) loadImage(e.target.files[0]);
  });

  // Gradient controls — auto-regenerate on any change
  $('generateBtn').addEventListener('click', doGenerateGradient);
  for (const id of ['gradientType', 'aspectRatio', 'gradAngle', 'gradientWidth', 'gradientHeight']) {
    $(id).addEventListener('input', () => {
      // Update labels
      $('gradientWidthVal').textContent = $('gradientWidth').value;
      $('gradientHeightVal').textContent = $('gradientHeight').value;
      $('gradAngleVal').textContent = $('gradAngle').value + '\u00B0';
      // Toggle visibility
      $('heightRow').classList.toggle('hidden', $('aspectRatio').value !== 'custom');
      const gt = $('gradientType').value;
      $('gradAngleRow').classList.toggle('hidden', gt === 'noise' || gt === 'radial');
      // Auto-regenerate if we're in gradient mode
      if (isGeneratedSource || !sourceImage) doGenerateGradient();
    });
  }

  // Drag and drop
  const area = $('canvasArea');
  area.addEventListener('dragover', e => {
    e.preventDefault();
    area.classList.add('drag-over');
  });
  area.addEventListener('dragleave', () => area.classList.remove('drag-over'));
  area.addEventListener('drop', e => {
    e.preventDefault();
    area.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) loadImage(e.dataTransfer.files[0]);
  });

  // Cell size triggers reprocess
  $('cellSize').addEventListener('input', () => {
    updateSliderLabels();
    if (isGeneratedSource) {
      doGenerateGradient();
    } else {
      processImage();
    }
  });

  // These trigger re-render only
  for (const id of ['patternType', 'ditherMode', 'ditherStyle', 'shapeType', 'angle', 'scale', 'offsetX', 'offsetY']) {
    $(id).addEventListener('input', () => {
      updateSliderLabels();
      updateVisibility();
      render();
    });
  }

  // Color count
  $('colorCount').addEventListener('change', () => {
    const count = parseInt($('colorCount').value);
    currentPercentages = new Array(count).fill(Math.round(100 / count));
    currentPercentages[count - 1] = 100 - currentPercentages.slice(0, -1).reduce((a, b) => a + b, 0);
    buildPaletteUI();
    render();
  });

  // Presets
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
  });

  // Export
  $('exportSvg').addEventListener('click', exportSvg);
  $('exportPng').addEventListener('click', exportPng);

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      exportSvg();
    }
  });

  // Default to 1:1 GameBoy at 45°
  $('aspectRatio').value = '1:1';
  $('gradAngle').value = '45';
  applyPreset('gameboy');

  updateVisibility();
  updateSliderLabels();

  // Auto-generate a gradient on startup
  doGenerateGradient();
}

init();
