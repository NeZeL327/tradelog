import React, { createContext, useState, useContext, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
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
          fullName: authUser.displayName || '',
          language: 'pl',
          theme: 'dark',
          skin: 'blackblu',
          createdAt: serverTimestamp()
        };
        await setDoc(userRef, profile, { merge: true });
        return profile;
      }
      return snapshot.data();
    } catch (error) {
      console.error('Ensure profile error:', error);
      throw error;
    }
  };

  const initializeApp = () => {
    const unsubscribe = onAuthStateChanged(auth, async (nextFirebaseUser) => {
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

        setUser(mergedUser);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Error initializing auth state:', error);
        setAuthError({
          type: 'init_error',
          message: 'Błąd inicjalizacji aplikacji'
        });
      } finally {
        setIsLoadingAuth(false);
      }
    });

    return unsubscribe;
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
      console.error('Profile refresh error:', error);
    }
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

  const logout = (shouldRedirect = true) => {
    try {
      signOut(auth);

      setUser(null);
      setIsAuthenticated(false);

      if (shouldRedirect) {
        window.location.href = '/';
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const navigateToLogin = () => {
    window.location.href = '/Login';
  };

  const navigateToRegister = () => {
    window.location.href = '/Register';
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      authError,
      login,
      logout,
      navigateToLogin,
      navigateToRegister,
      checkSession: refreshProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
