import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { WalletProvider } from './lib/useWallet';
import App from './App';
import './styles/design-system.css';

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <WalletProvider>
                <BrowserRouter>
                    <App />
                </BrowserRouter>
            </WalletProvider>
        </QueryClientProvider>
    </React.StrictMode>
);
