import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Brain,
  ExternalLink,
  TrendingUp,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const fade = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] },
  }),
};

const features = [
  {
    tag: "01 / REASONING",
    title: "Ask complex business questions",
    desc: "e.g. 'Why did revenue drop last quarter?' gets a real multi-step answer, not just a number.",
  },
  {
    tag: "02 / DATA QA",
    title: "Chat with your spreadsheet",
    desc: "Ask 'which region underperformed?' and get an answer straight from your CSV.",
  },
  {
    tag: "03 / DOCUMENT SEARCH",
    title: "Search your documents",
    desc: "Upload contracts/policies/reports and ask questions across all of them at once.",
  },
  {
    tag: "04 / SECURITY & PRIVACY",
    title: "Your data stays yours",
    desc: "Every session is authenticated and scoped only to your account.",
  },
  {
    tag: "05 / FORECASTING",
    title: "See what's coming next",
    desc: "Time-series projection with visible ARIMA trendlines and seasonal confidence ranges.",
  },
  {
    tag: "06 / REPORTS & EXPORT",
    title: "Turn insights into a deck",
    desc: "One-click export for PDF summaries and presentation-ready business slides.",
  },
];

const howItWorks = [
  {
    step: "01",
    title: "Upload any CSV or Excel file",
    desc: "Drop messy tabular datasets with 9 to 90+ columns. Our O(types) engine standardizes schemas instantly, auto-detecting missing values and duplicate rows with sensible defaults.",
  },
  {
    step: "02",
    title: "Ask in plain English",
    desc: "No SQL or scripts required. Type your question or pick ready-made analyses like multi-period forecasting, RFM segmentation, and cohort churn.",
  },
  {
    step: "03",
    title: "Get executive insights",
    desc: "Receive visual dashboards, root-cause explanations, and presentation-ready business summaries—exactly what you'd expect from a senior data analyst.",
  },
];

const faqs = [
  {
    q: "What file types and formats can I upload?",
    a: "Insyte supports raw CSV, Excel (.xlsx, .xls), and TSV datasets. You can upload messy, multi-column spreadsheets with 10 to 100,000+ rows—our schema engine normalizes column types automatically.",
  },
  {
    q: "Is my data used to train any AI models?",
    a: "No. Your data is never used to train public or commercial AI models. Every session is authenticated, encrypted, and isolated to your private account.",
  },
  {
    q: "Do I need to know SQL or Python to use Insyte?",
    a: "Not at all. You ask questions in everyday plain English. Under the hood, Insyte coordinates specialized reasoning and statistical agents to calculate answers, generate charts, and explain results.",
  },
];

export default function Home() {
  const { user } = useAuth();
  const firstName =
    user?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "there";

  return (
    <div className="w-full overflow-x-hidden">
      <div className="max-w-6xl mx-auto px-6 py-12 space-y-28">
        {/* ── Hero Section (Phase 7.1: Lead with Outcome) ── */}
        <section className="space-y-8 pt-4">
        {/* Top Badges */}
        <motion.div
          variants={fade}
          initial="hidden"
          animate="visible"
          custom={0}
          className="flex items-center gap-2"
        >
          <span className="text-sm font-medium text-violet-600">
            Welcome back, {firstName}
          </span>
        </motion.div>

        {/* Outcome Headline */}
        <motion.h1
          variants={fade}
          initial="hidden"
          animate="visible"
          custom={1}
          className="text-4xl sm:text-6xl font-extrabold text-slate-900 leading-[1.12] tracking-tight max-w-3xl"
        >
          Turn raw spreadsheets into decisions.
        </motion.h1>

        {/* Outcome Subtitle */}
        <motion.p
          variants={fade}
          initial="hidden"
          animate="visible"
          custom={2}
          className="text-slate-600 text-lg sm:text-xl max-w-2xl leading-relaxed"
        >
          Upload a CSV, ask questions in plain English, get AI-generated
          dashboards, forecasts, and reports.{" "}
          <span className="font-semibold text-slate-900">
            No SQL, no analyst required.
          </span>
        </motion.p>
        <motion.p
          variants={fade}
          initial="hidden"
          animate="visible"
          custom={3}
          className="text-slate-500 text-base sm:text-lg max-w-2xl leading-relaxed font-normal"
        >
          Built for founders, ops teams, and analysts who need answers from their data today — not after a week of dashboard requests.
        </motion.p>

        {/* CTA Button */}
        <motion.div
          variants={fade}
          initial="hidden"
          animate="visible"
          custom={4}
          className="flex flex-wrap items-center gap-4 pt-2"
        >
          <Link
            to="/chat"
            className="uiverse-btn"
          >
            Launch Workspace
            <ArrowRight size={16} />
          </Link>
          <Link to="/about" className="uiverse-learn-more">
            <span className="circle" aria-hidden="true">
              <span className="icon arrow"></span>
            </span>
            <span className="button-text">About Us</span>
          </Link>
        </motion.div>

        {/* ── Concrete Inline Chat Mockup (Phase 7.1 Requirement) ── */}
        <motion.div
          variants={fade}
          initial="hidden"
          animate="visible"
          custom={4}
          className="max-w-2xl mt-8 rounded-2xl border border-slate-200/80 bg-gradient-to-b from-slate-50/80 to-white p-5 shadow-sm space-y-3.5"
        >
          {/* User Query Bubble */}
          <div className="flex justify-end">
            <div className="rounded-2xl rounded-tr-sm bg-slate-900 text-white px-4 py-2.5 text-sm font-medium shadow-sm max-w-[85%]">
              Which products made the highest revenue last month?
            </div>
          </div>

          {/* AI Response Bubble */}
          <div className="flex items-start gap-3">
            <div className="h-7 w-7 rounded-lg bg-violet-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
              <Brain size={14} />
            </div>
            <div className="rounded-2xl rounded-tl-sm bg-violet-50/80 border border-violet-100/80 px-4 py-3 text-sm text-slate-800 space-y-2 shadow-sm">
              <p className="font-semibold text-slate-900">
                Electronics led with $84K, up 12% from last month.
              </p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 pt-1">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-medium">
                  <TrendingUp size={11} />
                  <span>+$84,000 (+12.4% MoM)</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">
                  <CheckCircle2 size={11} className="text-violet-600" />
                  <span>Verified against 12,400 rows</span>
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── Product in Action Visual Preview (Split-Screen Showcase, NO CARDS) ── */}
      <section className="py-10 grid md:grid-cols-12 gap-10 items-center">
        {/* Left Column: Editorial Value Proposition */}
        <div className="md:col-span-5 space-y-6">
          <div className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-violet-600 font-mono">
              Product Demo
            </h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
              See your spreadsheet transform in seconds
            </h3>
          </div>
          <p className="text-base text-slate-600 leading-relaxed">
            No manual pivot tables or formula errors. Upload any raw CSV and watch our time-series engine automatically project Q4 revenue with ARIMA forecasting.
          </p>
          <div className="pt-2">
            <Link
              to="/analytics"
              className="inline-flex items-center gap-2 text-sm font-semibold text-violet-600 hover:text-violet-700 transition-colors group"
            >
              <span>Explore the Interactive Demo</span>
              <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>

        {/* Right Column: Floating Open Chart Showcase (No Card Background) */}
        <div className="md:col-span-7 relative">
          <div className="absolute -inset-4 bg-gradient-to-tr from-violet-500/10 via-purple-500/5 to-transparent rounded-3xl blur-2xl pointer-events-none" />

          <div className="relative rounded-2xl bg-slate-900 text-white p-6 sm:p-8 shadow-2xl space-y-6 border border-slate-800">
            <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-4">
              <span className="font-mono text-slate-300 font-medium">Monthly Revenue &amp; 90-Day Forecast</span>
              <span className="text-violet-400 font-medium">ARIMA + Linear Trend</span>
            </div>

            {/* Bar / Line Visual Bars */}
            <div className="h-44 flex items-end justify-between gap-3 pt-4 px-1">
              {[
                { m: "Jun", h: "40%", val: "$58K" },
                { m: "Jul", h: "55%", val: "$64K" },
                { m: "Aug", h: "65%", val: "$71K" },
                { m: "Sep", h: "85%", val: "$84K" },
                { m: "Oct (F)", h: "95%", val: "$96K", forecast: true },
                { m: "Nov (F)", h: "100%", val: "$104K", forecast: true },
              ].map((item) => (
                <div key={item.m} className="flex-1 flex flex-col items-center gap-1.5">
                  <span className="text-[10px] text-slate-400 font-mono">
                    {item.val}
                  </span>
                  <div
                    style={{ height: item.h }}
                    className={`w-full rounded-t-md transition-all ${
                      item.forecast
                        ? "bg-gradient-to-t from-violet-600/60 to-purple-400 border-t-2 border-dashed border-violet-300"
                        : "bg-gradient-to-t from-violet-700 to-indigo-500"
                    }`}
                  />
                  <span className="text-xs text-slate-400 font-medium mt-1">
                    {item.m}
                  </span>
                </div>
              ))}
            </div>

            {/* AI Summary Pill at Bottom of Chart */}
            <div className="pt-4 border-t border-slate-800 flex items-start gap-3">
              <div className="h-6 w-6 rounded-md bg-violet-600/20 text-violet-400 flex items-center justify-center shrink-0 mt-0.5">
                <Brain size={13} />
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                <span className="font-semibold text-white">Executive AI Summary:</span> Revenue grew <span className="text-emerald-400 font-semibold">+12.4% MoM</span> in September. Time-series projection estimates $200K total Q4 revenue.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── "What you can do" (Editorial Spec Sheet, NO CARDS) ── */}
      <section id="features" className="space-y-10 py-6">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-violet-600 font-mono">
            Core Outcome
          </h2>
          <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            What you can do
          </h3>
        </div>

        {/* Editorial Spec List (No cards, no box borders) */}
        <div className="divide-y divide-slate-200/80 border-y border-slate-200/80">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              variants={fade}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              custom={i}
              className="py-8 sm:py-10 grid sm:grid-cols-12 gap-4 sm:gap-8 items-baseline hover:bg-slate-50/50 transition-colors px-2"
            >
              <div className="sm:col-span-3">
                <span className="text-xs font-mono font-bold tracking-wider text-violet-600">
                  {f.tag}
                </span>
              </div>
              <div className="sm:col-span-4">
                <h4 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  {f.title}
                </h4>
              </div>
              <div className="sm:col-span-5">
                <p className="text-base text-slate-600 leading-relaxed">
                  {f.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Who It's For (Editorial Audience Block, NO CARDS) ── */}
      <section className="py-10 max-w-3xl mx-auto text-center sm:text-left space-y-4 border-t border-slate-200/80 pt-16">
        <span className="text-xs font-mono font-bold uppercase tracking-wider text-violet-600">
          AUDIENCE
        </span>
        <h3 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
          Built for people who make decisions, not spreadsheets
        </h3>
        <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
          Whether you&apos;re a founder checking weekly revenue trends, an operations team spotting regional anomalies, or an analyst who&apos;d rather ask a question in plain English than write 50 lines of SQL—Insyte gives you immediate clarity without waiting on a data team.
        </p>
      </section>

      {/* ── How It Works (Connected Timeline, NO CARDS) ── */}
      <section className="space-y-12 py-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-violet-600 font-mono">
            How It Works
          </h2>
          <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            From CSV to executive answer in 3 steps
          </h3>
        </div>

        <div className="grid md:grid-cols-3 gap-10 sm:gap-12 relative pt-6">
          {/* Connecting hairline sequence line left-to-right across desktop steps */}
          <div className="hidden md:block absolute top-12 left-6 right-6 h-px bg-slate-200 z-0" />

          {howItWorks.map((item, idx) => (
            <motion.div
              key={item.step}
              variants={fade}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              custom={idx}
              className="relative z-10 space-y-4"
            >
              {/* Numbered circle (rounded-full border, no fill) */}
              <div className="inline-flex items-center justify-center h-12 w-12 rounded-full border-2 border-violet-600 text-violet-600 font-mono font-bold text-sm bg-white">
                {item.step}
              </div>
              <h4 className="text-xl font-bold text-slate-900 tracking-tight">
                {item.title}
              </h4>
              <p className="text-base text-slate-600 leading-relaxed">
                {item.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── FAQ Section (Editorial Spec Sheet List, NO CARDS) ── */}
      <section className="space-y-10 py-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-violet-600 font-mono">
            FAQ
          </h2>
          <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Frequently asked questions
          </h3>
        </div>

        <div className="divide-y divide-slate-200/80 border-y border-slate-200/80">
          {faqs.map((faq, idx) => (
            <motion.div
              key={faq.q}
              variants={fade}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              custom={idx}
              className="py-8 sm:py-10 grid sm:grid-cols-12 gap-4 sm:gap-8 items-baseline px-2"
            >
              <div className="sm:col-span-5">
                <h4 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                  {faq.q}
                </h4>
              </div>
              <div className="sm:col-span-7">
                <p className="text-base text-slate-600 leading-relaxed">
                  {faq.a}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── CTA Section (Open Cardless Banner) ── */}
      <motion.section
        variants={fade}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        className="py-16 text-center space-y-6 max-w-2xl mx-auto border-t border-slate-200/80"
      >
        <div className="space-y-3">
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
            Ready to get started?
          </h2>
          <p className="text-slate-600 text-base sm:text-lg leading-relaxed">
            Jump into the AI workspace and start turning your spreadsheets into
            decisions today.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <Link
            to="/chat"
            className="uiverse-btn"
          >
            Launch Workspace
            <ArrowRight size={16} />
          </Link>
          <Link to="/about" className="uiverse-learn-more">
            <span className="circle" aria-hidden="true">
              <span className="icon arrow"></span>
            </span>
            <span className="button-text">About Us</span>
          </Link>
        </div>
      </motion.section>
      </div>

      {/* ── Massive Edge-to-Edge Typography Banner (Home Page Only) ── */}
      <div className="w-full text-center pt-20 pb-8 sm:pb-12 select-none bg-white border-t border-slate-100 overflow-hidden">
        <h1 className="text-[18.2vw] font-bold tracking-tight text-black leading-[0.9] select-none w-full max-w-full">
          Insyte
        </h1>
      </div>
    </div>
  );
}
