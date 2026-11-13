import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initializeI18n } from './i18n';
import { AppProvider } from './state/AppContext';
import { AppErrorBoundary } from './ui/AppErrorBoundary';
import { ToastProvider } from './ui/ToastProvider';
import './styles/index.css';

async function bootstrap() {
  await initializeI18n();

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <AppErrorBoundary>
        <ToastProvider>
          <AppProvider>
            <App />
          </AppProvider>
        </ToastProvider>
      </AppErrorBoundary>
    </React.StrictMode>,
  );
}

void bootstrap();
