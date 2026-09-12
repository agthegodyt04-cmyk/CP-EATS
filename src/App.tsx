import React, { useState, useEffect, useRef } from "react";
import { signInWithGoogle, signOut, onAuthStateChange, getRedirectResult } from "./supabase";
import { databaseService } from "./database";
import { UserProfile } from "./types";
import { seedInitialData } from "./utils/seeding";
import OnboardingView from "./components/OnboardingView";
import CustomerDashboard from "./components/CustomerDashboard";
import KitchenDashboard from "./components/KitchenDashboard";
import AdminPanel from "./components/AdminPanel";
import { Shield, Sparkles, ShieldAlert } from "lucide-react";

export type AuthUser = {
  id: string;
  email: string | null;
  aud: string;
  created_at: string;
};

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string>("");
  // Track last auth user id so TOKEN_REFRESHED does not remount the whole app
  const lastAuthUserIdRef = useRef<string | null>(null);
  const profileUidRef = useRef<string | null>(null);
  
  // Custom navigation between dashboard and admin panel for administrators
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  const setAppRoute = (path: string) => {
    if (typeof window === "undefined") return;
    const next = path.startsWith("/") ? path : `/${path}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const target = `${next}${window.location.search}${window.location.hash}`;
    if (current !== target) {
      window.history.replaceState({}, "", target);
    }
  };

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setAppRoute("/");
      return;
    }
    if (!profile) {
      setAppRoute("/onboarding");
      return;
    }
    // Only set the route if we're not already on the correct route for this user's role
    const currentPath = window.location.pathname;
    const expectedPath = profile.role === "kitchen" ? "/kitchen" : "/dashboard";
    if (currentPath !== expectedPath) {
      setAppRoute(expectedPath);
    }
  }, [loading, user, profile]);

  // Listen to Supabase Auth state
  useEffect(() => {
    let unsubProfile: (() => void) | null = null;
    let authSubscription: { data?: { subscription?: { unsubscribe?: () => void } } } | null = null;

    void getRedirectResult().catch((err) => {
      console.error("Google redirect result error:", err);
    });

    void (async () => {
      authSubscription = await onAuthStateChange(async (supabaseUser, event) => {
        const nextUserId = supabaseUser?.id ?? null;
        const prevUserId = lastAuthUserIdRef.current;
        const userChanged = nextUserId !== prevUserId;

        // File pickers background the tab; Supabase often fires TOKEN_REFRESHED on return.
        // Never remount the app for token-only events.
        if (event === "TOKEN_REFRESHED") {
          return;
        }

        // Skip duplicate session events for the same user (keeps onboarding/settings mounted).
        // Still allow USER_UPDATED to re-fetch profile metadata.
        if (!userChanged && prevUserId !== null && event !== "USER_UPDATED") {
          return;
        }

        setLoading(true);

        // Clean up any existing profile subscription
        if (unsubProfile) {
          unsubProfile();
          unsubProfile = null;
        }

        if (supabaseUser) {
          lastAuthUserIdRef.current = supabaseUser.id;
          setUser(supabaseUser);

          // Fetch custom profile document from database
          try {
            const profileData = await databaseService.getUser(supabaseUser.id);
            if (profileData) {
              profileUidRef.current = profileData.uid;
              setProfile(profileData);
              if (profileData.themePreference === "dark") {
                document.documentElement.classList.add("dark");
                document.body.classList.add("dark");
              } else {
                document.documentElement.classList.remove("dark");
                document.body.classList.remove("dark");
              }
            } else {
              profileUidRef.current = null;
              setProfile(null); // Triggers onboarding
              document.documentElement.classList.remove("dark");
              document.body.classList.remove("dark");
            }
            setLoading(false);
          } catch (err) {
            console.error("Failed to read user profile:", err);
            setLoading(false);
          }
        } else {
          lastAuthUserIdRef.current = null;
          profileUidRef.current = null;
          setUser(null);
          setProfile(null);
          setAppRoute("/");
          setLoading(false);
        }
      });
    })();

    return () => {
      authSubscription?.data?.subscription?.unsubscribe?.();
      if (unsubProfile) {
        unsubProfile();
      }
    };
  }, []);

  // Real Google Sign-In Handler
  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error("Google Authentication error:", err);
      const code = typeof err === "object" && err && "code" in err ? String((err as any).code) : "";
      const message = typeof err === "object" && err && "message" in err ? String((err as any).message) : String(err);
      setAuthError(`${code || "auth/error"}: ${message}`);
      alert(`Sign-in failed: ${code || "auth/error"}. Please try again.`);
      setLoading(false);
    }
  };

  // Log Out Handler
  const handleSignOut = async () => {
    setLoading(true);
    try {
      await signOut();
      setProfile(null);
      setUser(null);
      setShowAdminPanel(false);
    } catch (err) {
      console.error("Sign-out failed:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div data-testid="loading-screen" className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-indigo-200">
        <div className="w-12 h-12 rounded-xl bg-indigo-600 animate-spin flex items-center justify-center text-white text-lg font-black mb-4">
          CP
        </div>
        <p className="font-mono text-xs animate-pulse">Syncing Centurian Park trust databases...</p>
      </div>
    );
  }

  // BANNED ACTOR SCREEN - Integrity Protection (Section 10.3)
  if (profile && profile.status === "banned") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-rose-950 p-8 rounded-3xl max-w-md text-center space-y-6 shadow-2xl animate-scale-up">
          <div className="inline-flex p-4 bg-rose-500/10 rounded-full border border-rose-500/20 text-rose-500 mb-2">
            <ShieldAlert className="w-12 h-12" />
          </div>
          <h2 className="text-xl font-black text-white tracking-tight">Access Suspended</h2>
          <p className="text-slate-300 text-xs leading-relaxed">
            Your CP-Eats profile linked to MyGate ID <strong>{profile.myGateId}</strong> has been suspended due to verified community guideline violations (such as uploading stock photography or transaction misconduct).
          </p>
          <div className="p-4 bg-slate-950/60 rounded-2xl text-left border border-slate-800 space-y-2">
            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Appeal Guidelines</p>
            <p className="text-[11px] text-indigo-200">
              Please contact the Centurian Park Residents Welfare Association (RWA) with your flat ID verification to restore access.
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Acknowledge & Sign Out
          </button>
        </div>
      </div>
    );
  }

    // AUTHENTICATED OR ONBOARDING ROUTING
  if (user) {
    if (!profile) {
      // Profile does not exist yet -> trigger onboarding
      return (
        <OnboardingView
          userId={user.id}
          userEmail={user.email || ""}
          onOnboardingComplete={(newProfile) => setProfile(newProfile)}
        />
      );
    }

    // Role-based routing
    return (
      <div className="min-h-screen bg-slate-50">
        {showAdminPanel ? (
          <div className="p-4 py-8">
            <button
              onClick={() => setShowAdminPanel(false)}
              className="mb-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-indigo-700 transition-all cursor-pointer"
            >
              ← Back to Dashboard
            </button>
            <AdminPanel currentProfile={profile} />
          </div>
        ) : profile.role === "kitchen" ? (
          <KitchenDashboard currentProfile={profile} onLogout={handleSignOut} />
        ) : (
          <CustomerDashboard
            currentProfile={profile}
            onLogout={handleSignOut}
            onOpenAdmin={() => setShowAdminPanel(true)}
            showAdminBtn={profile.role === "admin"}
          />
        )}
      </div>
    );
  }

  // LANDING PAGE & LOGIN OPTIONS
  return (
    <div data-testid="app-landing" className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 py-12 relative overflow-hidden font-sans">
      {/* Background glowing gradients */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full filter blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-600/5 rounded-full filter blur-3xl pointer-events-none" />

      <div className="w-full max-w-md space-y-8 relative z-10">
        
        {/* Brand visual identity */}
        <div className="text-center space-y-3">
          <div className="inline-flex p-4 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl mb-2">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center font-black text-2xl text-white tracking-widest">
              CP
            </div>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight leading-none uppercase">
            Centurian Park <span className="text-indigo-500">Eats</span>
          </h1>
          <p className="text-slate-400 text-xs max-w-xs mx-auto leading-relaxed">
            Exclusive, peer-to-peer neighborhood gourmet directory and trust-verified social food feed.
          </p>
        </div>

        {/* Value Proposition Grid (No-AI slop clean cards) */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3.5 bg-slate-900/60 border border-slate-900 rounded-2xl text-center space-y-1">
            <Shield className="w-5 h-5 text-indigo-400 mx-auto" />
            <h3 className="text-[11px] font-bold text-white uppercase tracking-wider">Trust Verified</h3>
            <p className="text-[9px] text-slate-500 leading-normal">MyGate verified flat logins.</p>
          </div>
          <div className="p-3.5 bg-slate-900/60 border border-slate-900 rounded-2xl text-center space-y-1">
            <Sparkles className="w-5 h-5 text-emerald-400 mx-auto" />
            <h3 className="text-[11px] font-bold text-white uppercase tracking-wider">Authentic Feed</h3>
            <p className="text-[9px] text-slate-500 leading-normal">AI Image Shield scanner checks.</p>
          </div>
        </div>

        {/* Authentication Card */}
        <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 space-y-6 shadow-2xl">
        <div className="space-y-2 text-center">
          <h2 className="text-sm font-extrabold text-white uppercase tracking-wider">Resident Portal Login</h2>
          <p className="text-[10px] text-slate-500">Access exclusive home menus using verified credentials</p>
          {authError && (
            <p className="text-[10px] text-rose-400 font-mono break-words">
              {authError}
            </p>
          )}
        </div>

          {/* Google Auth Sign In */}
          <button
            data-testid="google-signin-button"
            onClick={handleGoogleSignIn}
            className="w-full py-3.5 bg-white hover:bg-slate-50 text-slate-900 rounded-2xl text-xs font-black shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {/* Google Logo Icon SVG */}
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.47 14.97 1 12 1 7.35 1 3.46 3.68 1.62 7.57l3.77 2.92c.88-2.63 3.35-4.45 6.61-4.45z"/>
              <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.29 1.48-1.14 2.73-2.4 3.58l3.73 2.89c2.18-2.01 3.7-4.99 3.7-8.62z"/>
              <path fill="#FBBC05" d="M5.39 14.75a7.12 7.12 0 0 1 0-4.5l-3.77-2.92A11.96 11.96 0 0 0 1 12c0 1.83.41 3.57 1.15 5.14l3.24-2.39z"/>
              <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.92l-3.73-2.89c-1.03.69-2.35 1.1-4.23 1.1-3.26 0-5.73-1.82-6.61-4.45L1.62 16.29C3.46 20.32 7.35 23 12 23z"/>
            </svg>
            <span>Sign In with Google</span>
          </button>

        </div>

        {/* App stats banner in margins */}
        <div className="text-center">
          <p className="text-[10px] text-slate-600 font-mono">
            Centurian Park Residents Association verified app
          </p>
        </div>
      </div>
    </div>
  );
}
