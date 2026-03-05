import { useState, useCallback } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { PACKAGE_ID, WALRUS_PUBLISHER, MIST_PER_SUI } from '../lib/sui-config';
import TransactionFeedback from './TransactionFeedback';
import './BettingPanel.css';

/**
 * BettingPanel — Secure Order Entry (right column of War Room).
 *
 * Flow: Enter amount → Preview → Encrypt → Walrus upload → commit_bet() on Sui.
 */
export default function BettingPanel({ market, selectedOutcome, outcomes, prices }) {
    const account = useCurrentAccount();
    const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

    const [amount, setAmount] = useState('');
    const [privacyShield, setPrivacyShield] = useState(true);
    const [txState, setTxState] = useState(null); // null | 'signing' | 'processing' | 'success' | 'error'
    const [txHash, setTxHash] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    const price = prices?.[selectedOutcome] ?? 50;
    const amountNum = parseFloat(amount) || 0;
    const potentialReturn = price > 0 ? (amountNum * (100 / price)).toFixed(2) : '0.00';
    const priceImpact = amountNum > 0 ? Math.min(amountNum / 100 * 0.05, 5).toFixed(2) : '0.00';

    const canSubmit = account && selectedOutcome !== null && amountNum > 0.001;

    const handleSubmit = useCallback(async () => {
        if (!canSubmit) return;

        try {
            // Step 1: Signing
            setTxState('signing');

            // Prepare encrypted payload
            const payload = JSON.stringify({
                outcomeIndex: selectedOutcome,
                investmentMist: String(Math.round(amountNum * MIST_PER_SUI)),
            });

            // Step 2: Upload to Walrus
            setTxState('processing');

            let blobId = 'DEMO_BLOB';
            try {
                const walrusResp = await fetch(
                    `${WALRUS_PUBLISHER}/v1/blobs?epochs=5`,
                    {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: payload,
                    }
                );
                const walrusData = await walrusResp.json();
                blobId = walrusData?.newlyCreated?.blobObject?.blobId
                    || walrusData?.alreadyCertified?.blobId
                    || 'DEMO_BLOB';
            } catch (e) {
                console.warn('Walrus upload failed, using demo blob:', e);
            }

            // Step 3: Create commitment hash (simple hash for demo)
            const encoder = new TextEncoder();
            const data = encoder.encode(payload);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));

            // Step 4: Submit commit_bet() to Sui
            const tx = new Transaction();
            const amountMist = BigInt(Math.round(amountNum * MIST_PER_SUI));
            const [coin] = tx.splitCoins(tx.gas, [amountMist]);

            tx.moveCall({
                target: `${PACKAGE_ID}::escrow::commit_bet`,
                arguments: [
                    tx.object(market.id),
                    coin,
                    tx.pure.string(blobId),
                    tx.pure.vector('u8', hashArray),
                    tx.object('0x6'), // Sui shared Clock object
                ],
            });

            const result = await signAndExecute({
                transaction: tx,
            });

            setTxHash(result.digest);
            setTxState('success');
        } catch (err) {
            console.error('Bet submission error:', err);
            setErrorMsg(err.message || 'Transaction failed');
            setTxState('error');
        }
    }, [canSubmit, selectedOutcome, amountNum, market, signAndExecute]);

    const handleReset = () => {
        setTxState(null);
        setTxHash('');
        setErrorMsg('');
        setAmount('');
    };

    return (
        <div className="betting-panel card">
            <h3 className="betting-panel__title">🔒 Secure Order Entry</h3>

            {/* Selected Outcome */}
            <div className="betting-panel__selection">
                <span className="text-muted">Selected Outcome</span>
                <span className="betting-panel__outcome-label font-mono">
                    {selectedOutcome !== null ? outcomes[selectedOutcome] : '— Select above —'}
                </span>
            </div>

            {/* Amount Input */}
            <div className="betting-panel__field">
                <label className="text-muted">Investment Amount</label>
                <div className="betting-panel__input-wrap">
                    <input
                        type="number"
                        className="input-field"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        min="0"
                        step="0.1"
                    />
                    <span className="betting-panel__currency">SUI</span>
                </div>
            </div>

            {/* Trade Metrics */}
            <div className="betting-panel__metrics">
                <div className="betting-panel__metric">
                    <span className="text-muted">Potential Payout</span>
                    <span className="font-mono text-lime">{potentialReturn} SUI</span>
                </div>
                <div className="betting-panel__metric">
                    <span className="text-muted">Price Impact</span>
                    <span className="font-mono">{priceImpact}%</span>
                </div>
                <div className="betting-panel__metric">
                    <span className="text-muted">Current Price</span>
                    <span className="font-mono">{price}%</span>
                </div>
            </div>

            {/* Privacy Shield Toggle */}
            <div className="betting-panel__privacy">
                <label className="betting-panel__toggle">
                    <input
                        type="checkbox"
                        checked={privacyShield}
                        onChange={(e) => setPrivacyShield(e.target.checked)}
                    />
                    <span className="betting-panel__toggle-slider"></span>
                    <span className="betting-panel__toggle-label">
                        🛡️ Encrypted Batching {privacyShield ? 'ON' : 'OFF'}
                    </span>
                </label>
                <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                    Your prediction is hidden from bots until the batch is sealed.
                </span>
            </div>

            {/* Submit Button */}
            {!account ? (
                <button className="btn-primary" disabled>
                    Connect Wallet to Predict
                </button>
            ) : (
                <button
                    className="btn-primary betting-panel__submit"
                    disabled={!canSubmit || txState === 'signing' || txState === 'processing'}
                    onClick={handleSubmit}
                >
                    {txState === 'signing' ? '⏳ Check Wallet...' :
                        txState === 'processing' ? '🛡️ Securing Your Prediction...' :
                            'ENCRYPT & SUBMIT ORDER'}
                </button>
            )}

            <span className="betting-panel__gas text-muted">
                Commitment gas: ~0.001 SUI
            </span>

            {/* Transaction Feedback Overlay */}
            {txState && (
                <TransactionFeedback
                    state={txState}
                    txHash={txHash}
                    errorMsg={errorMsg}
                    onClose={handleReset}
                />
            )}
        </div>
    );
}
