import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
          <h2 style={{ color: '#d32f2f' }}>Terjadi kesalahan</h2>
          <p style={{ color: '#666', fontSize: 14, wordBreak: 'break-word' }}>
            {this.state.error?.message}
          </p>
          <button 
            onClick={() => window.location.reload()}
            style={{
              marginTop: 16,
              padding: '8px 16px',
              backgroundColor: '#2d6a4f',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer'
            }}
          >
            Muat Ulang
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
