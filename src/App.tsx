import { useState } from 'react';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { BusinessPage } from './components/BusinessPage';
import { DashboardPage } from './components/DashboardPage';
import { GuidePage } from './components/GuidePage';
import { LandingPage } from './components/LandingPage';
import { PitchPage } from './components/PitchPage';
import { PlannerPage } from './components/PlannerPage';
import { navItems, type CityName } from './data/mockData';

type PageId = (typeof navItems)[number]['id'];

function App() {
  const [page, setPage] = useState<PageId>('home');
  const [plannerCity, setPlannerCity] = useState<CityName>('宜昌');

  const navigate = (next: PageId) => {
    setPage(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const selectCity = (city: CityName) => {
    setPlannerCity(city);
    navigate('planner');
  };

  return (
    <div className="min-h-screen text-ink">
      <Header page={page} nav={navItems} onNavigate={navigate} />
      {page === 'home' && <LandingPage onStart={() => navigate('planner')} onCitySelect={selectCity} />}
      {page === 'planner' && <PlannerPage initialCity={plannerCity} />}
      {page === 'guide' && <GuidePage />}
      {page === 'business' && <BusinessPage />}
      {page === 'dashboard' && <DashboardPage />}
      {page === 'pitch' && <PitchPage />}
      <Footer />
    </div>
  );
}

export default App;
