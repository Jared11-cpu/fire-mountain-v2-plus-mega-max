import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { LandingPage } from './components/LandingPage';
import { PitchPage } from './components/PitchPage';
import { PlannerPage } from './components/PlannerPage';
import { JournalPage } from './components/JournalPage';
import { navItems } from './data/mockData';
import { decodeSharePlan } from './domain/trip';
import { useTrip } from './state/tripStore';

type PageId = (typeof navItems)[number]['id'];
const routeFor: Record<PageId, string> = { home: '/', planner: '/planner', journal: '/journal', pitch: '/about' };

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { selectCity, updateRequest, generateFromText, setPlan } = useTrip();
  const page: PageId = location.pathname.startsWith('/planner') || location.pathname.startsWith('/plan/')
    ? 'planner'
    : location.pathname.startsWith('/journal') ? 'journal' : location.pathname.startsWith('/about') ? 'pitch' : 'home';

  const go = (next: PageId) => {
    navigate(routeFor[next]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen text-ink">
      <Header page={page} nav={navItems} onNavigate={go} />
      <Routes>
        <Route path="/" element={<LandingPage onStart={(prompt) => { if (prompt) { updateRequest({ freeText: prompt }); setPlan(null); go('planner'); void generateFromText(prompt); return; } go('planner'); }} onCitySelect={(city) => { selectCity(city); go('planner'); }} onFootprintDetail={() => go('journal')} />} />
        <Route path="/planner" element={<PlannerPage />} />
        <Route path="/journal" element={<JournalPage />} />
        <Route path="/journal/:entryId" element={<JournalPage />} />
        <Route path="/about" element={<PitchPage />} />
        <Route path="/plan/:planId" element={<SharedPlanPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Footer />
    </div>
  );
}

function SharedPlanPage() {
  const { planId } = useParams();
  const [search] = useSearchParams();
  const { plan, setPlan, updateRequest, notify } = useTrip();
  const encoded = search.get('data');
  useEffect(() => {
    if (!encoded) {
      if (!plan || plan.id !== planId) notify('未找到这个分享方案，请检查链接是否完整。', 'error');
      return;
    }
    try {
      const shared = decodeSharePlan(encoded);
      setPlan(shared);
      updateRequest(shared.requestSnapshot);
      notify('分享方案已在本机恢复（不含照片与真实足迹）。', 'success');
    } catch (error) {
      notify(error instanceof Error ? error.message : '分享链接无法读取。', 'error');
    }
  }, [encoded, notify, plan, planId, setPlan, updateRequest]);
  return <PlannerPage />;
}

export default App;
