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
import Accounts from './pages/Accounts';
import Analytics from './pages/Analytics';
import Billing from './pages/Billing';
import Calendar from './pages/Calendar';
import Dashboard from './pages/Dashboard';
import Goals from './pages/Goals';
import Home from './pages/Home';
import Journal from './pages/Journal';
import Notes from './pages/Notes';
import ProgressTracker from './pages/ProgressTracker';
import Settings from './pages/Settings';
import Strategies from './pages/Strategies';
import StrategyDetails from './pages/StrategyDetails';
import Upload from './pages/Upload';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Accounts": Accounts,
    "Analytics": Analytics,
    "Billing": Billing,
    "Calendar": Calendar,
    "Dashboard": Dashboard,
    "Goals": Goals,
    "Home": Home,
    "Journal": Journal,
    "Notes": Notes,
    "ProgressTracker": ProgressTracker,
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