// Copies MediaPipe WASM runtime into /public and (optionally) downloads the
// hand-landmarker model so the app can run fully offline after setup.
import { cpSync, existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const wasmSrc = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const wasmDst = join(root, 'public', 'mediapipe', 'wasm');
const modelDst = join(root, 'public', 'models', 'hand_landmarker.task');
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

if (existsSync(wasmSrc)) {
  mkdirSync(wasmDst, { recursive: true });
  cpSync(wasmSrc, wasmDst, { recursive: true });
  console.log('[assets] MediaPipe WASM copied to public/mediapipe/wasm');
} else {
  console.warn('[assets] @mediapipe/tasks-vision not installed yet; skipping WASM copy');
}

if (!process.argv.includes('--wasm-only')) {
  if (existsSync(modelDst) && statSync(modelDst).size > 1_000_000) {
    console.log('[assets] hand_landmarker.task already present');
  } else {
    try {
      console.log('[assets] downloading hand_landmarker.task …');
      const res = await fetch(MODEL_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      mkdirSync(dirname(modelDst), { recursive: true });
      writeFileSync(modelDst, buf);
      console.log(`[assets] model saved (${(buf.length / 1e6).toFixed(1)} MB)`);
    } catch (err) {
      console.warn('[assets] model download failed — the app will load it from the CDN at runtime.', err.message);
    }
  }
}
