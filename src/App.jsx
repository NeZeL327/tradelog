import './App.css'
import { lazy, Suspense } from 'react'
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { LanguageProvider } from '@/components/LanguageProvider';
import Login from './pages/Login';

const VisualEditAgent = import.meta.env.DEV
  ? lazy(() => import('@/lib/VisualEditAgent'))
  : () => null;
const PageNotFound = lazy(() => import('./lib/PageNotFound'));
const UserNotRegisteredError = lazy(() => import('@/components/UserNotRegisteredError'));
const Terms = lazy(() => import('./pages/Terms'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Cookies = lazy(() => import('./pages/Cookies'));

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const PageFallback = () => (
  <div className="flex items-center justify-center min-h-[40vh]">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
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
  <div className="fixed inset-0 flex items-center justify-center bg-[hsl(var(--app-shell))]">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
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
      <Routes>
        <Route path="/" element={<PageShell><Login /></PageShell>} />
        <Route path="/login" element={<PageShell><Login /></PageShell>} />
        <Route path="/Login" element={<PageShell><Login /></PageShell>} />
        <Route path="*" element={<PageShell><Login /></PageShell>} />
      </Routes>
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
        <Route path="/terms" element={<PageShell><Terms /></PageShell>} />
        <Route path="/privacy" element={<PageShell><Privacy /></PageShell>} />
        <Route path="/cookies" element={<PageShell><Cookies /></PageShell>} />
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
