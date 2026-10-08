import { Component, type ReactNode } from 'react';
import { ErrorPage } from './ErrorPage';

/** Render failures only. Handled API/mutation failures stay with the original input. */
export class CustomerErrorBoundary extends Component<{ children: ReactNode; onHome?: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  recover = () => { if (this.state.failed) this.setState({ failed: false }); };
  componentDidMount() { window.addEventListener('hashchange', this.recover); window.addEventListener('popstate', this.recover); }
  componentWillUnmount() { window.removeEventListener('hashchange', this.recover); window.removeEventListener('popstate', this.recover); }
  home = () => { if (this.props.onHome) { this.props.onHome(); return; } window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#home`); this.recover(); };
  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="app-shell detail-open"><section className="content"><ErrorPage kind={500} onRetry={this.recover} onHome={this.home} /></section></main>;
  }
}
