import { useNavigate } from 'react-router-dom';
import './MarketCard.css';

/**
 * MarketCard — displays a single prediction market in the Explore grid.
 * Visual: Charcoal card with Steel border, gold hover glow, probability bar.
 */
export default function MarketCard({ market }) {
    const navigate = useNavigate();

    const isActive = market.isActive !== false;
    const outcomes = market.outcomes || ['Yes', 'No'];
    const prices = market.prices || outcomes.map(() => Math.round(100 / outcomes.length));
    const totalVolume = market.totalVolume || '0';
    const liquidity = market.liquidityB || '—';

    return (
        <div className="market-card card" onClick={() => navigate(`/market/${market.id}`)}>
            {/* Status badge */}
            <div className="market-card__header">
                <span className={`badge ${isActive ? 'badge-active' : 'badge-ended'}`}>
                    {isActive ? 'Active' : 'Ended'}
                </span>
                {market.endsIn && (
                    <span className="market-card__countdown text-muted">{market.endsIn}</span>
                )}
            </div>

            {/* Title */}
            <h3 className="market-card__title">{market.title}</h3>
            <p className="market-card__desc text-secondary">{market.description}</p>

            {/* Probability Ribbon */}
            <div className="market-card__prob">
                <div className="prob-bar">
                    {prices.map((price, i) => (
                        <div
                            key={i}
                            className="prob-bar__segment"
                            style={{
                                width: `${price}%`,
                                background: i === 0 ? 'var(--eth-blue, #627eea)' : i === 1 ? 'var(--banhmi-gold)' : 'var(--hyper-lime)',
                            }}
                        />
                    ))}
                </div>
                <div className="market-card__outcomes">
                    {outcomes.map((name, i) => (
                        <div key={i} className="market-card__outcome">
                            <span className="market-card__outcome-name text-secondary">{name}</span>
                            <span className="market-card__outcome-price font-mono">{prices[i]}%</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Stats */}
            <div className="market-card__stats">
                <div className="market-card__stat">
                    <span className="text-muted">Volume</span>
                    <span className="font-mono">{totalVolume} ETH</span>
                </div>
                <div className="market-card__stat">
                    <span className="text-muted">Liquidity (b)</span>
                    <span className="font-mono">{liquidity}</span>
                </div>
            </div>

            {/* CTA */}
            <button className="btn-primary market-card__cta">
                Enter Market →
            </button>
        </div>
    );
}
