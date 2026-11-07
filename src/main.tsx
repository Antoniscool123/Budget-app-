import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import { prewarmOcr } from './lib/ocr';

const container = document.getElementById('root');
if (!container) throw new Error('Rod-element mangler');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Klargør tekstgenkendelsen i baggrunden, mens brugeren ser overblikket,
// så den første scanning ikke skal vente på wasm og sprogmodel.
prewarmOcr();
