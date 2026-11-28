function setupPalette(find, colorInput, useColor) {
  const palette = new Set();
  function updatePalette() {
    find('paletteAdd').disabled = palette.has(colorInput.value);
    find('paletteRemove').disabled = !palette.has(colorInput.value);
    for (const swatch of find('paletteColors').children) {
      swatch.setAttribute('aria-pressed', String(swatch.value === colorInput.value));
    }
  }
  find('paletteAdd').onclick = () => {
    const color = colorInput.value;
    if (palette.has(color)) return;
    palette.add(color);
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'palette-swatch';
    swatch.value = color;
    swatch.style.setProperty('--swatch', color);
    swatch.textContent = color.toUpperCase();
    swatch.onclick = () => { colorInput.value = color; useColor(); updatePalette(); };
    find('paletteColors').append(swatch);
    updatePalette();
  };
  find('paletteRemove').onclick = () => {
    palette.delete(colorInput.value);
    find('paletteColors').querySelector('[aria-pressed="true"]')?.remove();
    updatePalette();
  };
  colorInput.oninput = () => { useColor(); updatePalette(); };
  updatePalette();
  return () => { palette.clear(); find('paletteColors').replaceChildren(); updatePalette(); };
}
function fillRegion(layer, preview, point, color, checkpoint) {
  const {width, height} = layer;
  const x = Math.floor(point.x), y = Math.floor(point.y);
  if (x < 0 || y < 0 || x >= width || y >= height) return false;
  const context = layer.getContext('2d');
  const image = context.getImageData(0, 0, width, height);
  const pixels = new Uint32Array(image.data.buffer);
  const sample = new Uint32Array(preview.getImageData(0, 0, width, height).data.buffer);
  const rgb = Number.parseInt(color.slice(1), 16);
  const ink = new Uint32Array(Uint8Array.of(rgb >> 16, rgb >> 8, rgb, 255).buffer)[0];
  const start = y * width + x;
  const target = sample[start];
  const queue = new Int32Array(pixels.length);
  let read = 0, end = 0;
  function visit(i) {
    if (sample[i] !== target) return;
    sample[i] = ~target;
    queue[end++] = i;
  }
  visit(start);
  let changed = false;
  while (read < end) {
    const i = queue[read++];
    if (pixels[i] !== ink) { pixels[i] = ink; changed = true; }
    if (i % width) visit(i - 1);
    if (i % width < width - 1) visit(i + 1);
    if (i >= width) visit(i - width);
    if (i + width < pixels.length) visit(i + width);
  }
  if (changed) { checkpoint(); context.putImageData(image, 0, 0); }
  return changed;
}
