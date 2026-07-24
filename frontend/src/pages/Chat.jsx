import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, User, RefreshCw, Loader2, Database, FileText, Zap, AlertCircle, Copy, Check } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000/api/v1";

export default function Chat() {
  const { token } = useAuth();
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hello! I am your AI Business OS Assistant. I now have an auto-routing Intent Engine, so just ask your data, document, or general questions and I'll route them automatically!",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copiedIndex, setCopiedIndex] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/ai/chat/history`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.length > 0) {
            setMessages(data);
          }
        }
      } catch (e) {
        console.error("Failed to load history", e);
      }
    };
    fetchHistory();
  }, [token]);

  const presetPrompts = [
    { label: "Data Question", text: "What is the total revenue by category?" },
    { label: "Document Question", text: "What does the employee handbook say about PTO?" },
    { label: "General Chat", text: "Write a python snippet using pandas to calculate summary stats." },
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
      const response = await fetch(`${API_BASE_URL}/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: textToSend.trim() }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `Server error (${response.status})`);
      }

      const data = await response.json();
      
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
    setMessages([
      {
        role: "assistant",
        content: "Chat history cleared in UI (note: history persists in DB). How else can I help you?",
      },
    ]);
    setError(null);
  };

  const copyToClipboard = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="w-full max-w-6xl mx-auto h-[calc(100vh-6.5rem)] flex flex-col md:flex-row gap-6 py-4 animate-show-panel">
      {/* Sidebar Controls */}
      <div className="w-full md:w-80 bg-white rounded-3xl p-6 border border-slate-200/60 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] flex flex-col justify-between shrink-0">
        <div className="space-y-6">
          <button
            onClick={handleClear}
            className="w-full py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
          >
            <RefreshCw size={14} />
            <span>New UI Session</span>
          </button>

          <div className="space-y-3">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              AI Orchestrator Engine
            </label>
            <p className="text-xs text-slate-500 leading-relaxed">
              Your messages are automatically routed based on intent:
            </p>
            <div className="space-y-2 mt-2">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-violet-600 bg-violet-50 px-3 py-2 rounded-lg"><Database size={14}/> SQL Data Agent</div>
              <div className="flex items-center gap-2 text-[11px] font-semibold text-blue-600 bg-blue-50 px-3 py-2 rounded-lg"><FileText size={14}/> RAG Doc Agent</div>
              <div className="flex items-center gap-2 text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-3 py-2 rounded-lg"><Bot size={14}/> General LLM</div>
            </div>
          </div>

          <div className="space-y-2 pt-4 border-t border-slate-100">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Test Prompts
            </label>
            <div className="space-y-2">
              {presetPrompts.map((p, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(p.text)}
                  className="w-full p-3 text-left rounded-2xl bg-slate-50 border border-slate-200/60 hover:border-slate-300 hover:bg-slate-100/80 transition-all text-xs text-slate-600 font-medium cursor-pointer"
                >
                  <div className="font-semibold text-slate-800 text-[11px] mb-0.5">{p.label}</div>
                  <div className="truncate text-[10px] text-slate-400">{p.text}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
          <span>Engine: Smart Router</span>
          <span className="flex items-center gap-1 font-semibold text-emerald-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Online
          </span>
        </div>
      </div>

      {/* Main Chat Interface */}
      <div className="flex-grow bg-white rounded-3xl border border-slate-200/60 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
              <Bot size={20} />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-sm">Unified AI Workspace</h2>
              <p className="text-[11px] text-slate-400 font-medium">Automatic intent classification & routing</p>
            </div>
          </div>
        </div>

        <div className="flex-grow overflow-y-auto p-6 space-y-6">
          {messages.map((msg, idx) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={idx}
                className={`flex items-start gap-3.5 ${isUser ? "flex-row-reverse" : ""}`}
              >
                <div
                  className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 text-white text-xs font-bold shadow-sm ${
                    isUser ? "bg-slate-900" : "bg-indigo-600"
                  }`}
                >
                  {isUser ? <User size={16} /> : <Bot size={16} />}
                </div>

                <div className="flex flex-col gap-1 max-w-[80%]">
                  {!isUser && msg.intent && (
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      Routed via {msg.intent.toUpperCase()} Agent
                    </div>
                  )}
                  <div
                    className={`relative group rounded-2xl p-4 text-xs leading-relaxed ${
                      isUser
                        ? "bg-indigo-600 text-white rounded-tr-none shadow-sm"
                        : "bg-slate-50 border border-slate-200/60 text-slate-800 rounded-tl-none"
                    }`}
                  >
                    <p className="whitespace-pre-wrap font-normal">{msg.content}</p>

                    {!isUser && (
                      <button
                        onClick={() => copyToClipboard(msg.content, idx)}
                        className="absolute top-2 right-2 p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                        title="Copy response"
                      >
                        {copiedIndex === idx ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex items-start gap-3.5">
              <div className="h-8 w-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                <Bot size={16} />
              </div>
              <div className="bg-slate-50 border border-slate-200/60 rounded-2xl rounded-tl-none p-4 flex items-center gap-2">
                <Loader2 size={16} className="animate-spin text-indigo-600" />
                <span className="text-xs text-slate-500 font-medium">Orchestrator is routing and answering...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-medium flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 bg-slate-50/50 border-t border-slate-100">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="relative flex items-center"
          >
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything or enter a message..."
              className="w-full bg-white border border-slate-200 rounded-2xl py-3.5 pl-4 pr-14 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-600 transition-all resize-none shadow-sm"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="absolute right-2.5 h-9 w-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white flex items-center justify-center transition-all duration-200 cursor-pointer shadow-sm"
            >
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </form>
          <div className="mt-2 text-center text-[10px] text-slate-400">
            Press <kbd className="font-sans px-1 py-0.5 rounded bg-slate-200/80 text-slate-600">Enter</kbd> to send
          </div>
        </div>
      </div>
    </div>
  );
}
