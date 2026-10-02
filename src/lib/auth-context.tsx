'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb } from './firebase';
import { TerminalAccount, DEFAULT_TERMINAL_SETTINGS } from './types/terminal';
import { OFFICIAL_RUNIX_COMMAND_REFERENCE } from './workspace/command-reference';

interface AuthContextType {
  user: User | null;
  terminalAccount: TerminalAccount | null;
  loading: boolean;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, displayName: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshAccount: () => Promise<void>;
  updateAccountSettings: (newSettings: Partial<TerminalAccount['preferences']>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [terminalAccount, setTerminalAccount] = useState<TerminalAccount | null>(null);
  const [loading, setLoading] = useState(true);

  // Sync or initialize Terminal Account in Firestore
  const syncTerminalAccount = async (firebaseUser: User): Promise<TerminalAccount> => {
    // Generate optimistic fallback account immediately to avoid blocking UI
    const fallbackAccount: TerminalAccount = {
      accountId: firebaseUser.uid,
      firebaseUserId: firebaseUser.uid,
      email: firebaseUser.email || '',
      displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Runix Developer',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active',
      preferences: DEFAULT_TERMINAL_SETTINGS,
    };

    try {
      const db = getFirebaseDb();
      const accountRef = doc(db, 'terminalAccounts', firebaseUser.uid);
      
      // Strict 2-second timeout to prevent infinite hanging when Firestore is slow, offline, or restricted
      const getDocPromise = getDoc(accountRef);
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000));
      const snap = await Promise.race([getDocPromise, timeoutPromise]);

      if (snap && snap.exists()) {
        const data = snap.data();
        const account: TerminalAccount = {
          accountId: firebaseUser.uid,
          firebaseUserId: firebaseUser.uid,
          email: data.email || firebaseUser.email || '',
          displayName: data.displayName || firebaseUser.displayName || 'Runix Developer',
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : new Date().toISOString(),
          status: data.status || 'active',
          preferences: {
            ...DEFAULT_TERMINAL_SETTINGS,
            ...(data.preferences || {}),
          },
        };
        setTerminalAccount(account);
        return account;
      } else if (snap && !snap.exists()) {
        // First-time Terminal Account setup — write asynchronously in background
        setDoc(accountRef, {
          ...fallbackAccount,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }).catch((e) => console.warn('Terminal account setDoc error:', e));

        const defaultWorkspaceRef = doc(db, 'terminalAccounts', firebaseUser.uid, 'workspaces', 'default');
        setDoc(defaultWorkspaceRef, {
          workspaceId: 'default',
          accountId: firebaseUser.uid,
          name: 'main-workspace',
          description: 'Primary Runix developer workspace',
          rootPath: '/home/runix/workspace',
          fileCount: 1,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }).catch((e) => console.warn('Workspace setDoc error:', e));

        const commandRef = doc(db, 'terminalAccounts', firebaseUser.uid, 'workspaces', 'default', 'files', 'runix-command.txt');
        setDoc(commandRef, {
          path: 'runix-command.txt',
          name: 'runix-command.txt',
          type: 'file',
          size: OFFICIAL_RUNIX_COMMAND_REFERENCE.length,
          content: OFFICIAL_RUNIX_COMMAND_REFERENCE,
          updatedAt: serverTimestamp(),
        }).catch((e) => console.warn('Command file setDoc error:', e));

        setTerminalAccount(fallbackAccount);
        return fallbackAccount;
      } else {
        // Timed out fetching Firestore account doc — fallback optimistically
        setTerminalAccount(fallbackAccount);
        return fallbackAccount;
      }
    } catch (err) {
      console.warn('Firestore terminal account fetch error, using fallback:', err);
      setTerminalAccount(fallbackAccount);
      return fallbackAccount;
    }
  };

  useEffect(() => {
    // Safety timer: Never allow loading state to remain true for longer than 2.5s
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 2500);

    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      try {
        if (currentUser) {
          setUser(currentUser);
          await syncTerminalAccount(currentUser);
        } else {
          setUser(null);
          setTerminalAccount(null);
        }
      } catch (err) {
        console.error('Terminal Account synchronization error:', err);
      } finally {
        clearTimeout(safetyTimer);
        setLoading(false);
      }
    });

    return () => {
      clearTimeout(safetyTimer);
      unsubscribe();
    };
  }, []);

  const signInWithEmail = async (email: string, pass: string) => {
    const auth = getFirebaseAuth();
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    await syncTerminalAccount(cred.user);
  };

  const signUpWithEmail = async (email: string, pass: string, displayName: string) => {
    const auth = getFirebaseAuth();
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    const db = getFirebaseDb();
    const accountRef = doc(db, 'terminalAccounts', cred.user.uid);
    await setDoc(accountRef, {
      accountId: cred.user.uid,
      firebaseUserId: cred.user.uid,
      email: cred.user.email,
      displayName: displayName || cred.user.email?.split('@')[0],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      status: 'active',
      preferences: DEFAULT_TERMINAL_SETTINGS,
    });
    await syncTerminalAccount(cred.user);
  };

  const signInWithGoogle = async () => {
    const auth = getFirebaseAuth();
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    await syncTerminalAccount(cred.user);
  };

  const sendPasswordReset = async (email: string) => {
    const auth = getFirebaseAuth();
    await sendPasswordResetEmail(auth, email);
  };

  const signOut = async () => {
    const auth = getFirebaseAuth();
    await firebaseSignOut(auth);
    setUser(null);
    setTerminalAccount(null);
  };

  const refreshAccount = async () => {
    if (user) {
      await syncTerminalAccount(user);
    }
  };

  const updateAccountSettings = async (newSettings: Partial<TerminalAccount['preferences']>) => {
    if (!user || !terminalAccount) return;
    const db = getFirebaseDb();
    const accountRef = doc(db, 'terminalAccounts', user.uid);
    const merged = { ...terminalAccount.preferences, ...newSettings };
    await setDoc(accountRef, { preferences: merged, updatedAt: serverTimestamp() }, { merge: true });
    setTerminalAccount({
      ...terminalAccount,
      preferences: merged,
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        terminalAccount,
        loading,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        sendPasswordReset,
        signOut,
        refreshAccount,
        updateAccountSettings,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
