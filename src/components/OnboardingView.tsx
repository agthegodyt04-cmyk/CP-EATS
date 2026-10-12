import React, { useState, useEffect } from "react";
import { databaseService } from "../database";
import { UserProfile, UserRole, KitchenDetails } from "../types";
import { CENTURIAN_SOCIETIES, generateFlats, formatFlatId, generateTowerBlocks } from "../utils/addressData";
import { Shield, Home, User, Phone, CheckCircle, ArrowRight, ArrowLeft, Sparkles, Building2, UserCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { compressImage, compressImageFile, fileToDataUrl } from "../utils/imageUtils";

interface OnboardingViewProps {
  userId: string;
  userEmail: string;
  onOnboardingComplete: (profile: UserProfile) => void;
}

export default function OnboardingView({ userId, userEmail, onOnboardingComplete }: OnboardingViewProps) {
  const draftKey = `cp_eats_onboarding_draft:${userId}`;
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [role, setRole] = useState<UserRole>("customer");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedSociety, setSelectedSociety] = useState(CENTURIAN_SOCIETIES[0]);
  const [selectedTower, setSelectedTower] = useState("");
  const [selectedTowerLetter, setSelectedTowerLetter] = useState("F");
  const [selectedTowerNumber, setSelectedTowerNumber] = useState("1");
  const [selectedFloor, setSelectedFloor] = useState<string | number>(1);
  const [selectedFlat, setSelectedFlat] = useState("");
  const [myGateId, setMyGateId] = useState("");
  const [myGateScreenshot, setMyGateScreenshot] = useState("");
  const [myGateScreenshotFile, setMyGateScreenshotFile] = useState<File | null>(null);
  const [securityPin, setSecurityPin] = useState("");
  const [kitchenVegType, setKitchenVegType] = useState<"veg" | "both" | "non-veg">("veg");
  const [handle, setHandle] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [profileImagePreviewUrl, setProfileImagePreviewUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submissionStage, setSubmissionStage] = useState("");
  const [error, setError] = useState("");
  const [addressOccupiedError, setAddressOccupiedError] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (typeof draft !== "object" || draft === null) return;

      if (draft.step) setStep(draft.step);
      if (draft.direction) setDirection(draft.direction);
      if (draft.role) setRole(draft.role);
      if (draft.displayName) setDisplayName(draft.displayName);
      if (draft.phone) setPhone(draft.phone);
      if (draft.selectedSociety) setSelectedSociety(draft.selectedSociety);
      if (draft.selectedTower) setSelectedTower(draft.selectedTower);
      if (draft.selectedTowerLetter) setSelectedTowerLetter(draft.selectedTowerLetter);
      if (draft.selectedTowerNumber) setSelectedTowerNumber(draft.selectedTowerNumber);
      if (draft.selectedFloor !== undefined) setSelectedFloor(draft.selectedFloor);
      if (draft.selectedFlat) setSelectedFlat(draft.selectedFlat);
      if (draft.myGateId) setMyGateId(draft.myGateId);
      // Intentionally do not restore large base64 images from draft (quota / remount safety).
      if (draft.securityPin) setSecurityPin(draft.securityPin);
      if (draft.kitchenVegType) setKitchenVegType(draft.kitchenVegType);
      if (draft.handle) setHandle(draft.handle);
    } catch (err) {
      console.debug("Ignoring invalid onboarding draft:", err);
    }
  }, [draftKey]);

  useEffect(() => {
    // Keep text/step draft only — large base64 images blow localStorage and can crash remount recovery.
    const draftWithoutImages = {
      step,
      direction,
      role,
      displayName,
      phone,
      selectedSociety,
      selectedTower,
      selectedTowerLetter,
      selectedTowerNumber,
      selectedFloor,
      selectedFlat,
      myGateId,
      securityPin,
      kitchenVegType,
      handle,
    };
    try {
      localStorage.setItem(draftKey, JSON.stringify(draftWithoutImages));
    } catch (err) {
      console.debug("Failed to persist onboarding draft:", err);
      try {
        localStorage.removeItem(draftKey);
        localStorage.setItem(draftKey, JSON.stringify({
          step,
          role,
          displayName,
          phone,
          myGateId,
          handle,
        }));
      } catch {
        // Ignore quota failures; in-memory state still works for this session.
      }
    }
  }, [
    draftKey,
    step,
    direction,
    role,
    displayName,
    phone,
    selectedSociety,
    selectedTower,
    selectedTowerLetter,
    selectedTowerNumber,
    selectedFloor,
    selectedFlat,
    myGateId,
    securityPin,
    kitchenVegType,
    handle,
  ]);

  useEffect(() => {
    if (selectedSociety.name.includes("Low Rise")) {
      setSelectedTowerLetter("C");
      setSelectedTowerNumber("1");
      setSelectedTower("C1");
      setSelectedFloor("G");
      setSelectedFlat("01");
    } else if (selectedSociety.name.includes("Tropical Garden")) {
      setSelectedTower("F1");
      setSelectedFloor(1);
      setSelectedFlat("01");
    } else {
      setSelectedTower(selectedSociety.towers[0]);
      setSelectedFloor(1);
      setSelectedFlat("01");
    }
  }, [selectedSociety]);

  const triggerHaptic = () => {
    if (window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(20);
    }
  };

  const finalStep = role === "kitchen" ? 5 : 4;

  const validateStep = () => {
    setError("");
    if (step === 2) {
      if (!displayName.trim()) {
        setError("Please enter your name or kitchen name.");
        return false;
      }
      if (!phone.trim()) {
        setError("Please enter your phone number.");
        return false;
      }
      if (role === "kitchen" && !handle.trim()) {
        setError("Please choose a kitchen handle.");
        return false;
      }
    }
    if (role === "kitchen" && step === 3) {
      if (!securityPin.trim() || !/^\d{4}$/.test(securityPin.trim())) {
        setError("Kitchen security PIN must be exactly 4 digits.");
        return false;
      }
      return true;
    }
    if (step === (role === "kitchen" ? 4 : 3)) {
      if (!selectedTower) {
        setError("Please select a tower and flat.");
        return false;
      }
      if (!selectedSociety.name.includes("Low Rise") && !selectedFlat) {
        setError("Please select a flat number.");
        return false;
      }
    }
    if (step === finalStep) {
      if (!myGateId.trim()) {
        setError("Please enter your MyGate verification ID.");
        return false;
      }
      if (!myGateScreenshot.trim()) {
        setError("Please upload your MyGate screenshot.");
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    triggerHaptic();
    if (validateStep()) {
      setDirection(1);
      setStep((prev) => Math.min(prev + 1, finalStep));
    }
  };

  const handleBack = () => {
    triggerHaptic();
    setError("");
    setDirection(-1);
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const formatDatabaseError = (err: unknown) => {
    const record = typeof err === "object" && err !== null ? err as Record<string, unknown> : {};
    const code = typeof record.code === "string" ? record.code : "";
    const message = typeof record.message === "string" ? record.message : err instanceof Error ? err.message : String(err || "");
    const details = typeof record.details === "string" ? record.details : "";
    const hint = typeof record.hint === "string" ? record.hint : "";
    return [code, message, details, hint].filter(Boolean).join(": ");
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    triggerHaptic();
    // Never complete onboarding from intermediate steps or accidental form submits
    // (e.g. mobile file-picker return / Enter key while uploading pfp or MyGate proof).
    if (step !== finalStep) {
      return;
    }
    if (!validateStep()) return;

    setSubmitting(true);
    setError("");
    setAddressOccupiedError(false);

    const flatAddress = formatFlatId(
      selectedSociety.name,
      selectedTower,
      Number(selectedFloor) || 0,
      selectedFlat
    );
    const normalizedHandle = role === "kitchen" ? handle.trim().replace(/^@+/, "").toLowerCase().replace(/[^a-z0-9._-]/g, "") : "";
    const addressRegistryId = encodeURIComponent(flatAddress.trim().toLowerCase());
    const handleRegistryId = normalizedHandle;

    try {
      setSubmissionStage("Checking address...");
      const [addressRegistry, handleRegistry] = await Promise.all([
        databaseService.getAddressRegistry(addressRegistryId),
        role === "kitchen" ? databaseService.getHandleRegistry(handleRegistryId) : Promise.resolve(null)
      ]);
      const addressOccupied = addressRegistry !== null && addressRegistry.uid !== userId;

      if (role === "kitchen") {
        const handleTaken = handleRegistry !== null && handleRegistry.uid !== userId;
        if (handleTaken) {
          setError("That kitchen handle is already taken.");
          setSubmitting(false);
          return;
        }
      }

      if (addressOccupied) {
        setAddressOccupiedError(true);
        setError("Address Already Registered. An account is already tied to this flat.");
        setSubmitting(false);
        return;
      }

      const profile: UserProfile = {
        uid: userId,
        email: userEmail,
        displayName: displayName.trim(),
        role,
        phone: phone.trim(),
        society: selectedSociety.name,
        flatAddress,
        myGateId: myGateId.trim().toUpperCase(),
        myGateScreenshot,
        status: "verified",
        createdAt: new Date().toISOString()
      };

      if (role === "kitchen") {
        profile.handle = normalizedHandle;
        profile.profileImageUrl = profileImageUrl;
        profile.securityPin = securityPin.trim();
      }

      setSubmissionStage("Saving profile...");
      await databaseService.createUser(profile);

      await databaseService.setAddressRegistry(addressRegistryId, {
        uid: userId,
        email: userEmail,
        role,
        flatAddress,
        createdAt: new Date().toISOString()
      });

      if (role === "kitchen") {
        await databaseService.setHandleRegistry(handleRegistryId, {
          uid: userId,
          email: userEmail,
          handle: handleRegistryId,
          createdAt: new Date().toISOString()
        });
      }

      if (role === "kitchen") {
        const kitchenDetails: KitchenDetails = {
          uid: userId,
          kitchenName: displayName.trim() + "'s Kitchen",
          handle: handle.trim().replace(/^@+/, "").toLowerCase().replace(/[^a-z0-9._-]/g, ""),
          profileImageUrl,
          vegType: kitchenVegType,
          mov: 100,
          isOnline: true,
          restingUntil: null,
          operatingMode: "online",
          cuisineType: "Homemade Cuisine",
          society: selectedSociety.name,
          flatAddress,
          securityPin: securityPin.trim()
        };
        await databaseService.createKitchen(kitchenDetails);
      }

      onOnboardingComplete(profile);
      localStorage.removeItem(draftKey);
    } catch (err) {
      console.error("Onboarding failed:", err);
      const record = typeof err === "object" && err !== null ? err as Record<string, unknown> : {};
      const message = typeof record.message === "string" ? record.message : err instanceof Error ? err.message : String(err);
      const code = typeof record.code === "string" ? record.code : "";
      const friendlyStage = submissionStage || "Onboarding";
      const fullError = formatDatabaseError(err);
      setError(
        code.includes("storage/unauthorized") || message.includes("storage/unauthorized")
          ? `${friendlyStage} failed: Storage blocked the screenshot upload.`
          : code.includes("permission-denied") || message.includes("permission-denied")
            ? `${friendlyStage} failed: permissions blocked this. Please deploy database rules.`
            : code.includes("unavailable") || message.includes("unavailable")
              ? `${friendlyStage} failed: database could not be reached. Please check your connection.`
              : `${friendlyStage} failed: ${fullError || "Unknown database error"}`
      );
    } finally {
      setSubmitting(false);
      setSubmissionStage("");
    }
  };

  const progressPercentage = (step / finalStep) * 100;
  const addressStep = role === "kitchen" ? 4 : 3;

  const handleProfilePhotoUpload = async (file: File | null) => {
    if (!file) return;
    setError("");
    let instantPreview = "";
    try {
      instantPreview = URL.createObjectURL(file);
      setProfileImagePreviewUrl(instantPreview);
      const url = await compressImage(file);
      setProfileImageUrl(url);
      setProfileImagePreviewUrl("");
    } catch (err) {
      console.error("Profile image upload failed:", err);
      setProfileImagePreviewUrl("");
      setError("Failed to upload profile image.");
    } finally {
      if (instantPreview) {
        URL.revokeObjectURL(instantPreview);
      }
    }
  };

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 100 : -100,
      opacity: 0,
      scale: 0.98,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
      transition: {
        x: { type: "spring" as const, stiffness: 350, damping: 30 },
        opacity: { duration: 0.15 },
      },
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -100 : 100,
      opacity: 0,
      scale: 0.98,
      transition: {
        x: { type: "spring" as const, stiffness: 350, damping: 30 },
        opacity: { duration: 0.15 },
      },
    }),
  };

  return (
    <div id="onboarding-root" className="min-h-screen bg-linear-to-b from-[#FAF8F5] to-[#F4EFEA] dark:from-[#0F0D0C] dark:to-[#171413] flex items-center justify-center p-4 py-12 transition-colors duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-[28px] max-w-lg w-full shadow-xl border border-gray-100 dark:border-slate-850 overflow-hidden relative">
        
        <div className="px-6 pt-8 pb-4 space-y-4 border-b border-gray-50 dark:border-slate-850">
          <div className="flex items-center justify-between">
            {step > 1 && (
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 dark:text-slate-400 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className={`text-xs font-black uppercase tracking-wider text-brand-primary ${step === 1 ? 'ml-auto' : ''}`}>
              Step {step} of {finalStep}
            </div>
          </div>

          <div className="w-full bg-gray-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden">
            <motion.div
              className="bg-brand-primary h-full rounded-full"
              initial={{ width: "25%" }}
              animate={{ width: `${progressPercentage}%` }}
              transition={{ type: "spring", stiffness: 150, damping: 20 }}
            />
          </div>
        </div>

        <div className="p-6 sm:p-8 min-h-[360px] flex flex-col justify-between">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              // Block implicit submit (Enter / file-picker quirks); only explicit Complete button finishes.
              if (step === finalStep) {
                void handleSubmit(e);
              }
            }}
            className="flex-1 flex flex-col justify-between space-y-6"
          >
            
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={step}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="space-y-6 flex-1"
              >
                {step === 1 && (
                  <div className="space-y-5">
                    <div className="space-y-1">
                      <h3 className="text-xl font-extrabold text-gray-900 dark:text-slate-100 tracking-tight">
                        What's your role in Centurian Park?
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        Choose how you will engage with the CP-Eats resident ecosystem.
                      </p>
                    </div>

                    <div className="space-y-3.5">
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic();
                          setRole("customer");
                        }}
                        className={`w-full p-5 rounded-2xl border-2 text-left flex items-start gap-4 transition-all cursor-pointer ${
                          role === "customer"
                            ? "border-brand-primary bg-brand-primary/5 dark:bg-slate-800 text-brand-primary shadow-xs scale-[1.01]"
                            : "border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 text-gray-700 dark:text-slate-300"
                        }`}
                      >
                        <div className={`p-3 rounded-xl transition-colors ${
                          role === "customer" ? "bg-brand-primary text-white" : "bg-gray-100 dark:bg-slate-800 text-gray-500"
                        }`}>
                          <User className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-extrabold text-sm text-gray-900 dark:text-slate-100">Resident Customer</h4>
                          <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1 leading-relaxed">
                            Browse kitchens, order delicious hot home-cooked meals, and engage with our neighborhood social food feed.
                          </p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic();
                          setRole("kitchen");
                        }}
                        className={`w-full p-5 rounded-2xl border-2 text-left flex items-start gap-4 transition-all cursor-pointer ${
                          role === "kitchen"
                            ? "border-brand-primary bg-brand-primary/5 dark:bg-slate-800 text-brand-primary shadow-xs scale-[1.01]"
                            : "border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 text-gray-700 dark:text-slate-300"
                        }`}
                      >
                        <div className={`p-3 rounded-xl transition-colors ${
                          role === "kitchen" ? "bg-brand-primary text-white" : "bg-gray-100 dark:bg-slate-800 text-gray-500"
                        }`}>
                          <Home className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-extrabold text-sm text-gray-900 dark:text-slate-100">Home Kitchen Seller</h4>
                          <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1 leading-relaxed">
                            Manage homemade menus, publish active kitchen posts, and handle delivery securely within the society gates.
                          </p>
                        </div>
                      </button>
                    </div>

                    <div className="p-3 bg-amber-500/10 rounded-xl flex items-start gap-2 border border-amber-500/10">
                      <Shield className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold leading-relaxed">
                        Note: Account roles are permanent to preserve high-fidelity neighborhood accountability.
                      </p>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-5">
                    <div className="space-y-1">
                      <h3 className="text-xl font-extrabold text-gray-900 dark:text-slate-100 tracking-tight">
                        Tell us about yourself
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        Let your neighbors identify you in order to fulfill order deliveries smoothly.
                      </p>
                    </div>

                    <div className="space-y-4">
                      {role === "kitchen" && (
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-extrabold text-gray-500 dark:text-slate-400 uppercase tracking-wider block">
                            Kitchen Handle
                          </label>
                          <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 font-black">@</span>
                            <input
                              type="text"
                              value={handle}
                              onChange={(e) => setHandle(e.target.value.replace(/\s+/g, "").toLowerCase().replace(/[^a-z0-9._-]/g, ""))}
                              placeholder="simrans-punjabi-tadka"
                              className="w-full pl-8 pr-4 py-3 border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary focus:outline-hidden transition-all text-gray-950 dark:text-slate-100 font-mono"
                            />
                          </div>
                        <p className="text-[10px] text-gray-400 dark:text-slate-500">
                            This is your public kitchen handle and must be unique.
                          </p>
                        </div>
                      )}

                      {role === "kitchen" && (
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-extrabold text-gray-500 dark:text-slate-400 uppercase tracking-wider block">
                            Profile Photo
                          </label>
                          <div className="flex items-center gap-3">
                            <div className="w-14 h-14 rounded-2xl overflow-hidden bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 flex items-center justify-center">
                              {profileImagePreviewUrl || profileImageUrl ? (
                                <img src={profileImagePreviewUrl || profileImageUrl} alt="Kitchen profile preview" className="w-full h-full object-cover" />
                              ) : (
                                <UserCircle2 className="w-7 h-7 text-gray-400" />
                              )}
                            </div>
                            <input
                              type="file"
                              accept="image/*"
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                e.stopPropagation();
                                void handleProfilePhotoUpload(e.target.files?.[0] || null);
                              }}
                              className="flex-1 text-xs text-gray-500 dark:text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-brand-primary-container file:text-brand-primary hover:file:bg-brand-primary/20 cursor-pointer"
                            />
                          </div>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-extrabold text-gray-500 dark:text-slate-400 uppercase tracking-wider block">
                          {role === "kitchen" ? "Kitchen / Chef Name" : "Your Name"}
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                            <UserCircle2 className="w-5 h-5" />
                          </div>
                          <input
                            type="text"
                            required
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder={role === "kitchen" ? "e.g. Simran's Punjabi Tadka" : "e.g. Rahul Sharma"}
                            className="w-full pl-11 pr-4 py-3 border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary focus:outline-hidden transition-all text-gray-950 dark:text-slate-100"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-extrabold text-gray-500 dark:text-slate-400 uppercase tracking-wider block">
                          Mobile Phone Number
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                            <Phone className="w-4 h-4" />
                          </div>
                          <input
                            type="tel"
                            required
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="e.g. +91 98765 43210"
                            className="w-full pl-11 pr-4 py-3 border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary focus:outline-hidden transition-all text-gray-950 dark:text-slate-100"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {step === 3 && role === "kitchen" && (
                  <div className="space-y-5">
                    <div className="space-y-1">
                      <h3 className="text-xl font-extrabold text-gray-900 dark:text-slate-100 tracking-tight">
                        Kitchen Security Setup
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        Set the PIN you'll use later for important kitchen changes. Keep it private.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-extrabold text-gray-500 dark:text-slate-400 uppercase tracking-wider block">
                          Kitchen Access PIN
                        </label>
                        <input
                          type="password"
                          inputMode="numeric"
                          maxLength={4}
                          value={securityPin}
                          onChange={(e) => setSecurityPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                          placeholder="4-digit PIN"
                          className="w-full px-4 py-3 border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-sm font-mono focus:ring-2 focus:ring-brand-primary focus:outline-hidden text-gray-950 dark:text-slate-100 tracking-wider font-extrabold"
                        />
                        <p className="text-[10px] text-gray-400 dark:text-slate-500 leading-normal">
                          This PIN protects menu, payment, delivery, and kitchen profile changes.
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-extrabold text-gray-500 dark:text-slate-400 uppercase tracking-wider block">
                          Kitchen Food Type
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { id: "veg", label: "Veg Only" },
                            { id: "both", label: "Veg + Non-Veg" },
                            { id: "non-veg", label: "Non-Veg" }
                          ].map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setKitchenVegType(opt.id as "veg" | "both" | "non-veg")}
                              className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all cursor-pointer ${
                                kitchenVegType === opt.id
                                  ? "bg-brand-primary text-white border-brand-primary"
                                  : "bg-white dark:bg-slate-900 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-700"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                        <p className="text-[10px] text-gray-400 dark:text-slate-500 leading-normal font-semibold">
                          Choose the kitchen type you operate today.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {step === (role === "kitchen" ? 4 : 3) && (
                  <div className="space-y-5">
                    <div className="space-y-1">
                        <h3 className="text-xl font-extrabold text-gray-900 dark:text-slate-100 tracking-tight">
                        Where do you reside?
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-slate-400">
                          Pick your physical flat within Centurian Park to map your household.
                        </p>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-gray-100 dark:border-slate-850 space-y-4">
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-extrabold text-gray-500 dark:text-slate-400 uppercase tracking-wider block">
                            Select Society
                          </label>
                          <select
                            value={selectedSociety.name}
                            onChange={(e) => {
                              triggerHaptic();
                              const soc = CENTURIAN_SOCIETIES.find((s) => s.name === e.target.value);
                              if (soc) setSelectedSociety(soc);
                            }}
                            className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-brand-primary text-gray-950 dark:text-slate-100"
                          >
                            {CENTURIAN_SOCIETIES.map((soc) => (
                              <option key={soc.name} value={soc.name}>
                                {soc.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <label className="text-[9px] font-extrabold text-gray-500 dark:text-slate-400 uppercase tracking-wider block">
                              Tower / Block
                            </label>
                            {selectedSociety.name.includes("Low Rise") ? (
                              <div className="grid grid-cols-2 gap-2">
                                <select
                                  value={selectedTowerLetter}
                                  onChange={(e) => {
                                    triggerHaptic();
                                    const letter = e.target.value;
                                    setSelectedTowerLetter(letter);
                                    setSelectedTowerNumber("1");
                                    setSelectedTower(`${letter}1`);
                                  }}
                                  className="w-full px-2.5 py-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-brand-primary text-gray-950 dark:text-slate-100"
                                >
                                  <option value="C">C</option>
                                  <option value="D">D</option>
                                  <option value="E">E</option>
                                </select>
                                <select
                                  value={selectedTowerNumber}
                                  onChange={(e) => {
                                    triggerHaptic();
                                    const num = e.target.value;
                                    setSelectedTowerNumber(num);
                                    setSelectedTower(`${selectedTowerLetter}${num}`);
                                  }}
                                  className="w-full px-2.5 py-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-brand-primary text-gray-950 dark:text-slate-100"
                                >
                                  {selectedTowerLetter === "C" && generateTowerBlocks("C", 1, 60).map((t) => <option key={t} value={t.slice(1)}>{t}</option>)}
                                  {selectedTowerLetter === "D" && generateTowerBlocks("D", 1, 33).map((t) => <option key={t} value={t.slice(1)}>{t}</option>)}
                                  {selectedTowerLetter === "E" && generateTowerBlocks("E", 1, 30).map((t) => <option key={t} value={t.slice(1)}>{t}</option>)}
                                </select>
                              </div>
                            ) : selectedSociety.name.includes("Tropical Garden") ? (
                              <select
                                value={selectedTower}
                                onChange={(e) => {
                                  triggerHaptic();
                                  setSelectedTower(e.target.value);
                                }}
                                className="w-full px-2.5 py-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-brand-primary text-gray-950 dark:text-slate-100"
                              >
                                {generateTowerBlocks("F", 1, 15).map((t) => (
                                  <option key={t} value={t}>{t}</option>
                                ))}
                              </select>
                            ) : (
                              <select
                                value={selectedTower}
                                onChange={(e) => {
                                  triggerHaptic();
                                  setSelectedTower(e.target.value);
                                }}
                                className="w-full px-2.5 py-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-brand-primary text-gray-950 dark:text-slate-100"
                              >
                                {selectedSociety.towers.map((t) => (
                                  <option key={t} value={t}>{t}</option>
                                ))}
                              </select>
                            )}
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9px] font-extrabold text-gray-500 dark:text-slate-400 uppercase tracking-wider block">
                              Floor
                            </label>
                            <select
                              value={selectedFloor}
                              onChange={(e) => {
                                triggerHaptic();
                                setSelectedFloor(selectedSociety.name.includes("Low Rise") || selectedSociety.name.includes("Tropical Garden") ? e.target.value : parseInt(e.target.value));
                              }}
                              className="w-full px-2.5 py-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-brand-primary text-gray-950 dark:text-slate-100"
                            >
                              {selectedSociety.name.includes("Low Rise") ? (
                                ["G", "1", "2", "3", "4"].map((f) => <option key={f} value={f}>{f}</option>)
                              ) : selectedSociety.name.includes("Tropical Garden") ? (
                                Array.from({ length: 24 }, (_, i) => i + 1).map((f) => <option key={f} value={f}>{f}</option>)
                              ) : (
                                Array.from({ length: selectedSociety.floorsCount }, (_, i) => i + 1).map((f) => <option key={f} value={f}>Floor {f}</option>)
                              )}
                            </select>
                          </div>

                          {!selectedSociety.name.includes("Low Rise") && (
                            <div className="space-y-1">
                              <label className="text-[9px] font-extrabold text-gray-500 dark:text-slate-400 uppercase tracking-wider block">
                                Flat ID
                              </label>
                              <select
                                value={selectedFlat}
                                onChange={(e) => {
                                  triggerHaptic();
                                  setSelectedFlat(e.target.value);
                                }}
                                className="w-full px-2.5 py-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-brand-primary text-gray-950 dark:text-slate-100"
                              >
                                {selectedSociety.name.includes("Tropical Garden") ? (
                                  Array.from({ length: 10 }, (_, i) => String(i + 1).padStart(2, "0")).map((flat) => (
                                    <option key={flat} value={flat}>
                                      {flat}
                                    </option>
                                  ))
                                ) : (
                                  generateFlats(selectedSociety.flatsPerFloor).map((flat) => (
                                    <option key={flat} value={flat}>
                                      {flat}
                                    </option>
                                  ))
                                )}
                              </select>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="p-3.5 bg-brand-primary/5 rounded-xl border border-brand-primary/10 flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-brand-primary shrink-0" />
                      <div className="text-[11px] text-brand-primary leading-tight font-medium">
                        Mapped Address: <span className="font-extrabold font-mono">
                          {selectedSociety.name.includes("Low Rise")
                            ? `${selectedSociety.name}, ${selectedTower}, Floor ${selectedFloor}`
                            : formatFlatId(selectedSociety.name, selectedTower, Number(selectedFloor) || 0, selectedFlat)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {step === finalStep && (
                  <div className="space-y-5">
                    <div className="space-y-1">
                      <h3 className="text-xl font-extrabold text-gray-900 dark:text-slate-100 tracking-tight">
                        Security Verification
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        Enter your standard flat MyGate code to finalize your secure onboarding.
                      </p>
                    </div>

                    {addressOccupiedError ? (
                      <div id="address-hijack-alert-card" className="p-5 bg-rose-50 dark:bg-slate-900 border-2 border-rose-500 rounded-2xl text-rose-800 dark:text-rose-300 space-y-3 animate-scale-up">
                        <div className="flex items-center gap-2">
                          <Shield className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 animate-pulse" />
                          <h4 className="font-extrabold text-xs uppercase tracking-wide">Anti-Hijacking Alert</h4>
                        </div>
                        <p className="text-[11px] leading-relaxed font-semibold">
                          Address Already Registered. An account is already tied to this flat. If this is an error, please contact support. Otherwise, the existing account must be deleted before this address can be reclaimed.
                        </p>
                        <div className="p-2.5 bg-rose-100/50 dark:bg-rose-950/70 rounded-xl text-[9px] text-rose-700 dark:text-rose-400 font-medium leading-relaxed">
                          🔒 Security Alert notification has been dispatched to the original registered owner of flat <span className="font-bold font-mono text-[10px]">
                            {selectedSociety.name.includes("Low Rise")
                              ? `${selectedSociety.name}, ${selectedTower}, Floor ${selectedFloor}`
                              : formatFlatId(selectedSociety.name, selectedTower, Number(selectedFloor) || 0, selectedFlat)}
                          </span>.
                        </div>
                      </div>
                    ) : error ? (
                      <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-semibold">
                        {error}
                      </div>
                    ) : null}

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold text-gray-500 dark:text-slate-400 uppercase tracking-wider block">
                        MyGate Verification Code
                      </label>
                      <input
                        type="text"
                        required
                        value={myGateId}
                        onChange={(e) => setMyGateId(e.target.value)}
                        placeholder="e.g. MG-VALLEY-B1-404"
                        className="w-full px-4 py-3 border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-sm font-mono focus:ring-2 focus:ring-brand-primary focus:outline-hidden uppercase text-gray-950 dark:text-slate-100 tracking-wider font-extrabold"
                      />
                      <div className="space-y-1.5 mt-2">
                        <label className="text-[10px] font-extrabold text-gray-500 dark:text-slate-400 uppercase tracking-wider block">
                          MyGate Screenshot
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          required
                          onClick={(e) => e.stopPropagation()}
                          onChange={async (e) => {
                            e.stopPropagation();
                            const file = e.target.files?.[0];
                            if (!file) return;
                            try {
                              const compressedFile = await compressImageFile(file, 1200, 1200, 0.8);
                              setMyGateScreenshotFile(compressedFile);
                              const url = await fileToDataUrl(compressedFile);
                              setMyGateScreenshot(url);
                            } catch (err) {
                              console.error("MyGate screenshot upload failed:", err);
                              setError("Failed to upload MyGate screenshot.");
                            }
                          }}
                          className="w-full text-xs text-gray-500 dark:text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-brand-primary-container file:text-brand-primary hover:file:bg-brand-primary/20 cursor-pointer"
                        />
                        {myGateScreenshot && (
                          <div className="mt-2 flex items-center gap-2">
                            <img src={myGateScreenshot} alt="MyGate screenshot preview" className="w-16 h-16 object-cover border border-gray-200 dark:border-slate-700 rounded-lg" />
                            <button
                              type="button"
                              onClick={() => {
                                setMyGateScreenshot("");
                                setMyGateScreenshotFile(null);
                              }}
                              className="text-rose-500 text-[10px] font-bold hover:underline cursor-pointer"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400 dark:text-slate-500 leading-normal">
                        This ID and screenshot are required for onboarding.
                      </p>
                    </div>

                    <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/15 flex items-start gap-2.5">
                      <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-extrabold text-emerald-800 dark:text-emerald-400">Onboarding Ready</h4>
                        <p className="text-[10px] text-emerald-700 dark:text-emerald-500 mt-0.5 leading-relaxed">
                          Your profile details and secure flat address will be locked on submit.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            <div className="pt-6 flex items-center justify-end gap-3 border-t border-gray-50 dark:border-slate-850 mt-auto">
            {step < finalStep ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="px-6 py-3 bg-brand-primary hover:bg-brand-primary/95 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleSubmit()}
                  className="w-full py-3 bg-brand-primary hover:bg-brand-primary/95 disabled:bg-brand-primary/50 text-white rounded-xl text-xs font-black shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Sparkles className="w-4 h-4 animate-spin text-amber-300" />
                      <span>{submissionStage || "Securing Flat Address..."}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Complete Resident Onboarding</span>
                    </>
                  )}
                </button>
              )}
            </div>

          </form>
        </div>

      </div>
    </div>
  );
}
