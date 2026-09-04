/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import { lazy } from 'react';

const Accounts = lazy(() => import('./pages/Accounts'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Backtesting = lazy(() => import('./pages/Backtesting'));
const Calendar = lazy(() => import('./pages/Calendar'));
const CalculatorPopup = lazy(() => import('./pages/CalculatorPopup'));
const Calculators = lazy(() => import('./pages/Calculators'));
const Checklist = lazy(() => import('./pages/Checklist'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Goals = lazy(() => import('./pages/Goals'));
const Home = lazy(() => import('./pages/Home'));
const Journal = lazy(() => import('./pages/Journal'));
const Missed = lazy(() => import('./pages/Missed'));
const Notes = lazy(() => import('./pages/Notes'));
const Planned = lazy(() => import('./pages/Planned'));
const Raporty = lazy(() => import('./pages/Raporty'));
const ProcessReview = lazy(() => import('./pages/ProcessReview'));
const Settings = lazy(() => import('./pages/Settings'));
const Strategies = lazy(() => import('./pages/Strategies'));
const StrategyDetails = lazy(() => import('./pages/StrategyDetails'));
const Upload = lazy(() => import('./pages/Upload'));
const __Layout = lazy(() => import('./Layout.jsx'));


export const PAGES = {
    "Accounts": Accounts,
    "Analytics": Analytics,
    "Backtesting": Backtesting,
    "Calendar": Calendar,
    "CalculatorPopup": CalculatorPopup,
    "Calculators": Calculators,
    "Checklist": Checklist,
    "Dashboard": Dashboard,
    "Goals": Goals,
    "Home": Home,
    "Journal": Journal,
    "Planned": Planned,
    "Missed": Missed,
    "Notes": Notes,
    "Raporty": Raporty,
    "ProcessReview": ProcessReview,
    "Settings": Settings,
    "Strategies": Strategies,
    "StrategyDetails": StrategyDetails,
    "Upload": Upload,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};