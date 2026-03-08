import { useState, useCallback } from 'react';
import { Contract, parseEther, keccak256, toUtf8Bytes } from 'ethers';
import { useWallet } from '../lib/useWallet';
import { ESCROW_ADDRESS, ESCROW_ABI } from '../lib/eth-config';
import TransactionFeedback from './TransactionFeedback';
import './BettingPanel.css';

/**
 * BettingPanel — Secure Order Entry (right column of War Room).
 *
 * Flow: Enter amount → Preview → Hash commitment → commitBet() on Sepolia.
 */
export default function BettingPanel({ market, selectedOutcome, outcomes, prices }) {
    const { account, signer } = useWallet();

    const [amount, setAmount] = useState('');
    const [txState, setTxState] = useState(null); // null | 'signing' | 'processing' | 'success' | 'error'
    const [txHash, setTxHash] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    const price = prices?.[selectedOutcome] ?? 50;
    const amountNum = parseFloat(amount) || 0;
    const potentialReturn = price > 0 ? (amountNum * (100 / price)).toFixed(2) : '0.00';
    const priceImpact = amountNum > 0 ? Math.min(amountNum / 100 * 0.05, 5).toFixed(2) : '0.00';

    const canSubmit = account && selectedOutcome !== null && amountNum > 0.001;

    const handleSubmit = useCallback(async () => {
        if (!canSubmit || !signer) return;

        try {
            // Step 1: Signing
            setTxState('signing');

            // Prepare payload
            const payload = JSON.stringify({
                outcomeIndex: selectedOutcome,
                investmentWei: parseEther(amountNum.toString()).toString(),
            });

            // Step 2: Create commitment hash
            setTxState('processing');
            const commitmentHash = keccak256(toUtf8Bytes(payload));

            // Step 3: Submit commitBet() to Escrow contract on Sepolia
            const escrow = new Contract(ESCROW_ADDRESS, ESCROW_ABI, signer);
            const amountWei = parseEther(amountNum.toString());

            const tx = await escrow.commitBet(
                market.id,       // marketId (uint256)
                payload,         // encryptedPayloadCid (stores the payload directly)
                commitmentHash,  // bytes32
                { value: amountWei }
            );

            const receipt = await tx.wait();

            setTxHash(receipt.hash);
            setTxState('success');
        } catch (err) {
            console.error('Bet submission error:', err);
            setErrorMsg(err.reason || err.message || 'Transaction failed');
            setTxState('error');
        }
    }, [canSubmit, selectedOutcome, amountNum, market, signer]);

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
                        step="0.001"
                    />
                    <span className="betting-panel__currency">ETH</span>
                </div>
            </div>

            {/* Trade Metrics */}
            <div className="betting-panel__metrics">
                <div className="betting-panel__metric">
                    <span className="text-muted">Potential Payout</span>
                    <span className="font-mono text-lime">{potentialReturn} ETH</span>
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
                        txState === 'processing' ? '🛡️ Submitting...' :
                            'SUBMIT ORDER'}
                </button>
            )}

            <span className="betting-panel__gas text-muted">
                Commitment gas: ~0.001 ETH
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
