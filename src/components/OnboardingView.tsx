import React, { useState, useEffect } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { UserProfile, UserRole } from "../types";
import { CENTURIAN_SOCIETIES, generateFlats, formatFlatId } from "../utils/addressData";
import { Shield, Home, User, Phone, CheckCircle } from "lucide-react";

interface OnboardingViewProps {
  userId: string;
  userEmail: string;
  onOnboardingComplete: (profile: UserProfile) => void;
}

export default function OnboardingView({ userId, userEmail, onOnboardingComplete }: OnboardingViewProps) {
  const [role, setRole] = useState<UserRole>("customer");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedSociety, setSelectedSociety] = useState(CENTURIAN_SOCIETIES[0]);
  const [selectedTower, setSelectedTower] = useState("");
  const [selectedFloor, setSelectedFloor] = useState(1);
  const [selectedFlat, setSelectedFlat] = useState("");
  const [myGateId, setMyGateId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Reset tower and flat when society changes
    setSelectedTower(selectedSociety.towers[0]);
    setSelectedFlat("Flat 01");
  }, [selectedSociety]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || !phone.trim() || !myGateId.trim() || !selectedTower || !selectedFlat) {
      setError("Please fill in all verification and address fields.");
      return;
    }

    setSubmitting(true);
    setError("");

    const flatAddress = formatFlatId(
      selectedSociety.name,
      selectedTower,
      selectedFloor,
      selectedFlat
    );

    const profile: UserProfile = {
      uid: userId,
      email: userEmail,
      displayName: displayName.trim(),
      role,
      phone: phone.trim(),
      society: selectedSociety.name,
      flatAddress,
      myGateId: myGateId.trim().toUpperCase(),
      status: "Pending_Verification", // Assigned 'Pending_Verification' for Trustee Admin audit gate
      createdAt: Date.now()
    };

    try {
      // Save profile to Firestore
      await setDoc(doc(db, "users", userId), profile);

      // If kitchen, also create an initial kitchen detail document
      if (role === "kitchen") {
        await setDoc(doc(db, "kitchens", userId), {
          uid: userId,
          kitchenName: displayName.trim() + "'s Kitchen",
          vegType: "both",
          mov: 100,
          isOnline: true,
          restingUntil: null,
          operatingMode: "online",
          upiId: "",
          bankName: "",
          upiDisplayName: "",
          qrCodeUrl: "",
          cuisineType: "Homemade Cuisine",
          society: selectedSociety.name,
          flatAddress
        });
      }

      onOnboardingComplete(profile);
    } catch (err) {
      console.error("Onboarding failed:", err);
      setError("Failed to complete onboarding. Please verify your internet connection.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div id="onboarding-root" className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 py-12 transition-colors duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full shadow-xl border border-gray-100 dark:border-slate-850 overflow-hidden animate-scale-up">
        {/* Banner */}
        <div className="bg-indigo-900 text-white p-8 text-center space-y-2">
          <div className="inline-flex p-3 bg-indigo-800/60 rounded-full border border-indigo-700/40 mb-2">
            <Shield className="w-8 h-8 text-amber-400" />
          </div>
          <h2 className="text-2xl font-black tracking-tight">Centurian Park Trust Onboarding</h2>
          <p className="text-indigo-200 text-sm max-w-md mx-auto">
            CP-Eats is an exclusive resident directory. Set up your official MyGate verification credentials.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-semibold">
              {error}
            </div>
          )}

          {/* 1. Permanent Role Selection */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest block">
              Choose your account role
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setRole("customer")}
                className={`p-4 rounded-2xl border-2 text-left flex items-start gap-3 transition-all cursor-pointer ${
                  role === "customer"
                    ? "border-indigo-600 bg-indigo-50/40 dark:bg-slate-800 text-indigo-950 dark:text-indigo-100 shadow-xs"
                    : "border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 text-gray-700 dark:text-slate-300"
                }`}
              >
                <div className={`p-2 rounded-lg ${role === "customer" ? "bg-indigo-600 text-white" : "bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400"}`}>
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-gray-900 dark:text-slate-100">Resident Customer</h4>
                  <p className="text-xs text-gray-400 dark:text-slate-400 mt-1">Browse kitchens, order meals, and double-tap social feed posts.</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setRole("kitchen")}
                className={`p-4 rounded-2xl border-2 text-left flex items-start gap-3 transition-all cursor-pointer ${
                  role === "kitchen"
                    ? "border-indigo-600 bg-indigo-50/40 dark:bg-slate-800 text-indigo-950 dark:text-indigo-100 shadow-xs"
                    : "border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 text-gray-700 dark:text-slate-300"
                }`}
              >
                <div className={`p-2 rounded-lg ${role === "kitchen" ? "bg-indigo-600 text-white" : "bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400"}`}>
                  <Home className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-gray-900 dark:text-slate-100">Home Kitchen Seller</h4>
                  <p className="text-xs text-gray-400 dark:text-slate-400 mt-1">Manage menus, publish dish posts, and verify customer delivery PINs.</p>
                </div>
              </button>
            </div>
            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
              ⚠️ Note: Role selection is permanent to preserve accountability within the society feed.
            </p>
          </div>

          <hr className="border-gray-100 dark:border-slate-800" />

          {/* 2. Basic Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 dark:text-slate-300 uppercase">
                {role === "kitchen" ? "Kitchen / Chef Name" : "Resident Name"}
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={role === "kitchen" ? "e.g. Simran's Punjabi Tadka" : "e.g. Rahul Sharma"}
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden transition-all text-gray-950 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 dark:text-slate-300 uppercase flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-gray-400" />
                <span>Phone Number</span>
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +91 98765 43210"
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden transition-all text-gray-950 dark:text-slate-100"
              />
            </div>
          </div>

          {/* 3. Address Builder */}
          <div className="p-5 bg-gray-50 dark:bg-slate-950 rounded-2xl border border-gray-100 dark:border-slate-850 space-y-4">
            <h4 className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Home className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Hierarchical Address Picker</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-gray-500 dark:text-slate-400 uppercase">Select Society</label>
                <select
                  value={selectedSociety.name}
                  onChange={(e) => {
                    const soc = CENTURIAN_SOCIETIES.find(s => s.name === e.target.value);
                    if (soc) setSelectedSociety(soc);
                  }}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-slate-100"
                >
                  {CENTURIAN_SOCIETIES.map((soc) => (
                    <option key={soc.name} value={soc.name}>{soc.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-gray-500 dark:text-slate-400 uppercase">Tower / Block</label>
                <select
                  value={selectedTower}
                  onChange={(e) => setSelectedTower(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-slate-100"
                >
                  {selectedSociety.towers.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-gray-500 dark:text-slate-400 uppercase">Floor</label>
                <select
                  value={selectedFloor}
                  onChange={(e) => setSelectedFloor(parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-slate-100"
                >
                  {Array.from({ length: selectedSociety.floorsCount }, (_, i) => i + 1).map((f) => (
                    <option key={f} value={f}>Floor {f}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-gray-500 dark:text-slate-400 uppercase">Flat ID</label>
                <select
                  value={selectedFlat}
                  onChange={(e) => setSelectedFlat(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-slate-100"
                >
                  {generateFlats(selectedSociety.flatsPerFloor).map((flat) => (
                    <option key={flat} value={flat}>{flat}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 4. Security Gate */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-600 dark:text-slate-300 uppercase flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>MyGate Verification Code</span>
            </label>
            <input
              type="text"
              required
              value={myGateId}
              onChange={(e) => setMyGateId(e.target.value)}
              placeholder="e.g. MG-VALLEY-B1-404"
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-hidden uppercase text-gray-950 dark:text-slate-100"
            />
            <p className="text-[10px] text-gray-400 dark:text-slate-500">
              Enter your standard flat MyGate ID. This authenticates your resident status for neighborhood security.
            </p>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle className="w-5 h-5" />
              <span>{submitting ? "Verifying Credentials..." : "Complete Resident Verification"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
