import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Brain,
  Database,
  FileText,
  MessageSquare,
  Shield,
  Zap,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const fade = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] },
  }),
};

const features = [
  {
    icon: Brain,
    title: "Multi-Agent Reasoning",
    desc: "Chain multiple AI agents together for complex, multi-step business analysis and decision making.",
  },
  {
    icon: Database,
    title: "Data QA",
    desc: "Ask natural language questions against your CSVs and databases — no SQL required.",
  },
  {
    icon: FileText,
    title: "RAG Pipeline",
    desc: "Upload documents and get context-aware answers powered by vector search and embeddings.",
  },
  {
    icon: Shield,
    title: "Secure Sessions",
    desc: "OAuth2 + JWT authentication keeps every conversation and query scoped to your account.",
  },
];


export default function Home() {
  const { user } = useAuth();
  const firstName = user?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "there";

  return (
    <div className="max-w-5xl mx-auto px-6 py-16 space-y-28">

      {/* ── Hero ── */}
      <section className="space-y-6">
        <motion.p
          variants={fade}
          initial="hidden"
          animate="visible"
          custom={0}
          className="text-sm font-medium text-violet-600"
        >
          Welcome back, {firstName}
        </motion.p>

        <motion.h1
          variants={fade}
          initial="hidden"
          animate="visible"
          custom={1}
          className="text-4xl sm:text-5xl font-extrabold text-slate-900 leading-tight tracking-tight max-w-2xl"
        >
          Your AI workspace for
          <br />
          smarter workflows.
        </motion.h1>

        <motion.p
          variants={fade}
          initial="hidden"
          animate="visible"
          custom={2}
          className="text-slate-500 text-lg max-w-lg leading-relaxed"
        >
          Orchestrate multi-agent reasoning, query your data in plain English,
          and search documents — all in one place.
        </motion.p>

        <motion.div
          variants={fade}
          initial="hidden"
          animate="visible"
          custom={3}
          className="flex items-center gap-3 pt-2"
        >
          <Link
            to="/chat"
            className="uiverse-btn"
          >
            Chat
          </Link>
          <a href="#features" className="uiverse-learn-more">
            <span className="circle" aria-hidden="true">
              <span className="icon arrow"></span>
            </span>
            <span className="button-text">Learn More</span>
          </a>
        </motion.div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="space-y-10">
        <motion.h2
          variants={fade}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="text-2xl font-bold text-slate-900"
        >
          What you can do
        </motion.h2>

        <div className="grid sm:grid-cols-2 gap-6">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              variants={fade}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              custom={i}
              className="p-6 rounded-2xl border border-slate-200 bg-white hover:border-violet-200 hover:shadow-sm transition-all group"
            >
              <div className="h-10 w-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center mb-4 group-hover:bg-violet-100 transition-colors">
                <f.icon size={20} />
              </div>
              <h3 className="font-semibold text-slate-900 mb-1">{f.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Stats ── */}
      <motion.section
        variants={fade}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        className="grid grid-cols-3 gap-6 py-10 border-y border-slate-200/60"
      >
        {[
          { value: "~142ms", label: "Avg. response time" },
          { value: "70B", label: "Model parameters" },
          { value: "99.8%", label: "Schema accuracy" },
        ].map((s) => (
          <div key={s.label} className="text-center">
            <p className="text-3xl font-extrabold text-slate-900">{s.value}</p>
            <p className="text-xs text-slate-400 mt-1">{s.label}</p>
          </div>
        ))}
      </motion.section>

      {/* ── CTA ── */}
      <motion.section
        variants={fade}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        className="text-center space-y-4 pb-8"
      >
        <h2 className="text-2xl font-bold text-slate-900">Ready to get started?</h2>
        <p className="text-slate-500 text-sm">Jump into the AI workspace and start a conversation.</p>
        <Link
          to="/chat"
          className="uiverse-btn"
        >
          Launch Workspace
          <ArrowRight size={15} />
        </Link>
      </motion.section>
    </div>
  );
}
