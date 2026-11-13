import {
  Component,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
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
          <h1>页面遇到了一个意外错误</h1>
          <p>
            你的本地记录仍然保存在浏览器数据库中，不会因为这次错误被清空。
          </p>
          <p className="app-status-screen__hint">
            请重新加载页面。如果问题持续出现，可以先把当前浏览器窗口保持打开，
            并联系开发者排查。
          </p>
          <button
            type="button"
            className="btn btn--primary btn--md"
            onClick={() => window.location.reload()}
          >
            <RefreshCw size={16} aria-hidden="true" />
            <span>重新加载</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
