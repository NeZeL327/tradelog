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
const Billing = lazy(() => import('./pages/Billing'));
const Calendar = lazy(() => import('./pages/Calendar'));
const CalculatorPopup = lazy(() => import('./pages/CalculatorPopup'));
const Calculators = lazy(() => import('./pages/Calculators'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Journal = lazy(() => import('./pages/Journal'));
const Settings = lazy(() => import('./pages/Settings'));
const Strategies = lazy(() => import('./pages/Strategies'));
const StrategyDetails = lazy(() => import('./pages/StrategyDetails'));
const TradeDetails = lazy(() => import('./pages/TradeDetails'));
const __Layout = lazy(() => import('./Layout.jsx'));


export const PAGES = {
    "Accounts": Accounts,
    "Analytics": Analytics,
    "Backtesting": Backtesting,
    "Billing": Billing,
    "Calendar": Calendar,
    "CalculatorPopup": CalculatorPopup,
    "Calculators": Calculators,
    "Dashboard": Dashboard,
    "Journal": Journal,
    "Settings": Settings,
    "Strategies": Strategies,
    "StrategyDetails": StrategyDetails,
    "TradeDetails": TradeDetails,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};