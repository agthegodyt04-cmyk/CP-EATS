import React, { useState, useEffect } from "react";
import { collection, buildQuery, where, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, orderBy, limit, doc, db } from "../db";
import { UserProfile, Review } from "../types";
import { ShieldAlert, Trash2, Check, UserMinus, ShieldCheck, Users, Star } from "lucide-react";

interface AdminPanelProps {
  currentProfile: UserProfile;
}

export default function AdminPanel({ currentProfile }: AdminPanelProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"residents" | "reviews">("residents");
  const [feedbackMsg, setFeedbackMsg] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch Users
      const usersSnap = await getDocs(collection(db, "users"));
      const usersList: UserProfile[] = [];
      usersSnap.forEach((doc) => {
        // Raw Supabase rows expose `id`/`name`; the app uses `uid`/`displayName`.
        // Normalize here so the table renders names and the verify/ban actions
        // target a real user id (previously they were undefined -> no-op).
        const raw = doc.data() as Record<string, any>;
        usersList.push({
          ...raw,
          uid: raw.uid || raw.id || doc.id,
          displayName: raw.displayName || raw.name || "User",
        } as UserProfile);
      });
      setUsers(usersList);

      // Fetch Reviews
      const reviewsSnap = await getDocs(collection(db, "reviews"));
      const reviewsList: Review[] = [];
      reviewsSnap.forEach((doc) => {
        reviewsList.push({ id: doc.id, ...doc.data() } as Review);
      });
      setReviews(reviewsList);
    } catch (err) {
      console.error("Admin fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdateUserStatus = async (userId: string, newStatus: UserProfile["status"]) => {
    try {
      await updateDoc(doc(db, "users", userId), { status: newStatus });
      setFeedbackMsg(`Resident status successfully updated to ${newStatus}.`);
      fetchData();
      setTimeout(() => setFeedbackMsg(""), 3000);
    } catch (err) {
      console.error("Error updating resident status:", err);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!window.confirm("Are you sure you want to delete this community review?")) return;
    try {
      await deleteDoc(doc(db, "reviews", reviewId));
      setFeedbackMsg("Review deleted successfully.");
      fetchData();
      setTimeout(() => setFeedbackMsg(""), 3000);
    } catch (err) {
      console.error("Error deleting review:", err);
    }
  };

  return (
    <div id="admin-panel" className="max-w-5xl mx-auto p-6 bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm space-y-6">
      <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-indigo-600 dark:text-indigo-400 animate-pulse" />
            <span>Centurian Park Moderation Suite</span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
            Admin access logged as <strong>{currentProfile.displayName}</strong> ({currentProfile.email})
          </p>
        </div>
        <button
          onClick={fetchData}
          className="px-3 py-1.5 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition-all"
        >
          Refresh Data
        </button>
      </div>

      {feedbackMsg && (
        <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-bold animate-fade-in">
          {feedbackMsg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-100 dark:border-slate-800 pb-1">
        <button
          onClick={() => setActiveTab("residents")}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === "residents"
              ? "border-indigo-600 text-indigo-950 dark:text-indigo-300"
              : "border-transparent text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-300"
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Users className="w-4 h-4" />
            <span>Resident Audits ({users.length})</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab("reviews")}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === "reviews"
              ? "border-indigo-600 text-indigo-950 dark:text-indigo-300"
              : "border-transparent text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-300"
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Star className="w-4 h-4" />
            <span>Reviews Moderation ({reviews.length})</span>
          </div>
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-400 dark:text-slate-500 text-sm">
          Loading administration audit data...
        </div>
      ) : activeTab === "residents" ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-800 text-xs text-gray-400 dark:text-slate-400 font-bold uppercase bg-gray-50/50 dark:bg-slate-950/20">
                <th className="p-3">Resident</th>
                <th className="p-3">Role</th>
                <th className="p-3">Society Flat Address</th>
                <th className="p-3">MyGate Code</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-gray-50 dark:divide-slate-800">
              {users.map((u) => (
                <tr key={u.uid} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="p-3">
                    <p className="font-bold text-gray-800 dark:text-slate-100">{u.displayName}</p>
                    <p className="text-[10px] text-gray-400 dark:text-slate-400">{u.email}</p>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[9px] ${
                      u.role === "kitchen" ? "bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300" : u.role === "admin" ? "bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300" : "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="p-3 text-gray-600 dark:text-slate-300 font-medium">{u.flatAddress}</td>
                  <td className="p-3 font-mono font-bold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 rounded-sm px-1.5 py-0.5 text-[10px]">
                    {u.myGateId}
                  </td>
                  <td className="p-3">
                    <span className={`px-2.5 py-1 rounded-full font-bold uppercase text-[9px] ${
                      u.status === "verified" ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300" : u.status === "banned" ? "bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300" : "bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300"
                    }`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-1.5">
                      {u.status !== "verified" && (
                        <button
                          onClick={() => handleUpdateUserStatus(u.uid, "verified")}
                          className="p-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 transition-colors"
                          title="Verify Resident"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      {u.status !== "banned" && u.uid !== currentProfile.uid && (
                        <button
                          onClick={() => handleUpdateUserStatus(u.uid, "banned")}
                          className="p-1 rounded-lg bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 transition-colors"
                          title="Suspend Resident"
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-slate-400 text-center py-6">No community reviews posted yet.</p>
          ) : (
            reviews.map((r) => (
              <div key={r.id} className="p-4 border border-gray-100 dark:border-slate-800 rounded-2xl bg-gray-50/30 dark:bg-slate-900/30 flex justify-between items-start">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-800 dark:text-slate-100">{r.customerName}</span>
                    <span className="text-[10px] text-gray-400 dark:text-slate-500">reviewed kitchen ID: {r.kitchenId}</span>
                  </div>
                  <div className="flex gap-1 text-amber-400">
                    {Array.from({ length: r.rating }).map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-current" />
                    ))}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed italic">"{r.comment || "No written text comment"}"</p>
                </div>
                <button
                  onClick={() => handleDeleteReview(r.id)}
                  className="p-2 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 rounded-xl transition-all cursor-pointer"
                  title="Delete Review"
                >
                  <Trash2 className="w-4 h-4" strokeWidth={2.5} />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
