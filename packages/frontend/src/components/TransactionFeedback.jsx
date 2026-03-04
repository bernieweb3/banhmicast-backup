import { useEffect, useState } from 'react';
import './TransactionFeedback.css';

/**
 * TransactionFeedback — The "Wait" UX.
 *
 * Shows: Signing → Processing (shield animation) → Success/Error.
 * Includes: SuiScan link, Batch Pulse progress, error recovery.
 */
export default function TransactionFeedback({ state, txHash, errorMsg, onClose }) {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        if (state === 'processing') {
            const timer = setInterval(() => {
                setProgress((p) => Math.min(p + 3, 90));
            }, 100);
            return () => clearInterval(timer);
        }
        if (state === 'success') {
            setProgress(100);
        }
    }, [state]);

    if (!state) return null;

    // Success state — show as inline toast
    if (state === 'success') {
        return (
            <div className="tx-feedback tx-feedback--success">
                <div className="tx-feedback__icon">✅</div>
                <div className="tx-feedback__content">
                    <h4>Order Executed!</h4>
                    <p className="text-secondary">Your prediction has been securely committed to Sui.</p>
                    {txHash && (
                        <a
                            href={`https://suiscan.xyz/testnet/tx/${txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="tx-feedback__link"
                        >
                            View on SuiScan →
                        </a>
                    )}
                </div>
                <button className="btn-secondary tx-feedback__close" onClick={onClose}>
                    New Order
                </button>
            </div>
        );
    }

    // Error state
    if (state === 'error') {
        return (
            <div className="tx-feedback tx-feedback--error">
                <div className="tx-feedback__icon">⚠️</div>
                <div className="tx-feedback__content">
                    <h4>Transaction Failed</h4>
                    <p className="text-secondary">{errorMsg || 'An unexpected error occurred.'}</p>
                </div>
                <button className="btn-secondary tx-feedback__close" onClick={onClose}>
                    Try Again
                </button>
            </div>
        );
    }

    // Signing / Processing — modal overlay
    return (
        <div className="modal-overlay">
            <div className="modal-content tx-feedback__modal">
                <div className="shield-icon"></div>
                <h3>
                    {state === 'signing' ? 'Awaiting Signature...' : 'Securing Your Prediction'}
                </h3>
                <p className="text-secondary" style={{ marginTop: '8px' }}>
                    {state === 'signing'
                        ? 'Please confirm the commitment in your wallet.'
                        : 'Your order is being encrypted and batched off-chain by the Chainlink DON. This prevents front-running.'}
                </p>

                {state === 'processing' && (
                    <div className="tx-feedback__progress">
                        <div className="progress-bar">
                            <div className="progress-bar__fill" style={{ width: `${progress}%` }} />
                        </div>
                        <span className="font-mono text-muted" style={{ fontSize: '0.75rem', marginTop: '8px' }}>
                            Syncing with Batch...
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
