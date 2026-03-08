import MarketCard from '../components/MarketCard';
import './ExplorePage.css';

// Demo markets for hackathon presentation & testnet preview.
// IDs are uint256 market IDs matching the Solidity BanhMiCastMarket contract.
const DEMO_MARKETS = [
    {
        id: 1,
        title: 'ETH/BTC Ratio > 0.05 by June 2026?',
        description: 'Predict whether ETH will reclaim the 0.05 BTC ratio. Joint-outcome with macro sentiment.',
        outcomes: ['Yes', 'No'],
        prices: [62, 38],
        totalVolume: '12.45',
        liquidityB: '1,000',
        isActive: true,
        endsIn: '14d 06h',
    },
    {
        id: 2,
        title: 'Ethereum L2 TVL > $100B by Q3 2026?',
        description: 'Will the combined Ethereum L2 ecosystem surpass $100 billion in total value locked?',
        outcomes: ['Yes', 'No'],
        prices: [45, 55],
        totalVolume: '8.2',
        liquidityB: '2,000',
        isActive: true,
        endsIn: '30d 12h',
    },
    {
        id: 3,
        title: 'Bitcoin All-Time High Before July 2026?',
        description: 'Will Bitcoin break its previous all-time high before July 1st, 2026?',
        outcomes: ['Yes', 'No'],
        prices: [71, 29],
        totalVolume: '34.8',
        liquidityB: '5,000',
        isActive: true,
        endsIn: '3d 18h',
    },
    {
        id: 4,
        title: 'Fed Cuts Rate in June 2026?',
        description: 'Federal Reserve interest rate cut prediction. Linked to macro & election outcomes.',
        outcomes: ['Cut', 'Hold', 'Hike'],
        prices: [40, 48, 12],
        totalVolume: '5.1',
        liquidityB: '3,000',
        isActive: true,
        endsIn: '21d 00h',
    },
    {
        id: 5,
        title: 'Chainlink CCIP Cross-Chain Volume > $50B?',
        description: 'Will Chainlink CCIP monthly cross-chain volume exceed $50 billion in 2026?',
        outcomes: ['Yes', 'No'],
        prices: [33, 67],
        totalVolume: '1.9',
        liquidityB: '800',
        isActive: true,
        endsIn: '60d 00h',
    },
    {
        id: 6,
        title: 'Vietnam National Football — SEA Games Gold?',
        description: 'Will Vietnam win gold in football at the 2027 SEA Games?',
        outcomes: ['Gold', 'No Gold'],
        prices: [55, 45],
        totalVolume: '22.0',
        liquidityB: '1,500',
        isActive: false,
        endsIn: null,
    },
];

export default function ExplorePage() {
    return (
        <div className="explore">
            {/* Hero Section */}
            <section className="explore__hero">
                <div className="explore__hero-content">
                    <h1 className="explore__headline">
                        The Future is Parallel.{' '}
                        <span className="text-gold">Predict it with Privacy.</span>
                    </h1>
                    <p className="explore__subheadline text-secondary">
                        Joint-outcome liquidity for smarter hedging. Powered by{' '}
                        <span className="text-cyan">Ethereum Sepolia</span> &{' '}
                        <span className="text-cyan">Chainlink CRE</span>.
                    </p>
                </div>
                <div className="explore__hero-glow" />
            </section>

            {/* Markets Grid */}
            <section className="explore__markets">
                <div className="explore__section-header">
                    <h2>Active World Tables</h2>
                    <span className="text-muted">{DEMO_MARKETS.length} markets</span>
                </div>
                <div className="grid grid-cols-3">
                    {DEMO_MARKETS.map((market) => (
                        <MarketCard key={market.id} market={market} />
                    ))}
                </div>
            </section>
        </div>
    );
}
