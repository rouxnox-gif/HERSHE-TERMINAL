import React, { useState, useEffect } from 'react';
import {
  registerNewStorePin,
  connectExistingStorePin,
  getStoredPinCode,
  clearStoredPinCode,
  getUserRegisteredStores,
  UserStoreRecord,
} from '../utils/firebaseSync';
import { auth, signInWithGoogle, signOutGoogle, subscribeToAuth } from '../lib/firebase';
import { User } from 'firebase/auth';
import { StorageData } from '../utils/storage';
import {
  KeyRound,
  Store,
  PlusCircle,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  X,
  Radio,
  Building2,
  Delete,
  RotateCcw,
  LogIn,
  LogOut,
  UserCheck,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

interface StorePinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPinSuccess: (syncedData: StorageData, pinCode: string) => void;
  canCloseWithoutPin?: boolean;
}

export const StorePinModal: React.FC<StorePinModalProps> = ({
  isOpen,
  onClose,
  onPinSuccess,
  canCloseWithoutPin = false,
}) => {
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [pinDigits, setPinDigits] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentActivePin, setCurrentActivePin] = useState<string | null>(getStoredPinCode());
  const [googleUser, setGoogleUser] = useState<User | null>(auth.currentUser);
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [userStores, setUserStores] = useState<UserStoreRecord[]>([]);
  const [loadingUserStores, setLoadingUserStores] = useState<boolean>(false);

  // Load registered stores belonging to this Google user
  const fetchUserStores = async (uid: string) => {
    setLoadingUserStores(true);
    try {
      const stores = await getUserRegisteredStores(uid);
      setUserStores(stores);
      // If user has a registered store PIN and no active PIN is set or user switched accounts
      if (stores.length > 0) {
        const userScopedPin = getStoredPinCode(uid) || stores[0].pin;
        if (userScopedPin && !currentActivePin) {
          setCurrentActivePin(userScopedPin);
        }
      }
    } catch (err) {
      console.warn('[StorePinModal] Error loading user stores:', err);
    } finally {
      setLoadingUserStores(false);
    }
  };

  useEffect(() => {
    const unsub = subscribeToAuth((user) => {
      setGoogleUser(user);
      if (user?.uid) {
        fetchUserStores(user.uid);
        const userPin = getStoredPinCode(user.uid);
        if (userPin) {
          setCurrentActivePin(userPin);
        }
      } else {
        setUserStores([]);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (isOpen) {
      const active = getStoredPinCode(googleUser?.uid);
      setCurrentActivePin(active || getStoredPinCode());
      setErrorMessage(null);
      setPinDigits('');
      setGoogleUser(auth.currentUser);
      if (auth.currentUser?.uid) {
        fetchUserStores(auth.currentUser.uid);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    setErrorMessage(null);
    try {
      const user = await signInWithGoogle();
      setGoogleUser(user);
      if (user?.uid) {
        await fetchUserStores(user.uid);
      }
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        // User closed or cancelled popup window
        setErrorMessage('Sign-in cancelled. Please click "Sign in with Google" when ready.');
        return;
      }
      console.warn('Google sign in note:', err?.message || err);
      setErrorMessage(err?.message || 'Failed to sign in with Google.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleSignOut = async () => {
    try {
      const oldUid = googleUser?.uid;
      await signOutGoogle();
      setGoogleUser(null);
      setUserStores([]);
      clearStoredPinCode(oldUid);
      setCurrentActivePin(null);
      setPinDigits('');
      setErrorMessage(null);
    } catch (err: any) {
      console.warn('Google sign out note:', err?.message || err);
    }
  };

  const handleKeyPress = (digit: string) => {
    if (pinDigits.length < 4) {
      setPinDigits((prev) => prev + digit);
      setErrorMessage(null);
    }
  };

  const handleDelete = () => {
    setPinDigits((prev) => prev.slice(0, -1));
    setErrorMessage(null);
  };

  const handleClear = () => {
    setPinDigits('');
    setErrorMessage(null);
  };

  const handleConnectWithPin = async (pinToUse: string, isNewStore = false) => {
    if (!googleUser) {
      setErrorMessage('Please sign in with Google first before continuing.');
      return;
    }

    if (pinToUse.length !== 4) {
      setErrorMessage('Please enter all 4 digits of your Store PIN.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      if (isNewStore) {
        const data = await registerNewStorePin(pinToUse);
        setCurrentActivePin(pinToUse);
        if (googleUser?.uid) {
          await fetchUserStores(googleUser.uid);
        }
        onPinSuccess(data, pinToUse);
        onClose();
      } else {
        const data = await connectExistingStorePin(pinToUse);
        setCurrentActivePin(pinToUse);
        if (googleUser?.uid) {
          await fetchUserStores(googleUser.uid);
        }
        onPinSuccess(data, pinToUse);
        onClose();
      }
    } catch (err: any) {
      console.warn('Store PIN notice:', err?.message || err);
      setErrorMessage(err?.message || 'Failed to process store PIN. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    await handleConnectWithPin(pinDigits, mode === 'new');
  };

  const handleDisconnectCurrentPin = () => {
    clearStoredPinCode(googleUser?.uid);
    setCurrentActivePin(null);
    setPinDigits('');
    setErrorMessage(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-4 max-h-[92vh] overflow-y-auto no-scrollbar">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Store PIN Gateway
                <span className="text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  REAL-TIME
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Secure store synchronization per Google account
              </p>
            </div>
          </div>
          {canCloseWithoutPin && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Google Authentication Status Card */}
        {googleUser ? (
          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {googleUser.photoURL ? (
                <img
                  src={googleUser.photoURL}
                  alt={googleUser.displayName || 'Google User'}
                  referrerPolicy="no-referrer"
                  className="w-9 h-9 rounded-full border border-slate-700 object-cover shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-bold flex items-center justify-center text-sm shrink-0">
                  {(googleUser.email || googleUser.displayName || 'G')[0].toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white truncate block">
                    {googleUser.displayName || 'Google User'}
                  </span>
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20 shrink-0">
                    <ShieldCheck className="w-2.5 h-2.5" /> Verified
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 truncate block font-mono">
                  {googleUser.email}
                </span>
              </div>
            </div>
            <button
              onClick={handleGoogleSignOut}
              className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-[11px] font-semibold text-slate-400 hover:text-red-300 border border-slate-800 transition cursor-pointer flex items-center gap-1 shrink-0"
              title="Sign out of Google"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-white text-slate-950 shrink-0 shadow-sm">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-white">Google Sign-In Required</h4>
                <p className="text-[11px] text-amber-200/90 leading-relaxed">
                  Sign in with your Google account to access your dedicated store and registered PIN.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={authLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs flex items-center justify-center gap-2.5 transition shadow-lg active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {authLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-700" />
                  <span>Connecting to Google...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4 text-slate-700" />
                  <span>Sign in with Google</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* User's Registered Stores List (Account-Bound Stores) */}
        {googleUser && userStores.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-white">Your Registered Store PIN:</span>
              </div>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold">
                Account Bound
              </span>
            </div>

            <div className="space-y-2">
              {userStores.map((storeRec) => {
                const isCurrent = currentActivePin === storeRec.pin;
                return (
                  <div
                    key={storeRec.storeId}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition ${
                      isCurrent
                        ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono font-black text-amber-300">
                          PIN #{storeRec.pin}
                        </span>
                        {isCurrent && (
                          <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                            Active
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono block">
                        {storeRec.role === 'owner' ? 'Store Owner' : 'Store Member'} • {storeRec.storeId.substring(0, 14)}...
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={loading || isCurrent}
                      onClick={() => handleConnectWithPin(storeRec.pin, false)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                        isCurrent
                          ? 'bg-slate-800 text-emerald-400 cursor-default opacity-80'
                          : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md active:scale-95'
                      }`}
                    >
                      {loading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ArrowRight className="w-3.5 h-3.5" />
                      )}
                      <span>{isCurrent ? 'Connected' : 'Connect'}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Current Active Pin Status if set */}
        {currentActivePin && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <span className="text-xs font-bold text-white block">Connected Store PIN</span>
                <span className="text-sm font-mono font-extrabold text-emerald-400">#{currentActivePin}</span>
              </div>
            </div>
            <button
              onClick={handleDisconnectCurrentPin}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-300 border border-slate-700/80 transition cursor-pointer"
            >
              Switch PIN
            </button>
          </div>
        )}

        {/* Mode Selector Tabs: Existing vs New */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-2xl border border-slate-800">
          <button
            type="button"
            onClick={() => {
              setMode('existing');
              setErrorMessage(null);
            }}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              mode === 'existing'
                ? 'bg-slate-800 text-amber-300 shadow-md border border-amber-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Store className="w-4 h-4" />
            <span>Connect PIN</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('new');
              setErrorMessage(null);
            }}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              mode === 'new'
                ? 'bg-slate-800 text-emerald-300 shadow-md border border-emerald-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>Register New Store</span>
          </button>
        </div>

        {/* Mode Instruction */}
        <div className="text-center space-y-0.5">
          <p className="text-xs text-slate-300 font-medium">
            {mode === 'existing'
              ? 'Enter a 4-digit PIN to connect to your store partition.'
              : 'Create a unique 4-digit PIN to register a new store.'}
          </p>
          {mode === 'new' && (
            <p className="text-[11px] text-amber-400 font-semibold flex items-center justify-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Rejects registration if PIN is already registered.
            </p>
          )}
        </div>

        {/* 4 Discrete PIN Display Boxes */}
        <div className="flex items-center justify-center gap-3 py-1">
          {[0, 1, 2, 3].map((index) => {
            const digit = pinDigits[index];
            return (
              <div
                key={index}
                className={`w-12 h-14 rounded-2xl border-2 flex items-center justify-center text-2xl font-mono font-extrabold transition shadow-inner ${
                  digit
                    ? 'border-amber-400 bg-amber-500/10 text-white shadow-amber-500/10'
                    : 'border-slate-800 bg-slate-950 text-slate-600'
                }`}
              >
                {digit ? digit : '•'}
              </div>
            );
          })}
        </div>

        {/* Error Alert Box */}
        {errorMessage && (
          <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2.5 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold block">Action Notice</span>
              <p className="text-[11px] leading-relaxed">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Numeric On-Screen Keypad */}
        <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleKeyPress(num)}
              disabled={loading || pinDigits.length >= 4}
              className="py-2.5 rounded-2xl bg-slate-950 hover:bg-slate-800 active:scale-95 text-white font-mono font-bold text-lg border border-slate-800 transition disabled:opacity-40 cursor-pointer"
            >
              {num}
            </button>
          ))}

          <button
            type="button"
            onClick={handleClear}
            disabled={loading || !pinDigits}
            className="py-2.5 rounded-2xl bg-slate-950 hover:bg-slate-800 active:scale-95 text-slate-400 hover:text-white text-xs font-bold border border-slate-800 transition disabled:opacity-40 flex items-center justify-center cursor-pointer"
          >
            Clear
          </button>

          <button
            type="button"
            onClick={() => handleKeyPress('0')}
            disabled={loading || pinDigits.length >= 4}
            className="py-2.5 rounded-2xl bg-slate-950 hover:bg-slate-800 active:scale-95 text-white font-mono font-bold text-lg border border-slate-800 transition disabled:opacity-40 cursor-pointer"
          >
            0
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={loading || !pinDigits}
            className="py-2.5 rounded-2xl bg-slate-950 hover:bg-slate-800 active:scale-95 text-slate-400 hover:text-white border border-slate-800 transition disabled:opacity-40 flex items-center justify-center cursor-pointer"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Submit Button */}
        <div className="pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={loading || pinDigits.length !== 4}
            className={`w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition shadow-xl active:scale-95 cursor-pointer disabled:opacity-50 ${
              mode === 'new'
                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Verifying Store PIN...</span>
              </>
            ) : mode === 'new' ? (
              <>
                <PlusCircle className="w-5 h-5" />
                <span>Register Store PIN #{pinDigits || '____'}</span>
              </>
            ) : (
              <>
                <Store className="w-5 h-5" />
                <span>Connect Store PIN #{pinDigits || '____'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};


