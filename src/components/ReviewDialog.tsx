import React, { useState } from "react";
import { databaseService } from "../database";
import { Star, X } from "lucide-react";

interface ReviewDialogProps {
  orderId: string;
  kitchenId: string;
  kitchenName: string;
  customerId: string;
  customerName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ReviewDialog({
  orderId,
  kitchenId,
  kitchenName,
  customerId,
  customerName,
  onClose,
  onSuccess,
}: ReviewDialogProps) {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    try {
      const reviewId = "review_" + Date.now();
      const reviewData = {
        id: reviewId,
        orderId,
        kitchenId,
        customerId,
        customerName,
        rating,
        comment: comment.trim(),
        createdAt: new Date().toISOString(),
        isVerifiedHandshake: true,
      };

      // Use Supabase to save review
      const { supabase } = await import('../supabase');
      const { error } = await supabase
        .from('reviews')
        .insert([reviewData]);

      if (error) throw error;

      onSuccess();
    } catch (err) {
      console.error("Failed to save review:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-xl overflow-hidden animate-scale-up">
        <div className="bg-indigo-900 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base">Rate Your Meal</h3>
            <p className="text-xs text-indigo-200">From {kitchenName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-indigo-800/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Stars */}
          <div className="text-center space-y-2">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
              Tap to rate your experience
            </p>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(null)}
                  className="p-1 text-amber-400 hover:scale-110 transition-transform cursor-pointer"
                >
                  <Star
                    className="w-8 h-8"
                    fill={star <= (hoverRating ?? rating) ? "currentColor" : "none"}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Comment */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600 uppercase block">
              Share your feedback (Optional)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Tell other Centurian Park neighbors how the food tasted..."
              className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden min-h-[100px]"
              maxLength={200}
            />
            <p className="text-right text-[10px] text-gray-400">
              {comment.length}/200 characters
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-semibold transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-sm font-semibold transition-all shadow-xs cursor-pointer"
            >
              {submitting ? "Submitting..." : "Post Review"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
