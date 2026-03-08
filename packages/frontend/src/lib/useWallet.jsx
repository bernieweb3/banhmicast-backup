import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { BrowserProvider } from 'ethers';
import { CHAIN_ID } from './eth-config';

/**
 * WalletContext — Provides wallet state (account, provider, signer) to all children.
 * Uses MetaMask (window.ethereum) via ethers.js v6 BrowserProvider.
 */
const WalletContext = createContext(null);

export function WalletProvider({ children }) {
    const [account, setAccount] = useState(null);
    const [provider, setProvider] = useState(null);
    const [signer, setSigner] = useState(null);
    const [chainId, setChainId] = useState(null);

    // Auto-detect already-connected accounts on mount
    useEffect(() => {
        if (!window.ethereum) return;
        const prov = new BrowserProvider(window.ethereum);
        setProvider(prov);

        // Check for existing connection
        window.ethereum.request({ method: 'eth_accounts' }).then((accounts) => {
            if (accounts.length > 0) {
                setAccount(accounts[0]);
                prov.getSigner().then(setSigner);
            }
        });

        window.ethereum.request({ method: 'eth_chainId' }).then((id) => {
            setChainId(Number(id));
        });

        // Listen for account/chain changes
        const handleAccountsChanged = (accounts) => {
            if (accounts.length > 0) {
                setAccount(accounts[0]);
                prov.getSigner().then(setSigner);
            } else {
                setAccount(null);
                setSigner(null);
            }
        };
        const handleChainChanged = (id) => {
            setChainId(Number(id));
            window.location.reload();
        };

        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', handleChainChanged);

        return () => {
            window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
            window.ethereum.removeListener('chainChanged', handleChainChanged);
        };
    }, []);

    const connect = useCallback(async () => {
        if (!window.ethereum) {
            window.open('https://metamask.io/download/', '_blank');
            return;
        }

        const prov = new BrowserProvider(window.ethereum);
        setProvider(prov);

        // Request account access
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        setAccount(accounts[0]);

        // Switch to Sepolia if needed
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0x' + CHAIN_ID.toString(16) }],
            });
        } catch (err) {
            // Chain not added — add Sepolia
            if (err.code === 4902) {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: '0x' + CHAIN_ID.toString(16),
                        chainName: 'Sepolia Testnet',
                        nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                        rpcUrls: ['https://1rpc.io/sepolia'],
                        blockExplorerUrls: ['https://sepolia.etherscan.io'],
                    }],
                });
            }
        }

        setChainId(CHAIN_ID);
        const s = await prov.getSigner();
        setSigner(s);
    }, []);

    const disconnect = useCallback(() => {
        setAccount(null);
        setSigner(null);
    }, []);

    const isWrongChain = chainId !== null && chainId !== CHAIN_ID;

    return (
        <WalletContext.Provider value={{ account, provider, signer, chainId, isWrongChain, connect, disconnect }}>
            {children}
        </WalletContext.Provider>
    );
}

/**
 * useWallet — Custom hook to access wallet state from any component.
 * Replaces @mysten/dapp-kit's useCurrentAccount + useSignAndExecuteTransaction.
 */
export function useWallet() {
    const ctx = useContext(WalletContext);
    if (!ctx) throw new Error('useWallet must be used within WalletProvider');
    return ctx;
}
