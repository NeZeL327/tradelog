// Firestore data access layer for user data

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';
import imageCompression from 'browser-image-compression';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';

const userCollection = (userId, name) => collection(db, 'users', String(userId), name);

const mapDocs = (snapshot) => snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));

const runSafe = async (label, action) => {
  try {
    return await action();
  } catch (error) {
    console.error(`${label} error:`, error);
    throw error;
  }
};

const isImageFile = (file) => file && typeof file.type === 'string' && file.type.startsWith('image/');

export const compressImage = async (file) => {
  if (!isImageFile(file)) return file;

  const options = {
    maxSizeMB: 0.3,
    maxWidthOrHeight: 1600,
    useWebWorker: true,
    fileType: 'image/jpeg',
    initialQuality: 0.8
  };

  try {
    return await imageCompression(file, options);
  } catch (error) {
    console.error('compressImage error:', error);
    return file;
  }
};

export const updateUser = async (userId, updates) => {
  return runSafe('updateUser', async () => {
    if (!userId) return null;
    const userRef = doc(db, 'users', String(userId));
    await setDoc(userRef, { ...updates, updatedAt: serverTimestamp() }, { merge: true });
    const snapshot = await getDoc(userRef);
    return snapshot.exists() ? { id: userId, ...snapshot.data() } : null;
  });
};

export const getUserById = async (userId) => {
  return runSafe('getUserById', async () => {
    if (!userId) return null;
    const snapshot = await getDoc(doc(db, 'users', String(userId)));
    return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
  });
};

export const getTradingAccounts = async (userId) => {
  return runSafe('getTradingAccounts', async () => {
    if (!userId) return [];
    const snapshot = await getDocs(userCollection(userId, 'accounts'));
    return mapDocs(snapshot);
  });
};

export const createTradingAccount = async (userId, accountData) => {
  return runSafe('createTradingAccount', async () => {
    if (!userId) throw new Error('Użytkownik nie jest zalogowany');
    const payload = {
      ...accountData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    const refDoc = await addDoc(userCollection(userId, 'accounts'), payload);
    return { id: refDoc.id, ...payload };
  });
};

export const updateTradingAccount = async (userId, accountId, accountData) => {
  return runSafe('updateTradingAccount', async () => {
    if (!userId) throw new Error('Użytkownik nie jest zalogowany');
    const refDoc = doc(db, 'users', String(userId), 'accounts', String(accountId));
    await updateDoc(refDoc, { ...accountData, updatedAt: serverTimestamp() });
    const snapshot = await getDoc(refDoc);
    return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
  });
};

export const deleteTradingAccount = async (userId, accountId) => {
  return runSafe('deleteTradingAccount', async () => {
    if (!userId) throw new Error('Użytkownik nie jest zalogowany');
    const refDoc = doc(db, 'users', String(userId), 'accounts', String(accountId));
    await deleteDoc(refDoc);
    return true;
  });
};

export const getTrades = async (userId, filters = {}) => {
  return runSafe('getTrades', async () => {
    if (!userId) return [];
    const baseRef = userCollection(userId, 'trades');
    const constraints = [];

    if (filters.status) {
      constraints.push(where('status', '==', filters.status));
    }
    if (filters.accountId) {
      constraints.push(where('account_id', '==', filters.accountId));
    }

    const q = constraints.length
      ? query(baseRef, ...constraints, orderBy('date', 'desc'))
      : query(baseRef, orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return mapDocs(snapshot);
  });
};

export const createTrade = async (userId, tradeData) => {
  return runSafe('createTrade', async () => {
    if (!userId) throw new Error('Użytkownik nie jest zalogowany');
    const payload = {
      ...tradeData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    console.log('Creating trade in Firestore with payload:', payload);
    const refDoc = await addDoc(userCollection(userId, 'trades'), payload);
    console.log('Trade created with ID:', refDoc.id);
    return { id: refDoc.id, ...payload };
  });
};

export const updateTrade = async (userId, tradeId, tradeData) => {
  return runSafe('updateTrade', async () => {
    if (!userId) throw new Error('Użytkownik nie jest zalogowany');
    const refDoc = doc(db, 'users', String(userId), 'trades', String(tradeId));
    await updateDoc(refDoc, { ...tradeData, updatedAt: serverTimestamp() });
    const snapshot = await getDoc(refDoc);
    return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
  });
};

export const deleteTrade = async (userId, tradeId) => {
  return runSafe('deleteTrade', async () => {
    if (!userId) throw new Error('Użytkownik nie jest zalogowany');
    const refDoc = doc(db, 'users', String(userId), 'trades', String(tradeId));
    await deleteDoc(refDoc);
    return true;
  });
};

export const getStrategies = async (userId) => {
  return runSafe('getStrategies', async () => {
    if (!userId) return [];
    const snapshot = await getDocs(userCollection(userId, 'strategies'));
    return mapDocs(snapshot);
  });
};

export const createStrategy = async (userId, strategyData) => {
  return runSafe('createStrategy', async () => {
    if (!userId) throw new Error('Użytkownik nie jest zalogowany');
    const payload = {
      ...strategyData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    const refDoc = await addDoc(userCollection(userId, 'strategies'), payload);
    return { id: refDoc.id, ...payload };
  });
};

export const updateStrategy = async (userId, strategyId, strategyData) => {
  return runSafe('updateStrategy', async () => {
    if (!userId) throw new Error('Użytkownik nie jest zalogowany');
    const refDoc = doc(db, 'users', String(userId), 'strategies', String(strategyId));
    await updateDoc(refDoc, { ...strategyData, updatedAt: serverTimestamp() });
    const snapshot = await getDoc(refDoc);
    return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
  });
};

export const deleteStrategy = async (userId, strategyId) => {
  return runSafe('deleteStrategy', async () => {
    if (!userId) throw new Error('Użytkownik nie jest zalogowany');
    const refDoc = doc(db, 'users', String(userId), 'strategies', String(strategyId));
    await deleteDoc(refDoc);
    return true;
  });
};

export const getGoals = async (userId) => {
  return runSafe('getGoals', async () => {
    if (!userId) return [];
    const snapshot = await getDocs(userCollection(userId, 'goals'));
    return mapDocs(snapshot);
  });
};

export const createGoal = async (userId, goalData) => {
  return runSafe('createGoal', async () => {
    if (!userId) throw new Error('Użytkownik nie jest zalogowany');
    const payload = {
      ...goalData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    const refDoc = await addDoc(userCollection(userId, 'goals'), payload);
    return { id: refDoc.id, ...payload };
  });
};

export const updateGoal = async (userId, goalId, goalData) => {
  return runSafe('updateGoal', async () => {
    if (!userId) throw new Error('Użytkownik nie jest zalogowany');
    const refDoc = doc(db, 'users', String(userId), 'goals', String(goalId));
    await updateDoc(refDoc, { ...goalData, updatedAt: serverTimestamp() });
    const snapshot = await getDoc(refDoc);
    return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
  });
};

export const deleteGoal = async (userId, goalId) => {
  return runSafe('deleteGoal', async () => {
    if (!userId) throw new Error('Użytkownik nie jest zalogowany');
    const refDoc = doc(db, 'users', String(userId), 'goals', String(goalId));
    await deleteDoc(refDoc);
    return true;
  });
};

export const getTrips = async (userId) => {
  return runSafe('getTrips', async () => {
    if (!userId) return [];
    const snapshot = await getDocs(userCollection(userId, 'trips'));
    return mapDocs(snapshot);
  });
};

export const createTrip = async (userId, tripData) => {
  return runSafe('createTrip', async () => {
    if (!userId) throw new Error('Użytkownik nie jest zalogowany');
    const payload = {
      ...tripData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    const refDoc = await addDoc(userCollection(userId, 'trips'), payload);
    return { id: refDoc.id, ...payload };
  });
};

export const updateTrip = async (userId, tripId, tripData) => {
  return runSafe('updateTrip', async () => {
    if (!userId) throw new Error('Użytkownik nie jest zalogowany');
    const refDoc = doc(db, 'users', String(userId), 'trips', String(tripId));
    await updateDoc(refDoc, { ...tripData, updatedAt: serverTimestamp() });
    const snapshot = await getDoc(refDoc);
    return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
  });
};

export const deleteTrip = async (userId, tripId) => {
  return runSafe('deleteTrip', async () => {
    if (!userId) throw new Error('Użytkownik nie jest zalogowany');
    const refDoc = doc(db, 'users', String(userId), 'trips', String(tripId));
    await deleteDoc(refDoc);
    return true;
  });
};

export const getExpenses = async (userId) => {
  return runSafe('getExpenses', async () => {
    if (!userId) return [];
    const snapshot = await getDocs(userCollection(userId, 'expenses'));
    return mapDocs(snapshot);
  });
};

export const createExpense = async (userId, expenseData) => {
  return runSafe('createExpense', async () => {
    if (!userId) throw new Error('Użytkownik nie jest zalogowany');
    const payload = {
      ...expenseData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    const refDoc = await addDoc(userCollection(userId, 'expenses'), payload);
    return { id: refDoc.id, ...payload };
  });
};

export const updateExpense = async (userId, expenseId, expenseData) => {
  return runSafe('updateExpense', async () => {
    if (!userId) throw new Error('Użytkownik nie jest zalogowany');
    const refDoc = doc(db, 'users', String(userId), 'expenses', String(expenseId));
    await updateDoc(refDoc, { ...expenseData, updatedAt: serverTimestamp() });
    const snapshot = await getDoc(refDoc);
    return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
  });
};

export const deleteExpense = async (userId, expenseId) => {
  return runSafe('deleteExpense', async () => {
    if (!userId) throw new Error('Użytkownik nie jest zalogowany');
    const refDoc = doc(db, 'users', String(userId), 'expenses', String(expenseId));
    await deleteDoc(refDoc);
    return true;
  });
};

export const uploadUserFile = async (userId, file, folder = 'uploads') => {
  return runSafe('uploadUserFile', async () => {
    if (!userId || !file) return '';
    const fileToUpload = await compressImage(file);
    const safeName = file.name ? file.name.replace(/\s+/g, '_') : `file_${Date.now()}`;
    const path = `users/${userId}/${folder}/${Date.now()}_${safeName}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, fileToUpload);
    return getDownloadURL(storageRef);
  });
};

export const uploadTradeScreenshot = async (userId, file) => {
  return runSafe('uploadTradeScreenshot', async () => {
    if (!userId || !file) return '';
    const fileToUpload = await compressImage(file);
    const safeName = file.name ? file.name.replace(/\s+/g, '_') : `file_${Date.now()}`;
    const path = `tradeScreenshots/${userId}/${Date.now()}_${safeName}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, fileToUpload);
    return getDownloadURL(storageRef);
  });
};

export const seedTradingData = () => Promise.resolve();
export const initDemoData = () => Promise.resolve();
