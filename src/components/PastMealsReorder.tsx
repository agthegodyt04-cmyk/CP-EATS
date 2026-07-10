import React from "react";
import { RefreshCw, Clock } from "lucide-react";
import { Order } from "../types";

interface PastMealsReorderProps {
  orders: Order[];
  onReorder: (ord: Order) => void;
  onViewHistory: () => void;
}

export default function PastMealsReorder({ orders, onReorder, onViewHistory }: PastMealsReorderProps) {
  const pastCompletedOrders = orders.filter(o => o.status === "COMPLETED");
  if (pastCompletedOrders.length === 0) return null;

  return (
    <div className="space-y-3 bg-indigo-50/30 dark:bg-slate-900/40 p-4 rounded-3xl border border-indigo-100/30 dark:border-slate-800/80 animate-fade-in">
      <div className="flex justify-between items-center px-1">
        <h3 className="text-xs font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          <span>Your Past Meals (Instant Reorder)</span>
        </h3>
        <button 
          onClick={onViewHistory}
          className="text-[10px] text-indigo-600 dark:text-indigo-400 font-extrabold hover:underline cursor-pointer"
        >
          View History →
        </button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none snap-x scroll-smooth">
        {pastCompletedOrders.map((ord) => (
          <div 
            key={ord.id}
            className="min-w-[220px] max-w-[220px] bg-white dark:bg-slate-950 border border-gray-100 dark:border-slate-850 p-4.5 rounded-2xl shadow-3xs flex flex-col justify-between gap-3 snap-start relative"
          >
            <div className="space-y-1.5">
              <div className="flex justify-between items-start gap-1">
                <h4 className="font-extrabold text-xs text-gray-950 dark:text-slate-100 truncate flex-1">
                  {ord.kitchenName}
                </h4>
                <span className="text-[9px] bg-slate-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 text-gray-500 dark:text-slate-400 px-1 py-0.5 rounded font-mono shrink-0">
                  {new Date(ord.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </span>
              </div>
              <p className="text-[10px] text-gray-500 dark:text-slate-400 font-medium line-clamp-2">
                {ord.items.map(i => `${i.quantity}x ${i.name}`).join(", ")}
              </p>
              <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                ₹{ord.total.toFixed(2)}
              </div>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onReorder(ord);
              }}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] rounded-xl flex items-center justify-center gap-1.5 transition-all uppercase tracking-wider cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Instant Reorder</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
