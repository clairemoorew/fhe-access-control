import { ConnectButton } from '@rainbow-me/rainbowkit';
import '../styles/Header.css';

export function Header() {
  return (
    <header className="header">
      <div className="header-container">
        <div className="header-content">
          <div className="header-left">
            <p className="eyebrow">FHE Access Control</p>
            <h1 className="header-title">Confidential Access Control</h1>
            <p className="header-subtitle">
              Grant and verify permissions without exposing delegate addresses on-chain.
            </p>
          </div>
          <ConnectButton label="Connect Wallet" showBalance={false} />
        </div>
      </div>
    </header>
  );
}
