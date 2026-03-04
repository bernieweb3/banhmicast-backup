import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ExplorePage from './pages/ExplorePage';
import MarketPage from './pages/MarketPage';
import PortfolioPage from './pages/PortfolioPage';

export default function App() {
    return (
        <Routes>
            <Route element={<Layout />}>
                <Route path="/" element={<ExplorePage />} />
                <Route path="/market/:id" element={<MarketPage />} />
                <Route path="/portfolio" element={<PortfolioPage />} />
            </Route>
        </Routes>
    );
}
