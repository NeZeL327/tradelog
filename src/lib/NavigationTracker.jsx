import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function NavigationTracker() {
    const location = useLocation();

    useEffect(() => {
        window.parent?.postMessage({
            type: "app_changed_url",
            url: window.location.href
        }, '*');
    }, [location]);

    useEffect(() => {
        const pathname = location.pathname || '/';
        document.body.setAttribute('data-route', pathname);
        document.body.setAttribute('data-is-home', pathname === '/' ? 'true' : 'false');
    }, [location.pathname]);

    return null;
}
