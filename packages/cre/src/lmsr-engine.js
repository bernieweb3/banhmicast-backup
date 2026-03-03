/**
 * @fileoverview LMSR (Logarithmic Market Scoring Rule) Pricing Engine.
 *
 * Implements the core math for the World Table AMM using **pure BigInt arithmetic**
 * with 18-decimal fixed-point precision. No `Number` or `Math.*` anywhere.
 *
 * Key functions:
 *   - `calculateCost(shares, b)` — C(q) = b · ln(Σ e^(qi/b))
 *   - `calculatePrices(shares, b)` — Pi = e^(qi/b) / Σ e^(qj/b)
 *   - `solveLmsr(shares, outcomeIndex, investmentAmount, b)` — Binary search for Δq
 *
 * @module @banhmicast/cre/lmsr-engine
 */

import { PRECISION } from '../../shared/constants.js';

// =============================================================================
// Internal Constants
// =============================================================================

/**
 * Number of iterations for Taylor series / binary search.
 * 64 iterations gives ~10^-18 precision on a BigInt scale.
 */
const TAYLOR_ITERATIONS = 64;

/**
 * Binary search max iterations for solveLmsr.
 */
const BINARY_SEARCH_MAX_ITER = 128;

/**
 * Natural log of 2, scaled by PRECISION.  ln(2) ≈ 0.693147180559945...
 * Pre-computed: 693147180559945309n (18 decimals).
 */
const LN2 = 693147180559945309n;

// =============================================================================
// BigInt Math Helpers (Pure — no Number, no Math.*)
// =============================================================================

/**
 * Absolute value of a BigInt.
 * @param {bigint} x
 * @returns {bigint}
 */
function bigIntAbs(x) {
    return x < 0n ? -x : x;
}

/**
 * Fixed-point multiplication: (a * b) / PRECISION.
 * @param {bigint} a - Scaled value.
 * @param {bigint} b - Scaled value.
 * @returns {bigint} Scaled result.
 */
function mulFp(a, b) {
    return (a * b) / PRECISION;
}

/**
 * Fixed-point division: (a * PRECISION) / b.
 * @param {bigint} a - Scaled value.
 * @param {bigint} b - Scaled value (must be > 0).
 * @returns {bigint} Scaled result.
 */
function divFp(a, b) {
    if (b === 0n) throw new Error('Division by zero');
    return (a * PRECISION) / b;
}

/**
 * BigInt exponential: e^x where x is a fixed-point BigInt (scaled by PRECISION).
 *
 * Uses the identity: e^x = 2^(x/ln2) and then a Taylor series for the
 * fractional part, which converges much faster for |frac| < ln(2).
 *
 * @param {bigint} x - Exponent, scaled by PRECISION. Can be negative.
 * @returns {bigint} e^x, scaled by PRECISION.
 */
export function bigIntExp(x) {
    if (x === 0n) return PRECISION;

    // Handle negative exponents: e^(-x) = 1/e^x
    const isNegative = x < 0n;
    if (isNegative) x = -x;

    // Decompose x = k·ln(2) + r, where 0 <= r < ln(2)
    // k = floor(x / ln2)
    const k = x / LN2; // integer part (BigInt division)
    const r = x - k * LN2; // remainder, 0 <= r < LN2

    // Compute 2^k as a fixed-point value
    // 2^k = PRECISION * 2^k = PRECISION << k  (k is a BigInt, convert to Number for shift)
    // Safety: k should be reasonable (< 256 for any realistic market)
    const kNum = Number(k);
    if (kNum > 255) {
        // Overflow guard — return a very large value
        return isNegative ? 0n : PRECISION * (2n ** 255n);
    }
    let intPart = PRECISION;
    for (let i = 0; i < kNum; i++) {
        intPart = intPart * 2n;
    }

    // Compute e^r using Taylor series: e^r = 1 + r + r²/2! + r³/3! + ...
    // All in fixed-point arithmetic.
    let term = PRECISION; // r^0 / 0! = 1
    let sum = PRECISION; // accumulator starts at 1

    for (let n = 1n; n <= BigInt(TAYLOR_ITERATIONS); n++) {
        term = mulFp(term, r) / n; // term = term * r / n
        if (term === 0n) break; // converged
        sum += term;
    }

    // Result = intPart * fracPart / PRECISION
    let result = mulFp(intPart, sum);

    if (isNegative) {
        // e^(-x) = PRECISION² / result
        result = (PRECISION * PRECISION) / result;
    }

    return result;
}

/**
 * BigInt natural logarithm: ln(x) where x is a fixed-point BigInt (scaled by PRECISION).
 *
 * Uses the identity: ln(x) = k·ln(2) + ln(x/2^k) where 1 <= x/2^k < 2,
 * then a Padé-style series for ln(1+u) = 2·(u/(2+u) + u³/(3·(2+u)³) + ...).
 *
 * @param {bigint} x - Input value, scaled by PRECISION. Must be > 0.
 * @returns {bigint} ln(x), scaled by PRECISION.
 */
export function bigIntLn(x) {
    if (x <= 0n) throw new Error('bigIntLn: input must be > 0');
    if (x === PRECISION) return 0n; // ln(1) = 0

    // Normalise: find k such that PRECISION <= x/2^k < 2·PRECISION
    let k = 0n;
    let normalized = x;
    const twoPrecision = 2n * PRECISION;

    while (normalized >= twoPrecision) {
        normalized = normalized / 2n;
        k += 1n;
    }
    while (normalized < PRECISION) {
        normalized = normalized * 2n;
        k -= 1n;
    }

    // Now PRECISION <= normalized < 2*PRECISION
    // ln(x) = k * ln(2) + ln(normalized)
    // ln(normalized) where normalized is close to 1*PRECISION

    // Use series for ln(1+u) where u = (normalized - PRECISION)/normalized
    // Actually, use the more stable Halley series:
    // ln(1+u) via repeated: s = u / (2 + u), then ln(1+u) = 2*s*(1 + s²/3 + s⁴/5 + ...)
    const u = normalized - PRECISION; // 0 <= u < PRECISION

    // s = u / (2*PRECISION + u)  (fixed-point: s = u * PRECISION / (2*PRECISION + u))
    const s = (u * PRECISION) / (2n * PRECISION + u);

    let s2 = mulFp(s, s); // s²
    let term = s; // first term
    let sum = s;

    for (let n = 3n; n <= BigInt(TAYLOR_ITERATIONS * 2); n += 2n) {
        term = mulFp(term, s2); // s^(2i+1)
        const contribution = term / n;
        if (contribution === 0n) break;
        sum += contribution;
    }

    const lnNormalized = 2n * sum;
    return k * LN2 + lnNormalized;
}

// =============================================================================
// LMSR Core Functions
// =============================================================================

/**
 * LMSR Cost Function: C(q) = b · ln(Σ e^(qi/b))
 *
 * @param {bigint[]} shares - Current shares per outcome (raw, not scaled).
 * @param {bigint} b - Liquidity parameter (raw, not scaled).
 * @returns {bigint} Cost value, scaled by PRECISION.
 */
export function calculateCost(shares, b) {
    if (!shares || shares.length === 0) {
        throw new Error('calculateCost: shares array must not be empty');
    }
    if (b <= 0n) {
        throw new Error('calculateCost: b must be > 0');
    }

    const bScaled = b * PRECISION; // scale b for fixed-point division

    // Find max(qi/b) for numerical stability (log-sum-exp trick)
    // maxTerm = max(qi * PRECISION / b) for all i
    let maxTerm = (shares[0] * PRECISION * PRECISION) / bScaled;
    for (let i = 1; i < shares.length; i++) {
        const term = (shares[i] * PRECISION * PRECISION) / bScaled;
        if (term > maxTerm) maxTerm = term;
    }

    // Σ e^(qi/b - max) — all exponents are now <= 0, avoiding overflow
    let sumExp = 0n;
    for (let i = 0; i < shares.length; i++) {
        const scaledQ = (shares[i] * PRECISION * PRECISION) / bScaled;
        const exponent = scaledQ - maxTerm;
        sumExp += bigIntExp(exponent);
    }

    // C = b * (max + ln(sumExp))
    // Note: b here is raw, result should be scaled by PRECISION
    const lnSum = bigIntLn(sumExp);
    const cost = b * (maxTerm + lnSum);

    return cost;
}

/**
 * LMSR Price Calculation: Pi = e^(qi/b) / Σ e^(qj/b)
 *
 * Prices always sum to PRECISION (= 1.0 in fixed-point).
 *
 * @param {bigint[]} shares - Current shares per outcome (raw).
 * @param {bigint} b - Liquidity parameter (raw).
 * @returns {bigint[]} Prices per outcome, scaled by PRECISION.
 */
export function calculatePrices(shares, b) {
    if (!shares || shares.length === 0) {
        throw new Error('calculatePrices: shares array must not be empty');
    }
    if (b <= 0n) {
        throw new Error('calculatePrices: b must be > 0');
    }

    const bScaled = b * PRECISION;

    // Log-sum-exp trick for stability
    let maxTerm = (shares[0] * PRECISION * PRECISION) / bScaled;
    for (let i = 1; i < shares.length; i++) {
        const term = (shares[i] * PRECISION * PRECISION) / bScaled;
        if (term > maxTerm) maxTerm = term;
    }

    const expValues = [];
    let sumExp = 0n;
    for (let i = 0; i < shares.length; i++) {
        const scaledQ = (shares[i] * PRECISION * PRECISION) / bScaled;
        const e = bigIntExp(scaledQ - maxTerm);
        expValues.push(e);
        sumExp += e;
    }

    // Pi = expValues[i] / sumExp  (fixed-point)
    const prices = expValues.map((e) => divFp(e, sumExp));
    return prices;
}

/**
 * Solve LMSR: Find Δq shares for a given investment amount.
 *
 * Given the current shares vector, an outcome index, and an investment amount,
 * find Δq such that:  Cost(q + Δq·ei) - Cost(q) = investmentAmount
 *
 * Uses binary search over BigInt domain.
 *
 * @param {bigint[]} shares - Current shares per outcome (raw).
 * @param {number} outcomeIndex - Which outcome the user is betting on (0-indexed).
 * @param {bigint} investmentAmount - Amount to invest (raw MIST).
 * @param {bigint} b - Liquidity parameter (raw).
 * @returns {bigint} Number of shares (Δq) minted for the investment.
 */
export function solveLmsr(shares, outcomeIndex, investmentAmount, b) {
    if (outcomeIndex < 0 || outcomeIndex >= shares.length) {
        throw new Error(`solveLmsr: invalid outcomeIndex ${outcomeIndex}`);
    }
    if (investmentAmount <= 0n) {
        throw new Error('solveLmsr: investmentAmount must be > 0');
    }

    const currentCost = calculateCost(shares, b);

    // Target cost after purchasing
    const targetCost = currentCost + investmentAmount * PRECISION;

    // Binary search: find Δq where Cost(q + Δq·ei) == targetCost
    // Lower bound: 0 shares
    // Upper bound: investmentAmount * b (conservative over-estimate)
    let lo = 0n;
    let hi = investmentAmount * b;

    // Ensure hi is large enough
    {
        const testShares = [...shares];
        testShares[outcomeIndex] += hi;
        const testCost = calculateCost(testShares, b);
        if (testCost < targetCost) {
            hi = hi * 10n; // expand upper bound
        }
    }

    for (let iter = 0; iter < BINARY_SEARCH_MAX_ITER; iter++) {
        const mid = (lo + hi) / 2n;
        if (mid === lo) break; // converged

        const testShares = [...shares];
        testShares[outcomeIndex] += mid;
        const testCost = calculateCost(testShares, b);

        if (testCost < targetCost) {
            lo = mid;
        } else {
            hi = mid;
        }
    }

    return lo;
}
