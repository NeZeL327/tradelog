import { useEffect, useState } from "react";
import { useOptionalAuth } from "@/lib/AuthContext";
import { getEffectiveUserSettings, loadLocalUserSettings } from "@/lib/userSettings";

export function useUserSettings() {
  const auth = useOptionalAuth();
  const [localSettings, setLocalSettings] = useState(() => loadLocalUserSettings());

  useEffect(() => {
    const sync = () => setLocalSettings(loadLocalUserSettings());
    window.addEventListener("user-settings-changed", sync);
    return () => window.removeEventListener("user-settings-changed", sync);
  }, []);

  return getEffectiveUserSettings({
    cloudSettings: auth?.user,
    localSettings,
  });
}
