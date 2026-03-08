import { NavLink } from 'react-router-dom';
import { useWallet } from '../lib/useWallet';
import './Header.css';

export default function Header() {
    const { account, connect, disconnect, isWrongChain } = useWallet();

    return (
        <header className="header">
            <div className="header__inner">
                {/* Logo */}
                <NavLink to="/" className="header__logo">
                    <span className="header__logo-icon">🥖</span>
                    <span className="header__logo-text">BanhMiCast</span>
                </NavLink>

                {/* Navigation */}
                <nav className="header__nav">
                    <NavLink
                        to="/"
                        className={({ isActive }) => `header__nav-link ${isActive ? 'active' : ''}`}
                    >
                        Explore
                    </NavLink>
                    <NavLink
                        to="/portfolio"
                        className={({ isActive }) => `header__nav-link ${isActive ? 'active' : ''}`}
                    >
                        My Portfolio
                    </NavLink>
                </nav>

                {/* Right side: CRE status + Wallet */}
                <div className="header__actions">
                    {/* CRE Liveness Dot */}
                    <div className="header__cre-status">
                        <div className="liveness-dot"></div>
                        <span className="header__cre-label">CRE: Active</span>
                    </div>

                    {/* Wallet Connect */}
                    {isWrongChain ? (
                        <button className="header__connect-btn btn-primary" onClick={connect}>
                            Switch to Sepolia
                        </button>
                    ) : account ? (
                        <button className="header__connect-btn btn-secondary" onClick={disconnect}>
                            {account.slice(0, 6)}...{account.slice(-4)}
                        </button>
                    ) : (
                        <button className="header__connect-btn btn-primary" onClick={connect}>
                            Connect Wallet
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
}
