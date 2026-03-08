/**
 * BanhMiCast — ETH Sepolia contract configuration.
 * Values sourced from Foundry deployment on Sepolia testnet.
 */

export const NETWORK = 'sepolia';
export const CHAIN_ID = 11155111;
export const RPC_URL = 'https://1rpc.io/sepolia';
export const EXPLORER_URL = 'https://sepolia.etherscan.io';

// ─── Deployed Contract Addresses ────────────────────────────────────────────
export const VERIFIER_ADDRESS = '0x9db8fC6Fd8Ea07044C6dCA4AD4A1E21D8faCBa75';
export const MARKET_ADDRESS = '0xD782a3f67dc7d870aB8bb368FC429dC0BcBd4935';
export const ESCROW_ADDRESS = '0x21241e3991811AcA1840D8471642A2C48b9D0E75';

/** ETH → Wei conversion factor. */
export const WEI_PER_ETH = 1_000_000_000_000_000_000n;

// ─── Minimal ABIs (only functions used by frontend) ─────────────────────────

export const ESCROW_ABI = [
    'function commitBet(uint256 marketId, string calldata encryptedPayloadCid, bytes32 commitmentHash) external payable',
    'function emergencyRefund(uint256 commitmentId) external',
    'function getCommitment(uint256 commitmentId) external view returns (address, uint256, bytes32, uint256, uint256, bool)',
    'function getUserCommitmentIds(address user) external view returns (uint256[] memory)',
    'function MIN_BET_WEI() external view returns (uint256)',
    'event BetCommitted(uint256 indexed commitmentId, uint256 indexed marketId, address indexed owner, uint256 collateralWei, uint256 timestampLocked)',
];

export const MARKET_ABI = [
    'function isActive(uint256 marketId) external view returns (bool)',
    'function outcomesCount(uint256 marketId) external view returns (uint256)',
    'function liquidityB(uint256 marketId) external view returns (uint256)',
    'function vaultBalance(uint256 marketId) external view returns (uint256)',
    'function lastBatchId(uint256 marketId) external view returns (uint256)',
    'function winningOutcome(uint256 marketId) external view returns (uint256)',
    'function getCurrentPrice(uint256 marketId, uint256 outcomeIndex) external view returns (uint256)',
    'function getSharesForOutcome(uint256 marketId, uint256 outcomeIndex) external view returns (uint256)',
    'function getPosition(uint256 positionId) external view returns (address, uint256, uint256, uint256, bool)',
    'function getUserPositionIds(address user) external view returns (uint256[] memory)',
    'function claimPayout(uint256 positionId) external',
    'event MarketCreated(uint256 indexed marketId, address indexed creator, uint256 outcomesCount, uint256 liquidityB)',
];
