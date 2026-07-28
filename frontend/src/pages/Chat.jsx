import React, { useState, useRef, useEffect, useCallback } from "react";
import { Send, User, Loader2, AlertCircle, Copy, Check, Plus, Sparkles, FileText, Table } from "lucide-react";
import { apiFetch } from "../lib/api";
import FilePicker from "../components/chat/FilePicker";

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copiedIndex, setCopiedIndex] = useState(null);

  // Attach a file so the assistant can answer questions about its actual contents.
  const [files, setFiles] = useState([]);
  const [activeFileId, setActiveFileId] = useState("");

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, isLoading]);

  // Load the user's files for the attach picker.
  useEffect(() => {
    apiFetch(`/files`).then(setFiles).catch(() => setFiles([]));
  }, []);

  // History is scoped to the attached file (or global when none). Reload on switch.
  const loadHistory = useCallback(async (fileId) => {
    try {
      const qs = fileId ? `?file_id=${fileId}` : "";
      const data = await apiFetch(`/ai/chat/history${qs}`);
      setMessages(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to load history", e);
      setMessages([]);
    }
  }, []);

  useEffect(() => {
    loadHistory(activeFileId);
  }, [activeFileId, loadHistory]);

  const presetPrompts = [
    { label: "Summarize this file", text: "Give me a 5-bullet summary of this dataset." },
    { label: "Key metrics", text: "What are the totals and averages of the numeric columns?" },
    { label: "Spot issues", text: "Are there any anomalies or data-quality problems?" },
    { label: "Draft email", text: "Draft a short update email to stakeholders about this data." },
  ];

  const handleSend = async (customText = null) => {
    const textToSend = customText || input;
    if (!textToSend.trim() || isLoading) return;

    const userMessage = { role: "user", content: textToSend.trim() };
    setMessages((prev) => [...prev, userMessage]);
    if (!customText) setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const data = await apiFetch(`/ai/chat`, {
        method: "POST",
        body: {
          message: textToSend.trim(),
          file_id: activeFileId ? Number(activeFileId) : null,
        },
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

  const activeFile = files.find((f) => String(f.id) === String(activeFileId));

  return (
    <div className="w-full max-w-5xl mx-auto h-[calc(100vh-6.5rem)] flex flex-col py-4 animate-show-panel">
      {/* Header row — part of the flex flow, so it can never overlap the messages. */}
      <div className="flex items-center justify-between gap-3 px-4 pb-3 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold text-slate-400 shrink-0 hidden sm:inline">Ask about</span>
          <FilePicker files={files} value={activeFileId} onChange={setActiveFileId} />
        </div>
        <button
          onClick={handleClear}
          className="px-3 py-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors flex items-center gap-1.5 text-sm font-medium shrink-0 cursor-pointer"
          title="New chat"
        >
          <Plus size={18} /> <span className="hidden sm:inline">New chat</span>
        </button>
      </div>

      {/* Main Chat Interface (sidebar removed) */}
      <div className="flex-grow bg-white flex flex-col relative overflow-hidden transition-all duration-300">

        {/* Empty State */}
        {isChatEmpty && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 overflow-y-auto">
            <div className="max-w-2xl w-full flex flex-col items-center animate-show-panel">
              <h2 className="text-3xl font-semibold text-slate-800 mb-3 tracking-tight">How can I help you today?</h2>
              {activeFile ? (
                <p className="text-sm text-slate-500 mb-8 flex items-center gap-1.5">
                  {activeFile.file_type === "pdf" ? <FileText size={15} /> : <Table size={15} />}
                  Answering questions about <span className="font-semibold text-slate-700">{activeFile.original_filename}</span>
                </p>
              ) : (
                <p className="text-sm text-slate-400 mb-8">Attach a file above to ask about your data, or just chat.</p>
              )}

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
            <div className="flex-grow overflow-y-auto p-6 md:p-8 space-y-8 pb-32 pt-8">
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
