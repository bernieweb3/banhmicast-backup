/**
 * @fileoverview Batch Processor — Deterministic batch execution engine.
 *
 * Takes a market state and a list of decrypted orders, processes them
 * sequentially (price impact accumulates), and returns the new state.
 *
 * Key design: **Stateless** — no side effects, no external calls.
 * Deterministic ordering is guaranteed by sorting on `commitmentHash`.
 *
 * @module @banhmicast/cre/batch-processor
 */

import { calculatePrices, solveLmsr } from './lmsr-engine.js';
import { PRECISION, MAX_BATCH_SIZE } from '../../shared/constants.js';

/**
 * Execute a batch of orders against the current market state.
 *
 * Processing rules (TDD Section 2.2):
 *   1. Sort orders by `commitmentHash` (deterministic, DON-reproducible).
 *   2. For each order, call `solveLmsr()` to compute shares minted.
 *   3. Update the running `shares` vector after each order (sequential pricing).
 *   4. Compute final prices after all orders are processed.
 *   5. Return the complete `ExecutionResult`.
 *
 * @param {import('../../shared/types.js').MarketState} marketState - Current on-chain state snapshot.
 * @param {import('../../shared/types.js').DecryptedOrder[]} orders - Decrypted and verified orders.
 * @returns {import('../../shared/types.js').ExecutionResult} Batch execution result.
 */
export function executeBatch(marketState, orders) {
    if (!marketState || !marketState.sharesSupply) {
        throw new Error('executeBatch: invalid marketState');
    }

    // Empty batch — return unchanged state
    if (!orders || orders.length === 0) {
        return {
            marketId: marketState.marketId,
            batchId: marketState.lastBatchId + 1,
            newSharesSupply: [...marketState.sharesSupply],
            priceUpdates: [...marketState.currentPrices],
            payoutAdjustments: [],
            proof: '',
        };
    }

    if (orders.length > MAX_BATCH_SIZE) {
        throw new Error(
            `executeBatch: batch size ${orders.length} exceeds MAX_BATCH_SIZE (${MAX_BATCH_SIZE})`
        );
    }

    // Step 1: Deterministic sort by commitmentHash (lexicographic)
    const sortedOrders = [...orders].sort((a, b) =>
        a.commitmentHash.localeCompare(b.commitmentHash)
    );

    // Step 2-3: Sequential processing with running shares state
    const runningShares = [...marketState.sharesSupply];
    const payoutAdjustments = [];

    for (const order of sortedOrders) {
        // Validate outcome index
        if (order.outcomeIndex < 0 || order.outcomeIndex >= runningShares.length) {
            // Skip invalid orders — do not abort entire batch
            continue;
        }

        // Validate investment amount
        if (order.investmentAmount <= 0n) {
            continue;
        }

        // Solve for shares minted at current running price
        const sharesMinted = solveLmsr(
            runningShares,
            order.outcomeIndex,
            order.investmentAmount,
            marketState.liquidityB
        );

        if (sharesMinted > 0n) {
            // Update running shares (price impact accumulates)
            runningShares[order.outcomeIndex] += sharesMinted;

            payoutAdjustments.push({
                user: order.user,
                sharesMinted,
                outcomeIndex: order.outcomeIndex,
            });
        }
    }

    // Step 4: Compute final prices after all orders processed
    const newPrices = calculatePrices(runningShares, marketState.liquidityB);

    // Step 5: Build result
    return {
        marketId: marketState.marketId,
        batchId: marketState.lastBatchId + 1,
        newSharesSupply: runningShares,
        priceUpdates: newPrices,
        payoutAdjustments,
        proof: '', // Filled by DON after signing
    };
}
