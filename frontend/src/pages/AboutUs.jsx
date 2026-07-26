import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Brain,
  Database,
  TrendingUp,
  Shield,
  ArrowRight,
  Layers,
  CheckCircle2,
} from "lucide-react";

const fade = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] },
  }),
};

const pillars = [
  {
    icon: Brain,
    title: "Multi-Agent Orchestration",
    desc: "Specialized AI agents collaborate on data cleaning, SQL generation, and statistical modeling to solve complex analytical workflows autonomously.",
    color: "from-violet-500 to-purple-600",
  },
  {
    icon: Database,
    title: "Scalable Data QA & ETL",
    desc: "An O(issue-types) cleaning engine that makes wide datasets with 90+ columns just as simple to inspect and standardize as a 9-column CSV.",
    color: "from-blue-500 to-cyan-600",
  },
  {
    icon: TrendingUp,
    title: "Dynamic ML & Forecasting",
    desc: "Time-series forecasting, trend analysis, anomaly detection, and RFM customer segmentation with seamless, zero-typing column selection.",
    color: "from-emerald-500 to-teal-600",
  },
  {
    icon: Shield,
    title: "Enterprise-Grade Security",
    desc: "Built with OAuth2 and JWT authentication, ensuring every dataset, session, and generated report remains strictly scoped and protected.",
    color: "from-amber-500 to-orange-600",
  },
];

const techStack = [
  { name: "FastAPI & Python 3.10+", role: "High-performance async API & ML backend" },
  { name: "React 18 & Vite", role: "Ultra-responsive frontend workspace" },
  { name: "Tailwind CSS & Framer Motion", role: "Modern design system & fluid micro-animations" },
  { name: "Scikit-Learn & Pandas", role: "Data transformations, RFM clustering & anomaly detection" },
  { name: "Multi-Agent LLM Core", role: "Autonomous reasoning & semantic classification" },
  { name: "SQLAlchemy & SQLite/PostgreSQL", role: "Robust transactional storage & dataset metadata" },
];

export default function AboutUs() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-16 space-y-24">
      {/* ── Hero Section ── */}
      <section className="space-y-6 text-center max-w-3xl mx-auto">
        <motion.h1
          variants={fade}
          initial="hidden"
          animate="visible"
          custom={1}
          className="text-4xl sm:text-6xl font-extrabold text-slate-900 leading-tight tracking-tight"
        >
          Built for the next era of{" "}
          <span className="bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
            data intelligence.
          </span>
        </motion.h1>

        <motion.p
          variants={fade}
          initial="hidden"
          animate="visible"
          custom={2}
          className="text-slate-600 text-lg sm:text-xl leading-relaxed"
        >
          We bridge the gap between raw, messy tabular data and executive decision-making. 
          By combining multi-agent reasoning with interactive machine learning, we empower teams to analyze data in seconds—without writing SQL or scripts.
        </motion.p>
      </section>

      {/* ── Mission Card ── */}
      <motion.section
        variants={fade}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        custom={3}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-violet-950 p-8 sm:p-12 text-white shadow-xl"
      >
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-violet-300">
            <Layers size={14} />
            <span>Why We Built Insyte</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-bold leading-snug">
            Traditional BI tools force you to choose between rigid dashboards and complex code. We built a third path.
          </h2>
          <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
            Whether your CSV has 9 columns or 90 columns, our platform automatically identifies quality issues, categorizes semantic roles, and surfaces AI-driven forecasts and anomalies. You stay in control of the strategy while autonomous agents handle the heavy lifting.
          </p>
        </div>
      </motion.section>

      {/* ── Core Pillars ── */}
      <section className="space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <h2 className="text-3xl font-bold text-slate-900">Core Pillars</h2>
          <p className="text-sm text-slate-500">
            Everything in the workspace is built around speed, accuracy, and intuitive interaction.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {pillars.map((pillar, index) => {
            const Icon = pillar.icon;
            return (
              <motion.div
                key={pillar.title}
                variants={fade}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                custom={index}
                className="group relative rounded-2xl bg-white border border-slate-200/80 p-8 hover:border-violet-200 hover:shadow-lg transition-all duration-300"
              >
                <div className="flex items-start gap-5">
                  <div className={`p-3.5 rounded-2xl bg-gradient-to-br ${pillar.color} text-white shadow-sm shrink-0 group-hover:scale-105 transition-transform duration-300`}>
                    <Icon size={24} />
                  </div>
                  <div className="space-y-2.5">
                    <h3 className="text-lg font-bold text-slate-900">{pillar.title}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{pillar.desc}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ── Tech Stack Grid ── */}
      <section className="space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <h2 className="text-3xl font-bold text-slate-900">Powered By Modern Stack</h2>
          <p className="text-sm text-slate-500">
            Architected for reliability, scalability, and seamless real-time interactivity.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {techStack.map((tech, i) => (
            <motion.div
              key={tech.name}
              variants={fade}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              custom={i * 0.5}
              className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/60 flex items-start gap-3.5"
            >
              <CheckCircle2 size={18} className="text-violet-600 mt-0.5 shrink-0" />
              <div>
                <div className="text-sm font-semibold text-slate-900">{tech.name}</div>
                <div className="text-xs text-slate-500 mt-0.5">{tech.role}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Call To Action Footer ── */}
      <motion.section
        variants={fade}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        className="rounded-3xl bg-violet-50 border border-violet-200/80 p-8 sm:p-12 text-center space-y-6"
      >
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
          Ready to explore your data?
        </h2>
        <p className="text-sm sm:text-base text-slate-600 max-w-xl mx-auto">
          Upload a dataset, run automated quality audits, or start an AI conversation with your documents today.
        </p>
        <div className="flex flex-wrap justify-center gap-4 pt-2">
          <Link
            to="/analytics"
            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-6 py-3 rounded-full transition-all duration-200 shadow-sm"
          >
            Open Analytics
            <ArrowRight size={14} />
          </Link>
          <Link
            to="/chat"
            className="inline-flex items-center gap-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs font-semibold px-6 py-3 rounded-full transition-all duration-200"
          >
            Start AI Chat
          </Link>
        </div>
      </motion.section>
    </div>
  );
}
