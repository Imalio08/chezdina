import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null, info: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("ErrorBoundary:", error, info); this.setState({ info }); }
  reset = () => this.setState({ error: null, info: null });

  render() {
    if (!this.state.error) return this.props.children;
    const compact = this.props.compact;
    const msg = this.state.error?.message || String(this.state.error);
    if (compact) {
      return (
        <div className="dina-card-white p-4 flex items-center gap-3 border-dashed" data-testid="error-boundary-widget">
          <AlertTriangle size={18} className="text-[#e4991e] shrink-0"/>
          <div className="flex-1 text-sm">Impossible de charger ce bloc.</div>
          <button onClick={this.reset} className="dina-btn-secondary !min-h-[32px] text-xs"><RefreshCw size={12}/>Réessayer</button>
        </div>
      );
    }
    return (
      <div className="dina-card-white p-8 max-w-xl mx-auto my-10 text-center" data-testid="error-boundary-page">
        <AlertTriangle size={32} className="text-[#e4991e] mx-auto mb-3"/>
        <div className="font-serif text-xl mb-2">Oups, un problème est survenu</div>
        <div className="text-sm text-[#666] mb-5">Cette section n'a pas pu se charger. Le reste de la console continue de fonctionner.</div>
        <details className="text-left text-xs text-[#999] bg-[#fafafa] dark:bg-[#141414] rounded p-3 mb-4"><summary className="cursor-pointer">Détails techniques</summary><div className="mt-2 font-mono break-all">{msg}</div></details>
        <div className="flex gap-2 justify-center">
          <button onClick={this.reset} className="dina-btn-secondary"><RefreshCw size={14}/>Réessayer</button>
          <button onClick={()=>window.location.reload()} className="dina-btn-primary">Recharger la page</button>
        </div>
      </div>
    );
  }
}
