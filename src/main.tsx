import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '@fontsource/michroma/400.css';
import '@fontsource/inter-tight/300.css';
import '@fontsource/inter-tight/400.css';
import '@fontsource/inter-tight/500.css';
import '@fontsource/inter-tight/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { engine } from './core/engine';
import './index.css';

// expose the engine for debugging / scripted demos in development builds
if (import.meta.env.DEV) (window as unknown as { bridge: typeof engine }).bridge = engine;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
