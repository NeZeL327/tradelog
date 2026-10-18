import { lazy, Suspense } from 'react'
import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { LanguageProvider } from '@/components/LanguageProvider';
import Login from './pages/Login';
import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonKpiRow, SkeletonRows } from '@/components/ui/skeleton-block';

const VisualEditAgent = import.meta.env.DEV
  ? lazy(() => import('@/lib/VisualEditAgent'))
  : () => null;
const PageNotFound = lazy(() => import('./lib/PageNotFound'));
const UserNotRegisteredError = lazy(() => import('@/components/UserNotRegisteredError'));
const Terms = lazy(() => import('./pages/Terms'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Cookies = lazy(() => import('./pages/Cookies'));
const TradeDetails = lazy(() => import('./pages/TradeDetails'));
const Home = lazy(() => import('./pages/Home'));
const Register = lazy(() => import('./pages/Register'));
const Pricing = lazy(() => import('./pages/Pricing'));
const About = lazy(() => import('./pages/About'));
const Contact = lazy(() => import('./pages/Contact'));
const Features = lazy(() => import('./pages/Features'));

const { Pages, Layout, mainPage } = pagesConfig;
// Retired pages: old bookmarks land on the Dashboard instead of a 404.
const REMOVED_PAGE_PATHS = ["/planned", "/Planned", "/missed", "/Missed"];
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const PageFallback = () => (
  <div role="status" aria-label="Loading" className="space-y-4 py-2">
    <div className="space-y-2">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-3 w-72 max-w-full" />
    </div>
    <SkeletonKpiRow count={5} />
    <SkeletonRows rows={6} className="rounded-ds-lg border border-ds-line p-3" />
  </div>
);

const LayoutWrapper = ({ children, currentPageName }) => {
  const body = <Suspense fallback={<PageFallback />}>{children}</Suspense>;
  if (currentPageName === "CalculatorPopup") {
    return body;
  }
  return Layout ? (
    <Layout currentPageName={currentPageName}>{body}</Layout>
  ) : (
    body
  );
};

const PageShell = ({ children }) => (
  <div style={{ width: "100%", maxWidth: "100%", minHeight: "100%" }}>
    {children}
  </div>
);

const RouteFallback = () => (
  <div role="status" aria-label="Loading" className="fixed inset-0 flex bg-ds-bg p-0 sm:p-6">
    <div className="flex flex-1 overflow-hidden rounded-none border border-ds-frame bg-ds-s1 sm:rounded-ds-xl">
      <div className="hidden w-[72px] flex-col items-center gap-4 border-r border-ds-line py-4 sm:flex">
        {Array.from({ length: 8 }).map((_, idx) => <Skeleton key={idx} className="h-8 w-8 rounded-ds-sm" />)}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-12 items-center justify-between border-b border-ds-line px-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-7 w-56 max-w-[50%]" />
        </div>
        <div className="space-y-4 p-4 sm:p-6">
          <Skeleton className="h-5 w-48" />
          <SkeletonKpiRow count={5} />
          <SkeletonRows rows={5} className="p-0" />
        </div>
      </div>
    </div>
  </div>
);

const publicLegalRoutes = (
  <>
    <Route path="/terms" element={<PageShell><Terms /></PageShell>} />
    <Route path="/privacy" element={<PageShell><Privacy /></PageShell>} />
    <Route path="/cookies" element={<PageShell><Cookies /></PageShell>} />
  </>
);

const publicMarketingRoutes = (
  <>
    <Route path="/home" element={<PageShell><Home /></PageShell>} />
    <Route path="/register" element={<PageShell><Register /></PageShell>} />
    <Route path="/Register" element={<PageShell><Register /></PageShell>} />
    <Route path="/pricing" element={<PageShell><Pricing /></PageShell>} />
    <Route path="/Pricing" element={<PageShell><Pricing /></PageShell>} />
    <Route path="/about" element={<PageShell><About /></PageShell>} />
    <Route path="/contact" element={<PageShell><Contact /></PageShell>} />
    <Route path="/features" element={<PageShell><Features /></PageShell>} />
    <Route path="/Features" element={<PageShell><Features /></PageShell>} />
  </>
);

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return <RouteFallback />;
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return (
        <Suspense fallback={<RouteFallback />}>
          <UserNotRegisteredError />
        </Suspense>
      );
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  if (!isAuthenticated) {
    return (
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<PageShell><Login /></PageShell>} />
          <Route path="/login" element={<PageShell><Login /></PageShell>} />
          <Route path="/Login" element={<PageShell><Login /></PageShell>} />
          {publicMarketingRoutes}
          {publicLegalRoutes}
          <Route path="*" element={<PageShell><Login /></PageShell>} />
        </Routes>
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={
          <LayoutWrapper currentPageName={mainPageKey}>
            <MainPage />
          </LayoutWrapper>
        } />
        {publicLegalRoutes}
        {publicMarketingRoutes}
        <Route
          path="/trade"
          element={
            <LayoutWrapper currentPageName="TradeDetails">
              <TradeDetails />
            </LayoutWrapper>
          }
        />
        <Route
          path="/trade/:tradeId"
          element={
            <LayoutWrapper currentPageName="TradeDetails">
              <TradeDetails />
            </LayoutWrapper>
          }
        />
        {Object.entries(Pages).map(([path, Page]) => (
          <Route
            key={path}
            path={`/${path}`}
            element={
              <LayoutWrapper currentPageName={path}>
                <Page />
              </LayoutWrapper>
            }
          />
        ))}
        {Object.entries(Pages).map(([path, Page]) => {
          const lower = path.toLowerCase();
          if (lower === path) return null;
          return (
            <Route
              key={`${path}-lower`}
              path={`/${lower}`}
              element={
                <LayoutWrapper currentPageName={path}>
                  <Page />
                </LayoutWrapper>
              }
            />
          );
        })}
        {REMOVED_PAGE_PATHS.map((path) => (
          <Route key={`removed-${path}`} path={path} element={<Navigate to="/dashboard" replace />} />
        ))}
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Suspense>
  );
};


function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <LanguageProvider>
          <Router
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true
            }}
          >
            <NavigationTracker />
            <AuthenticatedApp />
          </Router>
        </LanguageProvider>
        <Toaster />
        <SonnerToaster className="ds-toaster" position="top-right" closeButton />
        {import.meta.env.DEV && (
          <Suspense fallback={null}>
            <VisualEditAgent />
          </Suspense>
        )}
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
