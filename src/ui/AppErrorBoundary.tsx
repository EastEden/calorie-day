import {
  Component,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { translate } from '../i18n';
import { BrandMark } from './BrandMark';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unexpected UI error', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-status-screen app-status-screen--error">
          <div className="app-status-screen__mark">
            <BrandMark size={48} />
          </div>
          <span className="app-status-screen__error-icon">
            <AlertTriangle size={26} aria-hidden="true" />
          </span>
          <h1>{translate('app.errorTitle')}</h1>
          <p>{translate('app.errorBody')}</p>
          <p className="app-status-screen__hint">
            {translate('app.errorHint')}
          </p>
          <button
            type="button"
            className="btn btn--primary btn--md"
            onClick={() => window.location.reload()}
          >
            <RefreshCw size={16} aria-hidden="true" />
            <span>{translate('app.reload')}</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
