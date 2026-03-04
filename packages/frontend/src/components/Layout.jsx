import { Outlet } from 'react-router-dom';
import Header from './Header';
import './Layout.css';

export default function Layout() {
    return (
        <div className="layout">
            <Header />
            <main className="layout__main">
                <Outlet />
            </main>
            <footer className="layout__footer">
                <p>Built with ❤️ on <span className="text-cyan">Sui</span> · Powered by <span className="text-cyan">Chainlink CRE</span> · Stored on <span className="text-gold">Walrus</span></p>
            </footer>
        </div>
    );
}
