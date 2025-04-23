import('./App.tsx');
import('lightweight-charts').then(mod => {
  console.log('dynamic import createChart:', mod.createChart);
});
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
