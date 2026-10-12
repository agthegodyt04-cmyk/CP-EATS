import React, { useState, useEffect, useRef } from "react";
import { collection, buildQuery, where, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, orderBy, limit, doc, db } from "../db";
import { ChatMessage } from "../types";
import { Send, Copy, Check, ShieldAlert, Award } from "lucide-react";

interface ChatProps {
  orderId: string;
  senderId: string;
  senderName: string;
  isKitchenView: boolean;
}

export default function Chat({ orderId, senderId, senderName, isKitchenView }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [errorText, setErrorText] = useState("");
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [enlargedUpiData, setEnlargedUpiData] = useState<{ upiId: string; displayName?: string; amount?: number } | null>(null);
  const [copiedInModal, setCopiedInModal] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (errorText) {
      const timer = setTimeout(() => setErrorText(""), 4000);
      return () => clearTimeout(timer);
    }
  }, [errorText]);

  useEffect(() => {
    const q = buildQuery(
      collection(db, "chats"),
      where("orderId", "==", orderId),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: ChatMessage[] = [];
      snapshot.forEach((doc) => {
        msgs.push({ id: doc.id, ...doc.data() } as ChatMessage);
      });
      setMessages(msgs);
    }, (err) => {
      console.error("Chat fetch error:", err);
    });

    return () => unsubscribe();
  }, [orderId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const messageText = newMessage.trim();
    if (!messageText) return;

    // [UPI REMOVED] "/UPI" command trigger stripped — no card can ever be created.
    try {
      const messageId = "chat_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
      await setDoc(doc(db, "chats", messageId), {
        id: messageId,
        orderId,
        senderId,
        senderName,
        text: messageText,
          createdAt: new Date().toISOString()
      });
      setNewMessage("");
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div id="order-chat-container" className="flex flex-col h-[500px] border border-gray-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
      {/* Chat Header */}
      <div className="bg-gray-50 dark:bg-slate-950 border-b border-gray-100 dark:border-slate-800 px-4 py-3 flex items-center justify-between relative">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
          <h3 className="font-semibold text-gray-800 dark:text-slate-200 text-sm">Direct Order Chat</h3>
        </div>
        {/* [UPI REMOVED] Request-Payment ₹ button + amount popover stripped */}
      </div>

      {/* Messages Feed */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-gray-50/50 dark:bg-slate-950/40">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-gray-400 mb-2">
              💬
            </div>
            <p className="text-sm font-medium text-gray-500 dark:text-slate-400">No messages yet</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Send a greeting to start coordinating delivery!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === senderId;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
              >
                {/* Sender Name */}
                <span className="text-[10px] text-gray-400 font-medium mb-1 px-1">
                  {msg.senderName}
                </span>

                {/* Message Bubble or UPI Card */}
                {msg.isUpiCard && msg.upiCardData ? (
                  <div className="w-full max-w-[320px] bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-2xl shadow-md border border-indigo-950 overflow-hidden mb-2 animate-fade-in">
                    {/* Header */}
                    <div className="bg-indigo-950/60 px-4 py-3 border-b border-indigo-800/40 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Award className="w-4 h-4 text-amber-400" />
                        <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-200">
                          Secure UPI Request
                        </span>
                      </div>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-medium">
                        {msg.upiCardData.bankName || "Verified Partner"}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="p-4 space-y-3">
                      {msg.upiCardData.amount > 0 ? (
                        <div className="flex justify-between items-baseline">
                          <span className="text-xs text-indigo-300">Requested Amount</span>
                          <span className="text-2xl font-black text-amber-300">
                            ₹{msg.upiCardData.amount.toFixed(2)}
                          </span>
                        </div>
                      ) : (
                        <div className="flex justify-between items-baseline">
                          <span className="text-xs text-indigo-300">Shared Payout Handle</span>
                          <span className="text-xs font-black text-emerald-400 uppercase tracking-wider">
                            Ready to Pay
                          </span>
                        </div>
                      )}

                      {/* UPI ID block */}
                      {msg.upiCardData.upiId && (
                        <div className="bg-slate-950/65 rounded-xl p-3 flex items-center justify-between border border-slate-800/50">
                          <div className="truncate pr-2">
                            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                              UPI Handle
                            </p>
                            <p className="text-xs font-mono text-white truncate font-medium">
                              {msg.upiCardData.upiId}
                            </p>
                          </div>
                          <button
                            onClick={() => copyToClipboard(msg.upiCardData!.upiId, msg.id)}
                            className="p-1.5 rounded-lg bg-indigo-950 hover:bg-indigo-900 text-indigo-300 transition-colors"
                            title="Copy UPI ID"
                          >
                            {copiedId === msg.id ? (
                              <Check className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      )}

                      {/* QR Code image if present */}
                      {msg.qrCodeUrl && (
                        <div className="flex flex-col items-center justify-center p-3 bg-white rounded-xl border border-indigo-950/25">
                          <p className="text-[9px] text-gray-400 font-extrabold uppercase mb-2">Scan QR Code to Pay</p>
                          <img
                            src={msg.qrCodeUrl}
                            alt="UPI QR Code"
                            className="max-w-[160px] max-h-[160px] object-contain rounded-lg shadow-xs cursor-zoom-in hover:opacity-90 active:scale-95 transition-all"
                            onClick={() => {
                              setEnlargedImage(msg.qrCodeUrl || null);
                              if (msg.upiCardData) {
                                setEnlargedUpiData({
                                  upiId: msg.upiCardData.upiId,
                                  displayName: msg.upiCardData.displayName,
                                  amount: msg.upiCardData.amount
                                });
                              } else {
                                setEnlargedUpiData(null);
                              }
                            }}
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      )}

                      {/* Safety Banner */}
                      <div className="bg-amber-500/10 rounded-lg p-2.5 border border-amber-500/20 flex gap-2">
                        <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-amber-200 leading-relaxed font-medium">
                          Verify that the recipient name is exactly <strong>{msg.upiCardData.displayName}</strong> on your payment app (GPay/PhonePe) before transferring funds.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`px-4 py-2.5 rounded-2xl text-sm max-w-[280px] leading-relaxed shadow-2xs ${
                      isMe
                        ? "bg-indigo-600 text-white rounded-tr-none"
                        : "bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-100 border border-gray-100 dark:border-slate-700 rounded-tl-none"
                    }`}
                  >
                    {msg.text}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Dynamic Error Banner */}
      {errorText && (
        <div className="mx-3 my-1.5 p-2 bg-rose-500/15 border border-rose-500/25 text-rose-600 dark:text-rose-400 rounded-lg text-xs font-semibold animate-fade-in text-center">
          {errorText}
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSendMessage} className="p-3 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 flex items-center gap-2 relative">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type your coordination details..."
          className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden transition-all text-gray-800 dark:text-slate-100"
        />
        <button
          type="submit"
          disabled={!newMessage.trim()}
          className="p-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-100 disabled:text-gray-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-600 text-white rounded-xl transition-all shadow-xs shrink-0 cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      {/* Global Chat Image Lightbox Modal */}
      {enlargedImage && (
        <div 
          onClick={() => {
            setEnlargedImage(null);
            setEnlargedUpiData(null);
            setCopiedInModal(false);
          }}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex flex-col items-center justify-center p-4 animate-fade-in"
        >
          <div 
            className="relative max-w-sm w-full bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-6 flex flex-col items-center shadow-2xl animate-scale-up" 
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => {
                setEnlargedImage(null);
                setEnlargedUpiData(null);
                setCopiedInModal(false);
              }}
              className="absolute top-4 right-4 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-300 w-8 h-8 flex items-center justify-center rounded-full transition-all cursor-pointer text-sm font-bold"
            >
              ✕
            </button>

            <div className="w-full text-center mb-4">
              <h3 className="text-xs font-black text-gray-950 dark:text-white uppercase tracking-wider">
                {enlargedUpiData ? "🔐 Secure UPI Payment" : "🔍 Image View"}
              </h3>
              <p className="text-[10px] text-gray-400 dark:text-slate-400 mt-1">
                {enlargedUpiData ? "Scan QR using your payment app or copy the UPI ID below" : "Enlarged image preview"}
              </p>
            </div>

            <div className="bg-white p-3 rounded-2xl border border-gray-100 dark:border-slate-850 shadow-sm mb-4 flex items-center justify-center">
              <img 
                src={enlargedImage} 
                alt="Enlarged View" 
                className="max-h-[180px] w-auto object-contain rounded-lg"
                referrerPolicy="no-referrer"
              />
            </div>

            {enlargedUpiData && (
              <div className="w-full space-y-4">
                <div className="bg-gray-50 dark:bg-slate-950/80 border border-gray-100 dark:border-slate-850/60 rounded-2xl p-3.5 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400 dark:text-slate-500 font-bold uppercase text-[9px] tracking-wider">Recipient Name</span>
                    <span className="text-gray-950 dark:text-white font-extrabold">{enlargedUpiData.displayName || "Neighbor"}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400 dark:text-slate-500 font-bold uppercase text-[9px] tracking-wider">UPI Handle / ID</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-indigo-600 dark:text-indigo-400 font-mono text-[11px] font-bold">{enlargedUpiData.upiId}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(enlargedUpiData.upiId);
                          setCopiedInModal(true);
                          setTimeout(() => setCopiedInModal(false), 2000);
                        }}
                        className="p-1 rounded bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-gray-600 dark:text-slate-300 cursor-pointer transition-colors"
                        title="Copy UPI ID"
                      >
                        {copiedInModal ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  {enlargedUpiData.amount && enlargedUpiData.amount > 0 ? (
                    <div className="flex justify-between items-center text-xs border-t border-gray-200/50 dark:border-slate-800/60 pt-2 mt-1">
                      <span className="text-gray-400 dark:text-slate-500 font-bold uppercase text-[9px] tracking-wider">Amount to Pay</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-black text-sm">₹{enlargedUpiData.amount.toFixed(2)}</span>
                    </div>
                  ) : null}
                </div>

                {/* Informational Guidance */}
                <div className="p-2.5 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/50 dark:border-indigo-900/20 rounded-xl">
                  <p className="text-[10px] text-indigo-600 dark:text-indigo-300 leading-relaxed text-center font-semibold">
                    💡 Scan the QR Code using Google Pay, PhonePe, or Paytm, or copy the UPI ID above to transfer funds manually.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
