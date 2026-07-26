import React, { useState, useRef, useEffect } from "react";
import { Send, User, Loader2, AlertCircle, Copy, Check, Plus, Sparkles, PanelLeftClose, PanelLeft } from "lucide-react";
import { apiFetch } from "../lib/api";

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const isChatEmpty = messages.length === 0;

  const scrollToBottom = () => {
    if (!isChatEmpty) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await apiFetch(`/ai/chat/history`);
        if (Array.isArray(data) && data.length > 0) setMessages(data);
      } catch (e) {
        console.error("Failed to load history", e);
      }
    };
    fetchHistory();
  }, []);

  const presetPrompts = [
    { label: "Synthesize Data", text: "Turn my sales data into 5 key bullet points." },
    { label: "Creative Brainstorm", text: "Generate 3 taglines for our new product." },
    { label: "Check Facts", text: "Compare GDPR and CCPA." },
    { label: "Draft Email", text: "Draft an update email to stakeholders." }
  ];

  const handleSend = async (customText = null) => {
    const textToSend = customText || input;
    if (!textToSend.trim() || isLoading) return;

    const userMessage = { role: "user", content: textToSend.trim() };
    const updatedMessages = [...messages, userMessage];

    setMessages(updatedMessages);
    if (!customText) setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const data = await apiFetch(`/ai/chat`, {
        method: "POST",
        body: { message: textToSend.trim() },
      });
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply, intent: data.intent },
      ]);
    } catch (err) {
      console.error("Chat error:", err);
      setError(err.message || "Failed to reach AI service.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    setMessages([]);
    setError(null);
  };

  const copyToClipboard = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="w-full max-w-7xl mx-auto h-[calc(100vh-6.5rem)] flex py-4 animate-show-panel relative">
      
      {/* Sidebar Overlay (Mobile & Desktop) */}
      <div 
        className={`fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm transition-opacity md:hidden ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
        onClick={() => setIsSidebarOpen(false)}
      />

      {/* Sidebar Controls - Gemini Style Collapsible */}
      <div className={`absolute md:relative z-50 h-full bg-white transition-all duration-300 ease-in-out shrink-0 overflow-hidden ${
        isSidebarOpen ? 'w-[280px] opacity-100 translate-x-0' : 'w-0 opacity-0 -translate-x-full md:translate-x-0 md:opacity-0 md:w-0'
      }`}>
        <div className="w-[280px] h-full flex flex-col p-3 pt-14 md:pt-3">
          <div className="flex items-center justify-between mb-4 px-2">
             <span className="font-semibold text-lg text-slate-800 flex items-center gap-2">
               Assistant
             </span>
             <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 rounded-full transition-colors"><PanelLeftClose size={20} /></button>
          </div>
          
          <div className="space-y-1 flex-grow overflow-y-auto custom-scrollbar pb-4">
            <button
              onClick={() => { handleClear(); setIsSidebarOpen(false); }}
              className="w-full py-3 px-4 rounded-full bg-[#e8ebf1] hover:bg-[#dfe3ea] text-slate-800 font-semibold text-sm flex items-center gap-3 transition-colors cursor-pointer mb-2"
            >
              <Plus size={18} />
              <span>New chat</span>
            </button>

            {/* Real, intent-routed assistant. No fabricated history — the sidebar only
                shows what the app can actually deliver. */}
            <div className="pt-4 px-4 text-[13px] text-slate-500 leading-relaxed">
              <p className="font-medium text-slate-700 mb-1">About this assistant</p>
              <p>
                Ask a data question and it routes automatically: SQL for metrics, document
                search for your indexed PDFs, or a general answer. Chat history is saved to
                your account and reloads when you return.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Interface */}
      <div className="flex-grow bg-white flex flex-col relative overflow-hidden transition-all duration-300">
        
        {/* Top bar with Toggle Button */}
        <div className="absolute top-0 left-0 p-4 z-10 flex items-center">
           {!isSidebarOpen && (
             <button 
               onClick={() => setIsSidebarOpen(true)}
               className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors group flex items-center gap-2"
               title="Open sidebar"
             >
               <PanelLeft size={20} className="group-hover:text-slate-800" />
             </button>
           )}
           {isSidebarOpen && <div className="hidden md:block w-8" />}
           {/* Add a button for "New Chat" on the top right like ChatGPT if sidebar is closed */}
           {!isSidebarOpen && (
              <button onClick={handleClear} className="p-2 ml-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors" title="New Chat">
                 <Plus size={20} />
              </button>
           )}
        </div>

        {/* Empty State */}
        {isChatEmpty && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 overflow-y-auto pt-16">
            <div className="max-w-2xl w-full flex flex-col items-center animate-show-panel">
              {/* Giant Glowing Orb Placeholder (Removed) */}
              
              <h2 className="text-3xl font-semibold text-slate-800 mb-10 tracking-tight">How can I help you today?</h2>

              <div className="w-full relative shadow-[0_4px_24px_rgb(0,0,0,0.06)] rounded-3xl border border-slate-200 bg-white mb-6">
                <textarea
                  rows={2}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Message..."
                  className="w-full bg-transparent p-5 pr-16 text-base text-slate-800 placeholder-slate-400 focus:outline-none resize-none"
                />
                <div className="flex items-center justify-end p-3 pb-4 px-4 bg-transparent rounded-b-3xl">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSend()}
                      disabled={!input.trim() || isLoading}
                      className="h-10 w-10 rounded-full bg-black hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white flex items-center justify-center transition-all cursor-pointer"
                    >
                      {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Starter prompts */}
              <div className="flex flex-wrap gap-2 justify-center">
                {presetPrompts.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => handleSend(p.text)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-full hover:border-violet-300 hover:text-violet-700 transition-colors cursor-pointer"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Active Chat State */}
        {!isChatEmpty && (
          <>
            <div className="flex-grow overflow-y-auto p-6 md:p-8 space-y-8 pb-32 pt-16">
              {messages.map((msg, idx) => {
                const isUser = msg.role === "user";
                return (
                  <div key={idx} className={`flex items-start gap-4 max-w-3xl mx-auto ${isUser ? "flex-row-reverse" : ""}`}>
                    {isUser ? (
                      <div className="h-8 w-8 rounded-full bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-sm mt-1">
                        <User size={16} />
                      </div>
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-violet-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-1">
                        <Sparkles size={16} />
                      </div>
                    )}

                    <div className={`flex flex-col gap-1 max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
                      <div className={`relative group p-4 text-[15px] leading-relaxed ${
                          isUser
                            ? "bg-slate-100 text-slate-900 rounded-3xl rounded-tr-sm"
                            : "bg-transparent text-slate-800"
                        }`}
                      >
                        <p className="whitespace-pre-wrap font-normal">{msg.content}</p>

                        {!isUser && (
                          <div className="flex items-center gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => copyToClipboard(msg.content, idx)}
                              className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-medium"
                            >
                              {copiedIndex === idx ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                              {copiedIndex === idx ? "Copied!" : "Copy"}
                            </button>
                            {msg.intent && (
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1 bg-slate-50 rounded-md border border-slate-100">
                                {msg.intent}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {isLoading && (
                <div className="flex items-start gap-4 max-w-3xl mx-auto">
                  <div className="h-8 w-8 rounded-full bg-violet-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-1">
                    <Sparkles size={16} />
                  </div>
                  <div className="p-4 flex items-center gap-3">
                    <div className="flex gap-1.5">
                      <div className="h-2 w-2 bg-violet-400 rounded-full animate-bounce"></div>
                      <div className="h-2 w-2 bg-violet-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                      <div className="h-2 w-2 bg-violet-400 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="max-w-3xl mx-auto p-4 rounded-2xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium flex items-center gap-2">
                  <AlertCircle size={18} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div ref={messagesEndRef} className="h-4" />
            </div>

            {/* Bottom Pinned Input */}
            <div className="absolute bottom-0 left-0 right-0 p-4 md:px-8 bg-gradient-to-t from-white via-white to-transparent pt-10">
              <div className="max-w-3xl mx-auto">
                <div className="relative shadow-[0_4px_24px_rgb(0,0,0,0.06)] rounded-3xl border border-slate-200 bg-white">
                  <textarea
                    ref={inputRef}
                    rows={1}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Message..."
                    className="w-full bg-transparent py-4 pl-5 pr-32 text-base text-slate-800 placeholder-slate-400 focus:outline-none resize-none max-h-32"
                  />
                  <div className="absolute right-2 bottom-2.5 flex items-center gap-1.5">
                    <button
                      onClick={() => handleSend()}
                      disabled={!input.trim() || isLoading}
                      className="h-9 w-9 rounded-full bg-black hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white flex items-center justify-center transition-all cursor-pointer"
                    >
                      {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    </button>
                  </div>
                </div>
                <div className="text-center text-xs text-slate-400 mt-2">
                  AI can make mistakes. Consider verifying important information.
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
