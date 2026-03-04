import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';
import { getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import '@mysten/dapp-kit/dist/index.css';
import './styles/design-system.css';

const queryClient = new QueryClient();

const networks = {
    testnet: { url: getJsonRpcFullnodeUrl('testnet') },
};

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <SuiClientProvider networks={networks} defaultNetwork="testnet">
                <WalletProvider autoConnect>
                    <BrowserRouter>
                        <App />
                    </BrowserRouter>
                </WalletProvider>
            </SuiClientProvider>
        </QueryClientProvider>
    </React.StrictMode>
);
