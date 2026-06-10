import React, { useState } from 'react';
import LiveStreamPage from './pages/LiveStreamPage';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Footer from './components/Footer';
import ArticleList from './components/ArticleList';
import ScheduleModal from './components/ScheduleModal';
import { ThemeProvider } from './context/ThemeContext';
import { ConfigProvider, ConfigContext } from './context/ConfigContext';
import AdminPage from './pages/AdminPage';
import DynamicRoutePage from './pages/DynamicRoutePage';
import ArticleDetail from './pages/ArticleDetail';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';

function MainLayout() {
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);

  return (
    <div className="landing-layout">
      <Header onOpenSchedule={() => setIsScheduleOpen(true)} />
      
      <main className="main-content-area">
        <Sidebar />
        
        <div className="content-center">
          <Outlet />
        </div>
      </main>

      <Footer />
      <ScheduleModal isOpen={isScheduleOpen} onClose={() => setIsScheduleOpen(false)} />
    </div>
  );
}

function AppContent() {
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const { config } = React.useContext(ConfigContext);

  // Inject scripts and favicon
  React.useEffect(() => {
    if (config?.settings?.faviconUrl) {
      let link = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = `https://api.dagacpc.live${config.settings.faviconUrl}`;
    }

    if (config?.settings?.scriptTags) {
      let container = document.getElementById('dynamic-scripts');
      if (!container) {
        container = document.createElement('div');
        container.id = 'dynamic-scripts';
        document.body.appendChild(container);
      }
      container.innerHTML = config.settings.scriptTags;
      
      Array.from(container.querySelectorAll('script')).forEach(oldScript => {
        const newScript = document.createElement('script');
        Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
        newScript.appendChild(document.createTextNode(oldScript.innerHTML));
        oldScript.parentNode.replaceChild(newScript, oldScript);
      });
    }
  }, [config?.settings?.scriptTags]);

  return (
    <Routes>
      <Route path="/admin" element={<AdminPage />} />
      <Route element={<MainLayout />}>
        <Route path="/" element={<><LiveStreamPage /><ArticleList /></>} />
        <Route path="/tin-tuc" element={
          <div style={{ padding: '1rem', background: 'var(--panel-bg)', borderRadius: '16px', border: '1px solid var(--panel-border)', minHeight: '60vh' }}>
            <ArticleList />
          </div>
        } />
        <Route path="/:slug" element={<DynamicRoutePage />} />
        <Route path="/:categorySlug/:articleSlug" element={<ArticleDetail />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <ConfigProvider>
      <ThemeProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </ThemeProvider>
    </ConfigProvider>
  );
}

export default App;
