import React, { createContext, useState, useContext, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  getRedirectResult,
  signOut,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { logger } from '@/lib/logger';
import {
  applyRuntimeSettings,
  DEFAULT_USER_SETTINGS,
  getEffectiveUserSettings,
  loadLocalUserSettings,
  resetLocalSessionForFreshUser,
} from '@/lib/userSettings';
import { queryClientInstance } from '@/lib/query-client';

const AuthContext = createContext(undefined);

const SOCIAL_DISABLED_MESSAGE = 'Logowanie społecznościowe jest wyłączone. Użyj e-maila i hasła.';

const isPasswordOnlyUser = (authUser) => {
  const providers = (authUser?.providerData || []).map((item) => item.providerId);
  if (!providers.length) return false;
  return providers.every((id) => id === 'password');
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const unsubscribe = initializeApp();
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  /** New Auth users (created in Firebase Console) get an empty profile — no demo data. */
  const ensureProfile = async (authUser) => {
    if (!authUser) return null;
    try {
      const userRef = doc(db, 'users', authUser.uid);
      const snapshot = await getDoc(userRef);
      if (!snapshot.exists()) {
        const profile = {
          email: authUser.email || '',
          fullName: authUser.displayName || authUser.email?.split('@')[0] || '',
          displayName: '',
          avatar: 'initials',
          language: DEFAULT_USER_SETTINGS.language,
          theme: 'dark',
          skin: 'blackblu',
          default_currency: DEFAULT_USER_SETTINGS.default_currency,
          timezone: DEFAULT_USER_SETTINGS.timezone,
          trade_time_source: DEFAULT_USER_SETTINGS.trade_time_source,
          date_format: DEFAULT_USER_SETTINGS.date_format,
          time_format: DEFAULT_USER_SETTINGS.time_format,
          show_session_clocks: DEFAULT_USER_SETTINGS.show_session_clocks,
          notifications_enabled: DEFAULT_USER_SETTINGS.notifications_enabled,
          show_weekends: DEFAULT_USER_SETTINGS.show_weekends,
          privacy_mode: DEFAULT_USER_SETTINGS.privacy_mode,
          start_page: DEFAULT_USER_SETTINGS.start_page,
          pnl_view: DEFAULT_USER_SETTINGS.pnl_view,
          createdAt: serverTimestamp(),
        };
        await setDoc(userRef, profile, { merge: true });
        return { ...profile, _isNew: true };
      }
      return snapshot.data();
    } catch (error) {
      logger.error('Ensure profile error', error);
      throw error;
    }
  };

  const rejectSession = async (message) => {
    try {
      await signOut(auth);
    } catch {
      /* still clear local session */
    }
    queryClientInstance.clear();
    setFirebaseUser(null);
    setUser(null);
    setIsAuthenticated(false);
    setAuthError({
      type: 'login_error',
      message: message || SOCIAL_DISABLED_MESSAGE,
    });
  };

  const applyAuthenticatedUser = async (nextFirebaseUser) => {
    if (!isPasswordOnlyUser(nextFirebaseUser)) {
      await rejectSession(SOCIAL_DISABLED_MESSAGE);
      throw new Error(SOCIAL_DISABLED_MESSAGE);
    }

    queryClientInstance.clear();
    const profile = await ensureProfile(nextFirebaseUser);
    const isNew = Boolean(profile?._isNew);

    if (isNew) {
      resetLocalSessionForFreshUser();
    }

    const { _isNew, ...cloudProfile } = profile || {};
    const mergedUser = {
      id: nextFirebaseUser.uid,
      email: nextFirebaseUser.email || cloudProfile?.email || '',
      fullName: cloudProfile?.fullName || nextFirebaseUser.displayName || '',
      ...cloudProfile,
    };

    const effective = getEffectiveUserSettings({
      cloudSettings: cloudProfile,
      // Fresh Firebase accounts must not inherit another user's browser prefs
      localSettings: isNew ? {} : loadLocalUserSettings(),
    });
    applyRuntimeSettings(effective);

    setFirebaseUser(nextFirebaseUser);
    setUser(mergedUser);
    setIsAuthenticated(true);
    return { mergedUser, effective, isNew };
  };

  const initializeApp = () => {
    let unsubscribe = () => {};

    const setupAuth = () => {
      unsubscribe = onAuthStateChanged(auth, async (nextFirebaseUser) => {
        try {
          if (!nextFirebaseUser) {
            queryClientInstance.clear();
            setFirebaseUser(null);
            setUser(null);
            setIsAuthenticated(false);
            return;
          }

          await applyAuthenticatedUser(nextFirebaseUser);
        } catch (error) {
          if (error?.message === SOCIAL_DISABLED_MESSAGE) {
            return;
          }
          logger.error('Error initializing auth state', error);
          setAuthError({
            type: 'init_error',
            message: 'Błąd inicjalizacji aplikacji'
          });
        } finally {
          setIsLoadingAuth(false);
        }
      });
    };

    getRedirectResult(auth)
      .then(async (result) => {
        if (result?.user) {
          if (!isPasswordOnlyUser(result.user)) {
            await rejectSession(SOCIAL_DISABLED_MESSAGE);
            setIsLoadingAuth(false);
            setupAuth();
            return;
          }
          applyAuthenticatedUser(result.user)
            .then(({ effective }) => {
              setIsLoadingAuth(false);
              window.location.href = effective?.start_page || '/Dashboard';
            })
            .catch((err) => {
              logger.error('Redirect ensureProfile error', err);
              setIsLoadingAuth(false);
              setAuthError({ type: 'login_error', message: 'Błąd po logowaniu. Spróbuj ponownie.' });
              setupAuth();
            });
          return;
        }
        setupAuth();
      })
      .catch((error) => {
        logger.error('Redirect result error', error);
        setAuthError({
          type: 'login_error',
          message: error?.code === 'auth/unauthorized-domain'
            ? 'Domena nie jest autoryzowana – dodaj ją w Firebase Console (Authentication → Settings → Authorized domains).'
            : 'Logowanie nie powiodło się. Spróbuj ponownie.',
        });
        setIsLoadingAuth(false);
        setupAuth();
      });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  };

  const refreshProfile = async () => {
    if (!firebaseUser) return;
    try {
      const snapshot = await getDoc(doc(db, 'users', firebaseUser.uid));
      const profile = snapshot.exists() ? snapshot.data() : null;
      setUser((prev) => ({
        id: firebaseUser.uid,
        email: firebaseUser.email || prev?.email || '',
        fullName: profile?.fullName || firebaseUser.displayName || prev?.fullName || '',
        ...profile,
        ...prev
      }));
    } catch (error) {
      logger.error('Profile refresh error', error);
    }
  };

  /** Social login stays in the API but is blocked — accounts are email/password only (Firebase Console). */
  const loginWithGoogle = async () => {
    setAuthError({ type: 'login_error', message: SOCIAL_DISABLED_MESSAGE });
    throw new Error(SOCIAL_DISABLED_MESSAGE);
  };

  const loginWithApple = async () => {
    setAuthError({ type: 'login_error', message: SOCIAL_DISABLED_MESSAGE });
    throw new Error(SOCIAL_DISABLED_MESSAGE);
  };

  const login = async (email, password) => {
    try {
      setAuthError(null);
      const normalizedEmail = String(email || '').trim().toLowerCase();
      if (!normalizedEmail || !password) {
        throw new Error('Nieprawidłowy email lub hasło');
      }
      await signInWithEmailAndPassword(auth, normalizedEmail, password);
      return true;
    } catch (error) {
      const errorCode = error?.code || '';
      const message =
        errorCode === 'auth/too-many-requests'
          ? 'Zbyt wiele prób. Spróbuj później.'
          : errorCode === 'auth/user-disabled'
            ? 'Konto jest zablokowane'
            : errorCode === 'auth/invalid-email'
              ? 'Nieprawidłowy email'
              : error?.message === 'Nieprawidłowy email lub hasło'
                ? error.message
                : 'Nieprawidłowy email lub hasło';
      setAuthError({
        type: 'login_error',
        message
      });
      throw new Error(message);
    }
  };

  const logout = async (shouldRedirect = true) => {
    try {
      await signOut(auth);
      queryClientInstance.clear();
      setUser(null);
      setFirebaseUser(null);
      setIsAuthenticated(false);
      setAuthError(null);
      if (shouldRedirect) {
        window.location.href = '/';
      }
    } catch (error) {
      console.error('Logout error:', error);
      queryClientInstance.clear();
      setUser(null);
      setFirebaseUser(null);
      setIsAuthenticated(false);
      if (shouldRedirect) {
        window.location.href = '/';
      }
    }
  };

  const navigateToLogin = () => {
    window.location.href = '/';
  };

  const navigateToRegister = () => {
    window.location.href = '/';
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      login,
      loginWithGoogle,
      loginWithApple,
      logout,
      navigateToLogin,
      navigateToRegister,
      checkSession: refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

/** Hook do użycia tylko wewnątrz AuthProvider. Rzuca błąd poza providerem. */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/** Bezpieczna wersja – zwraca null poza AuthProvider (np. przy HMR lub błędzie granicy). */
export const useOptionalAuth = () => {
  return useContext(AuthContext) ?? null;
};
