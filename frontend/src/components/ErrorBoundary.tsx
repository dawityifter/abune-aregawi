import React from 'react';
import { isChunkLoadError } from '../utils/lazyWithRecovery';
import { dictionaries, type Lang } from '../i18n/dictionaries';

const LANG_STORAGE_KEY = 'app.lang';

// This is the fallback for when other things have already broken, so it
// cannot depend on I18nProvider/useI18n (a class component can't use hooks
// anyway, and if the provider tree itself is implicated in the crash this
// still has to render). It reads the same localStorage key I18nProvider
// persists to directly, and falls back to English on anything unexpected —
// a missing/corrupt key, localStorage throwing (Safari private mode), or a
// dictionary missing the string — because a fallback UI that itself throws
// defeats the entire point of this component.
function getFallbackStrings() {
  const en = dictionaries.en.errorBoundary as {
    title: string;
    body: string;
    retry: string;
    detailsLabel: string;
  };
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY) as Lang | null;
    const lang: Lang = stored === 'ti' ? 'ti' : 'en';
    const dict = dictionaries[lang]?.errorBoundary;
    return {
      title: dict?.title || en.title,
      body: dict?.body || en.body,
      retry: dict?.retry || en.retry,
      detailsLabel: dict?.detailsLabel || en.detailsLabel,
    };
  } catch {
    return en;
  }
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    console.error('🚨 ErrorBoundary caught error:', error);
    console.error('🚨 Error message:', error.message);
    console.error('🚨 Error stack:', error.stack);
    
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🚨 ErrorBoundary componentDidCatch:', error, errorInfo);

    // Check if this is the timeout error we're looking for
    if (error.message && (error.message.includes('Timeout') || error.message.includes('timeout'))) {
      console.error('🎯 Found the timeout error!', error);
    }
  }

  // Re-rendering children by clearing hasError is a no-op for a chunk-load
  // failure: React permanently caches a rejected React.lazy() factory on the
  // component reference (lazyWithRecovery.ts already tried its own one-shot
  // recovery and gave up before this boundary ever saw the error), so the
  // exact same rejection would just throw again on the next render. A real
  // reload is the only thing that actually gets a fresh chunk manifest, so
  // that's what this does when the caught error looks like one. Any other
  // error is presumed to be a one-off render failure, where clearing the
  // boundary's state and letting children re-render is still worth trying.
  private handleRetry = (): void => {
    if (isChunkLoadError(this.state.error)) {
      window.location.reload();
      return;
    }
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      const strings = getFallbackStrings();
      return this.props.fallback || (
        <div style={{
          padding: '20px',
          border: '1px solid #dc2626',
          borderRadius: '8px',
          backgroundColor: '#fef2f2',
          color: '#dc2626',
          margin: '20px'
        }}>
          <h3>{strings.title}</h3>
          <p>{strings.body}</p>
          <details style={{ marginTop: '10px' }}>
            <summary>{strings.detailsLabel}</summary>
            <pre style={{ fontSize: '12px', marginTop: '10px' }}>
              {this.state.error?.message}
            </pre>
          </details>
          <button
            onClick={this.handleRetry}
            style={{
              marginTop: '10px',
              padding: '8px 16px',
              backgroundColor: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {strings.retry}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
