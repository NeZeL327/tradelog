import React, { createContext, useState, useContext, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  GoogleAuthProvider,
  OAuthProvider,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { logger } from '@/lib/logger';
import { applyRuntimeSettings, getEffectiveUserSettings, loadLocalUserSettings } from '@/lib/userSettings';

const AuthContext = createContext(undefined);

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

  const ensureProfile = async (authUser) => {
    if (!authUser) return null;
    try {
      const userRef = doc(db, 'users', authUser.uid);
      const snapshot = await getDoc(userRef);
      if (!snapshot.exists()) {
        const profile = {
          email: authUser.email || '',
          fullName: authUser.displayName || authUser.email?.split('@')[0] || '',
          language: 'pl',
          theme: 'dark',
          skin: 'blackblu',
          createdAt: serverTimestamp(),
        };
        await setDoc(userRef, profile, { merge: true });
        return profile;
      }
      return snapshot.data();
    } catch (error) {
      logger.error('Ensure profile error', error);
      throw error;
    }
  };

  const initializeApp = () => {
    let unsubscribe = () => {};

    const setupAuth = () => {
      unsubscribe = onAuthStateChanged(auth, async (nextFirebaseUser) => {
        try {
          setFirebaseUser(nextFirebaseUser || null);
          if (!nextFirebaseUser) {
            setUser(null);
            setIsAuthenticated(false);
            return;
          }

          const profile = await ensureProfile(nextFirebaseUser);
          const mergedUser = {
            id: nextFirebaseUser.uid,
            email: nextFirebaseUser.email || profile?.email || '',
            fullName: profile?.fullName || nextFirebaseUser.displayName || '',
            ...profile
          };

          const effective = getEffectiveUserSettings({
            cloudSettings: profile,
            localSettings: loadLocalUserSettings(),
          });
          applyRuntimeSettings(effective);

          setUser(mergedUser);
          setIsAuthenticated(true);
        } catch (error) {
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
      .then((result) => {
        if (result?.user) {
          ensureProfile(result.user)
            .then((profile) => {
              const mergedUser = {
                id: result.user.uid,
                email: result.user.email || profile?.email || '',
                fullName: profile?.fullName || result.user.displayName || result.user.email?.split('@')[0] || '',
                ...profile,
              };
              const effective = getEffectiveUserSettings({
                cloudSettings: profile,
                localSettings: loadLocalUserSettings(),
              });
              applyRuntimeSettings(effective);

              setFirebaseUser(result.user);
              setUser(mergedUser);
              setIsAuthenticated(true);
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

  /** Logowanie Google – przekierowanie (bez popup). Firebase Console: Authentication → Sign-in method → Google → Włącz. */
  const loginWithGoogle = async () => {
    setAuthError(null);
    const provider = new GoogleAuthProvider();
    await signInWithRedirect(auth, provider);
    return true;
  };

  /** Logowanie Apple – przekierowanie (bez popup). Wymaga konfiguracji Apple w Firebase. */
  const loginWithApple = async () => {
    setAuthError(null);
    const provider = new OAuthProvider('apple.com');
    provider.addScope('email');
    provider.addScope('name');
    await signInWithRedirect(auth, provider);
    return true;
  };

  const login = async (email, password) => {
    try {
      setAuthError(null);
      await signInWithEmailAndPassword(auth, email, password);
      return true;
    } catch (error) {
      const errorCode = error?.code || '';
      const message =
        errorCode === 'auth/invalid-email'
          ? 'Nieprawidłowy email'
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
      setUser(null);
      setFirebaseUser(null);
      setIsAuthenticated(false);
      setAuthError(null);
      if (shouldRedirect) {
        window.location.href = '/';
      }
    } catch (error) {
      console.error('Logout error:', error);
      setUser(null);
      setFirebaseUser(null);
      setIsAuthenticated(false);
      if (shouldRedirect) {
        window.location.href = '/';
      }
    }
  };

  const navigateToLogin = () => {
    window.location.href = '/login';
  };

  const navigateToRegister = () => {
    window.location.href = '/register';
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
