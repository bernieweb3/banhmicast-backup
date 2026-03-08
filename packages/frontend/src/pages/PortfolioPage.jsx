import { useWallet } from '../lib/useWallet';
import './PortfolioPage.css';

// Demo positions — in production: use ethers.js Contract to fetch UserPosition data
const DEMO_POSITIONS = [
    {
        id: 'pos-1',
        marketTitle: 'ETH/BTC Ratio > 0.05 by June 2026?',
        outcome: 'Yes',
        shares: '412.5',
        avgPrice: '0.60',
        currentPrice: '0.62',
        status: 'active',
        pnl: '+3.3%',
    },
    {
        id: 'pos-2',
        marketTitle: 'Bitcoin All-Time High Before July 2026?',
        outcome: 'Yes',
        shares: '890.2',
        avgPrice: '0.68',
        currentPrice: '0.71',
        status: 'active',
        pnl: '+4.4%',
    },
    {
        id: 'pos-3',
        marketTitle: 'Ethereum L2 TVL > $100B by Q3 2026?',
        outcome: 'No',
        shares: '200.0',
        avgPrice: '0.52',
        currentPrice: '0.55',
        status: 'active',
        pnl: '+5.8%',
    },
];

const DEMO_PENDING = [
    {
        id: 'pending-1',
        marketTitle: 'Fed Cuts Rate in June 2026?',
        amount: '0.1 ETH',
        submittedAt: '2 minutes ago',
    },
];

export default function PortfolioPage() {
    const { account } = useWallet();

    if (!account) {
        return (
            <div className="portfolio portfolio--empty">
                <div className="portfolio__connect card">
                    <h2>🔗 Connect Your Wallet</h2>
                    <p className="text-secondary">
                        Connect your wallet to view your prediction positions.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="portfolio">
            <h1 className="portfolio__header">My Portfolio</h1>
            <p className="text-secondary portfolio__address font-mono">
                {account.slice(0, 6)}...{account.slice(-4)}
            </p>

            {/* Pending Commitments */}
            {DEMO_PENDING.length > 0 && (
                <section className="portfolio__section">
                    <h3>🔒 Pending Commitments</h3>
                    <div className="portfolio__list">
                        {DEMO_PENDING.map((p) => (
                            <div key={p.id} className="card portfolio__pending-card">
                                <div className="portfolio__pending-content">
                                    <span className="badge badge-pending">Minting...</span>
                                    <span className="portfolio__pending-title">{p.marketTitle}</span>
                                </div>
                                <div className="portfolio__pending-meta text-muted">
                                    <span>{p.amount}</span>
                                    <span>{p.submittedAt}</span>
                                </div>
                                <div className="shimmer portfolio__pending-shimmer" />
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Active Positions */}
            <section className="portfolio__section">
                <h3>📊 Active Positions</h3>
                <div className="portfolio__list">
                    {DEMO_POSITIONS.map((pos) => (
                        <div key={pos.id} className="card portfolio__position-card">
                            <div className="portfolio__position-header">
                                <span className="portfolio__position-title">{pos.marketTitle}</span>
                                <span className={`badge ${pos.status === 'active' ? 'badge-active' : 'badge-ended'}`}>
                                    {pos.status}
                                </span>
                            </div>
                            <div className="portfolio__position-details">
                                <div className="portfolio__position-detail">
                                    <span className="text-muted">Outcome</span>
                                    <span className="font-mono text-gold">{pos.outcome}</span>
                                </div>
                                <div className="portfolio__position-detail">
                                    <span className="text-muted">Shares</span>
                                    <span className="font-mono">{pos.shares}</span>
                                </div>
                                <div className="portfolio__position-detail">
                                    <span className="text-muted">Avg Price</span>
                                    <span className="font-mono">{pos.avgPrice}</span>
                                </div>
                                <div className="portfolio__position-detail">
                                    <span className="text-muted">Current</span>
                                    <span className="font-mono">{pos.currentPrice}</span>
                                </div>
                                <div className="portfolio__position-detail">
                                    <span className="text-muted">P&L</span>
                                    <span className={`font-mono ${pos.pnl.startsWith('+') ? 'text-lime' : 'text-rose'}`}>
                                        {pos.pnl}
                                    </span>
                                </div>
                            </div>
                            {pos.status === 'resolved' && (
                                <button className="btn-primary" style={{ marginTop: '12px' }}>
                                    Claim Payout
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
