import { useState } from 'react';
import { useParams } from 'react-router-dom';
import WorldTable from '../components/WorldTable';
import BettingPanel from '../components/BettingPanel';
import './MarketPage.css';

// Demo market data — in production, fetched from Sui via useSuiMarket hook
const DEMO_MARKET_DATA = {
    '0x352a63e9364222707eeeaae0d49bac9bce2b089a2ceeeebf0716f7701932c32f': {
        id: '0x352a63e9364222707eeeaae0d49bac9bce2b089a2ceeeebf0716f7701932c32f',
        title: 'ETH/BTC Ratio > 0.05 by June 2026?',
        description: 'Predict whether ETH will reclaim the 0.05 BTC ratio. Joint-outcome with macro sentiment.',
        outcomes: ['Yes', 'No'],
        prices: [62, 38],
        liquidityB: '1,000',
        totalVolume: '12,450',
        lastBatchId: 42,
        isActive: true,
    },
    'demo-market-2': {
        id: 'demo-market-2',
        title: 'Sui TVL > $5B by Q3 2026?',
        description: 'Will the Sui DeFi ecosystem surpass $5 billion in total value locked?',
        outcomes: ['Yes', 'No'],
        prices: [45, 55],
        liquidityB: '2,000',
        totalVolume: '8,200',
        lastBatchId: 18,
        isActive: true,
    },
    'demo-market-3': {
        id: 'demo-market-3',
        title: 'Bitcoin All-Time High Before July 2026?',
        description: 'Will Bitcoin break its previous all-time high before July 1st, 2026?',
        outcomes: ['Yes', 'No'],
        prices: [71, 29],
        liquidityB: '5,000',
        totalVolume: '34,800',
        lastBatchId: 156,
        isActive: true,
    },
    'demo-market-4': {
        id: 'demo-market-4',
        title: 'Fed Cuts Rate in June 2026?',
        description: 'Federal Reserve interest rate cut prediction.',
        outcomes: ['Cut', 'Hold', 'Hike'],
        prices: [40, 48, 12],
        liquidityB: '3,000',
        totalVolume: '5,100',
        lastBatchId: 7,
        isActive: true,
    },
    'demo-market-5': {
        id: 'demo-market-5',
        title: 'Chainlink CCIP Launches on Sui?',
        description: 'Will Chainlink CCIP be live on Sui mainnet in 2026?',
        outcomes: ['Yes', 'No'],
        prices: [33, 67],
        liquidityB: '800',
        totalVolume: '1,900',
        lastBatchId: 3,
        isActive: true,
    },
    'demo-market-6': {
        id: 'demo-market-6',
        title: 'Vietnam National Football — SEA Games Gold?',
        description: 'Will Vietnam win gold in football at the 2027 SEA Games?',
        outcomes: ['Gold', 'No Gold'],
        prices: [55, 45],
        liquidityB: '1,500',
        totalVolume: '22,000',
        lastBatchId: 89,
        isActive: false,
    },
};

/**
 * MarketPage — The "War Room" — 3-column betting interface.
 */
export default function MarketPage() {
    const { id } = useParams();
    const [selectedOutcome, setSelectedOutcome] = useState(null);

    // In production: useSuiMarket(id) hook
    const market = DEMO_MARKET_DATA[id] || Object.values(DEMO_MARKET_DATA)[0];

    return (
        <div className="market-page">
            {/* Left: Market Context */}
            <div className="market-page__context">
                <div className="card">
                    <div className="market-page__badge-row">
                        <span className={`badge ${market.isActive ? 'badge-active' : 'badge-ended'}`}>
                            {market.isActive ? 'Active' : 'Ended'}
                        </span>
                        <span className="badge badge-pending">Batch #{market.lastBatchId}</span>
                    </div>
                    <h2 className="market-page__title">{market.title}</h2>
                    <p className="text-secondary">{market.description}</p>

                    <div className="market-page__stats">
                        <div className="market-page__stat">
                            <span className="text-muted">Total Volume</span>
                            <span className="font-mono">{market.totalVolume} SUI</span>
                        </div>
                        <div className="market-page__stat">
                            <span className="text-muted">Liquidity (b)</span>
                            <span className="font-mono">{market.liquidityB}</span>
                        </div>
                        <div className="market-page__stat">
                            <span className="text-muted">Outcomes</span>
                            <span className="font-mono">{market.outcomes.length}</span>
                        </div>
                    </div>

                    {/* Chainlink CRE Badge */}
                    <div className="market-page__cre-badge">
                        <div className="liveness-dot" style={{ width: '6px', height: '6px' }}></div>
                        <span className="font-mono text-muted" style={{ fontSize: '0.72rem' }}>
                            Powered by Chainlink CRE · Batch #{market.lastBatchId}
                        </span>
                    </div>
                </div>
            </div>

            {/* Center: World Table */}
            <div className="market-page__world-table">
                <WorldTable
                    outcomes={market.outcomes}
                    prices={market.prices}
                    selectedOutcome={selectedOutcome}
                    onSelect={setSelectedOutcome}
                />
            </div>

            {/* Right: Betting Panel */}
            <div className="market-page__betting">
                <BettingPanel
                    market={market}
                    selectedOutcome={selectedOutcome}
                    outcomes={market.outcomes}
                    prices={market.prices}
                />
            </div>
        </div>
    );
}
