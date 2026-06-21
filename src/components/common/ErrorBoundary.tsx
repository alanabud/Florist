import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Unhandled error caught:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/admin/login';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          width: '100%',
          background: '#FAF9F5',
          padding: '2rem',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
        }}>
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #FCA5A5',
            borderRadius: '16px',
            padding: '2.5rem',
            maxWidth: '520px',
            width: '100%',
            boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
            textAlign: 'center'
          }}>
            <div style={{
              background: '#FEE2E2',
              color: '#DC2626',
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
              fontSize: '1.5rem'
            }}>
              ⚠
            </div>

            <h2 style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              color: '#991B1B',
              margin: '0 0 0.75rem 0'
            }}>
              Something went wrong
            </h2>

            <p style={{
              fontSize: '0.875rem',
              color: '#7f1d1d',
              lineHeight: '1.6',
              margin: '0 0 1rem 0'
            }}>
              The application encountered an unexpected error. This is usually temporary.
            </p>

            {this.state.error && (
              <details style={{
                textAlign: 'left',
                marginBottom: '1.25rem',
                background: '#FEF2F2',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                fontSize: '0.75rem',
                color: '#991B1B'
              }}>
                <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                  Error Details
                </summary>
                <pre style={{
                  margin: '0.5rem 0 0',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontFamily: "'SF Mono', 'Fira Code', monospace",
                  fontSize: '0.6875rem',
                  lineHeight: '1.5'
                }}>
                  {this.state.error.message}
                </pre>
              </details>
            )}

            <button
              onClick={this.handleReset}
              style={{
                background: '#6C8271',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                padding: '0.625rem 1.5rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#566957'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#6C8271'}
            >
              Return to Login
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
