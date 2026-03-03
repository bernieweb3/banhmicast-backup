// BanhMiCast — Chainlink CRE Workflow: LMSR Pricing Engine
//
// Pure integer LMSR math for the World Table AMM.
// Uses scaled integer arithmetic (PRECISION = 1e18) to avoid floating point.
//
// C(q) = b * ln(sum(e^(qi/b)))
// P(i) = e^(qi/b) / sum(e^(qj/b))
package main

import (
	"fmt"
	"math/big"
)

// PRECISION is the fixed-point scale factor (1e18).
var PRECISION = new(big.Int).Exp(big.NewInt(10), big.NewInt(18), nil)

// LN2 = ln(2) scaled by PRECISION ≈ 693147180559945309
var LN2 = mustParseBigInt("693147180559945309")

func mustParseBigInt(s string) *big.Int {
	n, ok := new(big.Int).SetString(s, 10)
	if !ok {
		panic("invalid bigint literal: " + s)
	}
	return n
}

// mulFP performs fixed-point multiplication: (a * b) / PRECISION.
func mulFP(a, b *big.Int) *big.Int {
	result := new(big.Int).Mul(a, b)
	result.Div(result, PRECISION)
	return result
}

// divFP performs fixed-point division: (a * PRECISION) / b.
func divFP(a, b *big.Int) *big.Int {
	if b.Sign() == 0 {
		panic("divFP: division by zero")
	}
	result := new(big.Int).Mul(a, PRECISION)
	result.Div(result, b)
	return result
}

// bigIntExp computes e^x where x is a fixed-point big.Int (scaled by PRECISION).
// Uses Taylor series: e^x = 1 + x + x²/2! + x³/3! + ...
// Handles negative x via e^(-x) = 1 / e^x.
func bigIntExp(x *big.Int) *big.Int {
	if x.Sign() == 0 {
		return new(big.Int).Set(PRECISION)
	}

	negative := x.Sign() < 0
	xAbs := new(big.Int).Abs(x)

	// Decompose: x = k*ln(2) + r, 0 <= r < ln(2)
	k := new(big.Int).Div(xAbs, LN2)
	r := new(big.Int).Mod(xAbs, LN2)

	// Compute 2^k (scaled by PRECISION)
	kInt64 := k.Int64()
	if kInt64 > 255 {
		if negative {
			return big.NewInt(0)
		}
		return new(big.Int).Lsh(PRECISION, 255)
	}
	intPart := new(big.Int).Lsh(PRECISION, uint(kInt64))

	// Taylor series for e^r
	term := new(big.Int).Set(PRECISION) // r^0 / 0! = 1
	sum := new(big.Int).Set(PRECISION)
	for n := int64(1); n <= 64; n++ {
		term = mulFP(term, r)
		term.Div(term, big.NewInt(n))
		if term.Sign() == 0 {
			break
		}
		sum.Add(sum, term)
	}

	result := mulFP(intPart, sum)

	if negative {
		// e^(-x) = PRECISION² / result
		num := new(big.Int).Mul(PRECISION, PRECISION)
		result = num.Div(num, result)
	}
	return result
}

// bigIntLn computes ln(x) where x is a fixed-point big.Int (x > 0).
func bigIntLn(x *big.Int) *big.Int {
	if x.Sign() <= 0 {
		panic("bigIntLn: input must be > 0")
	}
	if x.Cmp(PRECISION) == 0 {
		return big.NewInt(0)
	}

	// Normalise: find k such that PRECISION <= x/2^k < 2*PRECISION
	k := int64(0)
	normalized := new(big.Int).Set(x)
	twoPrecision := new(big.Int).Lsh(PRECISION, 1)

	for normalized.Cmp(twoPrecision) >= 0 {
		normalized.Rsh(normalized, 1)
		k++
	}
	for normalized.Cmp(PRECISION) < 0 {
		normalized.Lsh(normalized, 1)
		k--
	}

	// ln(x) = k * ln(2) + ln(normalized)
	// Use Halley series for ln(1+u): s = u/(2+u), ln(1+u) = 2*(s + s³/3 + s⁵/5 + ...)
	u := new(big.Int).Sub(normalized, PRECISION) // 0 <= u < PRECISION

	denominator := new(big.Int).Add(new(big.Int).Lsh(PRECISION, 1), u) // 2*PRECISION + u
	s := divFP(u, denominator)

	s2 := mulFP(s, s) // s²
	term := new(big.Int).Set(s)
	sum := new(big.Int).Set(s)

	for n := int64(3); n <= 128; n += 2 {
		term = mulFP(term, s2)
		contribution := new(big.Int).Div(term, big.NewInt(n))
		if contribution.Sign() == 0 {
			break
		}
		sum.Add(sum, contribution)
	}

	lnNorm := new(big.Int).Lsh(sum, 1) // 2 * sum

	kLn2 := new(big.Int).Mul(big.NewInt(k), LN2)
	return kLn2.Add(kLn2, lnNorm)
}

// CalculateCost computes C(q) = b * ln(sum(e^(qi/b))) using log-sum-exp for stability.
// shares: raw (not scaled). b: raw (not scaled). Returns scaled by PRECISION.
func CalculateCost(shares []*big.Int, b *big.Int) *big.Int {
	if len(shares) == 0 {
		panic("CalculateCost: empty shares")
	}
	if b.Sign() <= 0 {
		panic("CalculateCost: b must be > 0")
	}

	bScaled := new(big.Int).Mul(b, PRECISION)

	// Compute qi/b for each outcome (scaled)
	scaledQs := make([]*big.Int, len(shares))
	maxQ := new(big.Int).SetInt64(0)
	for i, qi := range shares {
		// scaledQ = qi * PRECISION * PRECISION / bScaled
		num := new(big.Int).Mul(qi, PRECISION)
		num.Mul(num, PRECISION)
		scaledQs[i] = num.Div(num, bScaled)
		if scaledQs[i].Cmp(maxQ) > 0 {
			maxQ = new(big.Int).Set(scaledQs[i])
		}
	}

	// Sum e^(qi/b - max)
	sumExp := big.NewInt(0)
	for _, sq := range scaledQs {
		exp := bigIntExp(new(big.Int).Sub(sq, maxQ))
		sumExp.Add(sumExp, exp)
	}

	lnSum := bigIntLn(sumExp)
	// C = b * (max + lnSum)
	total := new(big.Int).Add(maxQ, lnSum)
	return total.Mul(total, b)
}

// CalculatePrices computes P(i) = e^(qi/b) / sum(e^(qj/b)).
// Returns prices scaled by PRECISION (all prices sum to ≈ PRECISION).
func CalculatePrices(shares []*big.Int, b *big.Int) []*big.Int {
	if len(shares) == 0 {
		panic("CalculatePrices: empty shares")
	}

	bScaled := new(big.Int).Mul(b, PRECISION)
	maxQ := big.NewInt(0)
	scaledQs := make([]*big.Int, len(shares))
	for i, qi := range shares {
		num := new(big.Int).Mul(qi, PRECISION)
		num.Mul(num, PRECISION)
		scaledQs[i] = num.Div(num, bScaled)
		if scaledQs[i].Cmp(maxQ) > 0 {
			maxQ = new(big.Int).Set(scaledQs[i])
		}
	}

	expVals := make([]*big.Int, len(shares))
	sumExp := big.NewInt(0)
	for i, sq := range scaledQs {
		e := bigIntExp(new(big.Int).Sub(sq, maxQ))
		expVals[i] = e
		sumExp.Add(sumExp, e)
	}

	prices := make([]*big.Int, len(shares))
	for i, e := range expVals {
		prices[i] = divFP(e, sumExp)
	}
	return prices
}

// SolveLmsr finds delta_q shares for a given investment via binary search.
// investmentAmount: raw MIST. Returns raw shares delta.
func SolveLmsr(shares []*big.Int, outcomeIndex int, investmentAmount *big.Int, b *big.Int) *big.Int {
	if outcomeIndex < 0 || outcomeIndex >= len(shares) {
		panic(fmt.Sprintf("SolveLmsr: invalid outcomeIndex %d", outcomeIndex))
	}
	if investmentAmount.Sign() <= 0 {
		panic("SolveLmsr: investmentAmount must be > 0")
	}

	currentCost := CalculateCost(shares, b)
	// Target = currentCost + investmentAmount * PRECISION
	targetCost := new(big.Int).Add(currentCost, new(big.Int).Mul(investmentAmount, PRECISION))

	lo := big.NewInt(0)
	hi := new(big.Int).Mul(investmentAmount, b)

	// Expand hi if needed
	testShares := make([]*big.Int, len(shares))
	copy(testShares, shares)
	testShares[outcomeIndex] = new(big.Int).Add(testShares[outcomeIndex], hi)
	if CalculateCost(testShares, b).Cmp(targetCost) < 0 {
		hi.Mul(hi, big.NewInt(10))
	}

	for i := 0; i < 128; i++ {
		mid := new(big.Int).Add(lo, hi)
		mid.Rsh(mid, 1) // mid = (lo+hi)/2

		if mid.Cmp(lo) == 0 {
			break
		}

		ts := make([]*big.Int, len(shares))
		copy(ts, shares)
		ts[outcomeIndex] = new(big.Int).Add(ts[outcomeIndex], mid)

		if CalculateCost(ts, b).Cmp(targetCost) < 0 {
			lo = mid
		} else {
			hi = mid
		}
	}
	return lo
}
