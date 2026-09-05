import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Intercept low-level browser disk/storage exhaustion errors (e.g. LevelDB FILE_ERROR_NO_SPACE)
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason?.message || String(event.reason || '');
  if (reason.includes('FILE_ERROR_NO_SPACE') || reason.includes('quota') || reason.includes('WritableFileAppend')) {
    console.warn('Browser disk storage error caught. Running in safe memory fallback mode:', reason);
    event.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
