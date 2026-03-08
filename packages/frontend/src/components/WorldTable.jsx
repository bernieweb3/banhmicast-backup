import { useState } from 'react';
import './WorldTable.css';

/**
 * WorldTable — The Selection Matrix (center of the War Room).
 *
 * Displays outcomes as a grid with probability-based heat intensity.
 * Click to select an outcome for betting.
 */
export default function WorldTable({ outcomes, prices, selectedOutcome, onSelect }) {
    return (
        <div className="world-table">
            <div className="world-table__header">
                <h3>World Table</h3>
                <span className="text-muted text-sm">Select an outcome to predict</span>
            </div>

            {/* Probability Ribbon */}
            <div className="world-table__ribbon">
                <div className="prob-bar" style={{ height: '10px' }}>
                    {outcomes.map((_, i) => (
                        <div
                            key={i}
                            className="prob-bar__segment"
                            style={{
                                width: `${prices[i]}%`,
                                background: getOutcomeColor(i),
                                opacity: selectedOutcome === i ? 1 : 0.6,
                            }}
                        />
                    ))}
                </div>
            </div>

            {/* Outcome Grid */}
            <div className="world-table__grid">
                {outcomes.map((name, i) => {
                    const isSelected = selectedOutcome === i;
                    const heatOpacity = Math.max(0.05, prices[i] / 100 * 0.25);
                    const returnMultiple = prices[i] > 0 ? (100 / prices[i]).toFixed(1) : '—';

                    return (
                        <button
                            key={i}
                            className={`world-table__cell ${isSelected ? 'world-table__cell--selected' : ''}`}
                            onClick={() => onSelect(i)}
                            style={{
                                '--heat-color': getOutcomeColor(i),
                                '--heat-opacity': heatOpacity,
                            }}
                        >
                            <div className="world-table__cell-header">
                                <span className="world-table__cell-name">{name}</span>
                                <span className="world-table__cell-index text-muted">#{i + 1}</span>
                            </div>
                            <div className="world-table__cell-price font-mono">
                                {prices[i]}%
                            </div>
                            {isSelected && (
                                <div className="world-table__cell-return text-gold">
                                    {returnMultiple}x return
                                </div>
                            )}
                            <div className="world-table__cell-delta">
                                {prices[i] > 50 ? (
                                    <span className="text-lime">▲ High</span>
                                ) : prices[i] > 30 ? (
                                    <span className="text-secondary">— Neutral</span>
                                ) : (
                                    <span className="text-rose">▼ Low</span>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function getOutcomeColor(index) {
    const colors = [
        'var(--eth-blue)',
        'var(--banhmi-gold)',
        'var(--hyper-lime)',
        'var(--electric-rose)',
        '#A78BFA',
        '#F472B6',
    ];
    return colors[index % colors.length];
}
