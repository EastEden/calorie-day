import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppProvider } from './state/AppContext';
import { AppErrorBoundary } from './ui/AppErrorBoundary';
import { ToastProvider } from './ui/ToastProvider';
import './styles/index.css';

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
