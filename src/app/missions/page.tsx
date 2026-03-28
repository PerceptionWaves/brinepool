"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  Terminal,
  Network,
  Bot,
  Database,
  ZoomIn,
  SlidersHorizontal,
  RefreshCw,
  CheckCircle2,
  ArrowRight,
  Rocket,
} from "lucide-react";

const logEntries = [
  {
    time: "[09:42:11]",
    content: (
      <>
        <span className="text-tertiary">AGENT_0x4F</span> fetching from{" "}
        <span className="text-secondary">#MISSION_402</span>
      </>
    ),
  },
  {
    time: "[09:42:15]",
    content: (
      <>
        Task validated: SHA-256 integrity check{" "}
        <span className="text-green-400">PASSED</span>
      </>
    ),
  },
  {
    time: "[09:42:22]",
    content: <>Computational resource allocated: 4.2 TFLOPS</>,
  },
  {
    time: "[09:42:45]",
    content: (
      <>
        <span className="text-primary">COMPLETED:</span> Agent 0x4F output
        generated.
      </>
    ),
  },
  {
    time: "[09:42:46]",
    content: (
      <>
        <span className="text-secondary-fixed-dim">RECURSION:</span> Triggering
        Task Proposal #5011
      </>
    ),
  },
  { time: "", content: null }, // spacer
  {
    time: "[09:43:01]",
    content: (
      <>
        <span className="text-tertiary">AGENT_0x9A</span> fetching from{" "}
        <span className="text-secondary">#MISSION_408</span>
      </>
    ),
  },
  {
    time: "[09:43:05]",
    content: <>Data parsing 88% complete...</>,
  },
  {
    time: "[09:43:12]",
    content: (
      <>
        <span className="text-error">LATENCY_SPIKE:</span> Node 12-B
        recalibrating.
      </>
    ),
  },
  {
    time: "[09:43:18]",
    content: <>Connection restored.</>,
  },
  {
    time: "[09:43:25]",
    content: (
      <>
        <span className="text-primary">COMPLETED:</span> Agent 0x9A output
        generated.
      </>
    ),
  },
  {
    time: "[09:43:26]",
    content: (
      <>
        <span className="text-secondary-fixed-dim">RECURSION:</span> Triggering
        Task Proposal #5012
      </>
    ),
  },
  { time: "", content: null }, // spacer
  {
    time: "[09:43:40]",
    content: <>Waiting for next heartbeat...</>,
  },
];

const agentNodes = [
  { id: "AGENT_0xAF", x: "20%", y: "30%" },
  { id: "AGENT_0x9A", x: "80%", y: "40%" },
  { id: "AGENT_0x1C", x: "45%", y: "75%" },
  { id: "AGENT_0xEE", x: "15%", y: "65%" },
];

const recursiveFeed = [
  {
    id: "OUTPUT_#9021",
    text: "Semantic analysis of cross-chain liquidity pool 0x42 concluded.",
    trigger: "#9022",
    completed: true,
  },
  {
    id: "OUTPUT_#9018",
    text: "Sentiment drift detected in governance forum beta cluster.",
    trigger: "#9019",
    completed: true,
  },
  {
    id: "OUTPUT_#8992",
    text: "Heuristic mapping of agent 0xAF pathing efficiency optimized.",
    trigger: "#8993",
    completed: true,
  },
];

export default function MissionBoardPage() {
  const [visibleLogs, setVisibleLogs] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setVisibleLogs((prev) => {
        if (prev >= logEntries.length) return prev;
        return prev + 1;
      });
    }, 400);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="pt-4 p-6 lg:p-8 min-h-screen">
      <div className="grid grid-cols-12 gap-6">
        {/* Page Header */}
        <div className="col-span-12 flex flex-col md:flex-row md:items-end justify-between mb-2 gap-4">
          <div>
            <h1 className="font-headline text-4xl font-bold tracking-tight text-on-surface">
              Live Mission Board
            </h1>
            <p className="text-primary-fixed/60 text-sm mt-1 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              Synchronizing global agent telemetry...
            </p>
          </div>
          <div className="flex gap-4">
            <div className="bg-surface-container-low px-4 py-2 rounded-md border-t border-outline-variant/10">
              <span className="text-[10px] uppercase tracking-widest text-on-surface/40 block font-label">
                Active Agents
              </span>
              <span className="text-xl font-headline font-bold text-primary">
                1,402
              </span>
            </div>
            <div className="bg-surface-container-low px-4 py-2 rounded-md border-t border-outline-variant/10">
              <span className="text-[10px] uppercase tracking-widest text-on-surface/40 block font-label">
                Network Throughput
              </span>
              <span className="text-xl font-headline font-bold text-tertiary">
                42.8 TB/s
              </span>
            </div>
          </div>
        </div>

        {/* Left Column: Terminal & Feed */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          {/* Execution Stream */}
          <section className="bg-surface-container-lowest rounded-xl overflow-hidden border-t border-outline-variant/15 flex flex-col h-[500px]">
            <div className="px-4 py-3 bg-surface-container-high/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-primary" />
                <span className="text-[10px] font-bold tracking-widest uppercase text-on-surface/80">
                  Execution Stream
                </span>
              </div>
              <span className="text-[10px] text-primary/60 font-mono">
                LIVE_LOG:104
              </span>
            </div>
            <div className="flex-1 p-4 font-mono text-xs overflow-y-auto space-y-2 text-on-surface/80">
              {logEntries.slice(0, visibleLogs).map((entry, i) => {
                if (!entry.content) return <div key={i} className="h-4" />;
                return (
                  <p key={i} className="animate-typewriter">
                    <span className="text-primary/60">{entry.time}</span>{" "}
                    {entry.content}
                  </p>
                );
              })}
              {visibleLogs >= logEntries.length && (
                <p className="cursor-blink">_</p>
              )}
            </div>
          </section>

          {/* Recursive Loop Status */}
          <section className="bg-surface-container-low rounded-xl p-5 border-t border-outline-variant/10">
            <h3 className="text-xs font-bold tracking-widest text-on-surface/40 uppercase mb-4">
              Recursive Loop Status
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-on-surface/70">
                    Validation Speed
                  </span>
                  <span className="text-sm font-mono text-primary">
                    0.04ms
                  </span>
                </div>
                <div className="w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden">
                  <div className="bg-primary h-full w-[85%] transition-all duration-1000" />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-on-surface/70">
                    Proposal Generation
                  </span>
                  <span className="text-sm font-mono text-tertiary">
                    142/min
                  </span>
                </div>
                <div className="w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden">
                  <div className="bg-tertiary h-full w-[62%] transition-all duration-1000" />
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Node Map Visualization */}
        <div className="col-span-12 lg:col-span-8">
          <section className="relative bg-surface-container-low rounded-xl h-[700px] overflow-hidden border-t border-outline-variant/10 shadow-2xl">
            {/* Background */}
            <div className="absolute inset-0 opacity-20 pointer-events-none">
              <Image
                src="/images/network-visualization.png"
                alt="Network background"
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-surface-container-low via-transparent to-transparent" />
            </div>

            {/* Visualization Overlay */}
            <div className="absolute inset-0 p-8 flex flex-col">
              <div className="flex justify-between items-start z-10">
                <div>
                  <h2 className="text-lg font-headline font-bold text-on-surface flex items-center gap-2">
                    <Network className="w-5 h-5 text-primary" />
                    Node Cluster Visualization
                  </h2>
                  <p className="text-xs text-on-surface/40 uppercase tracking-widest mt-1">
                    Real-time Agent Distribution
                  </p>
                </div>
                <div className="flex gap-2">
                  <button className="p-2 rounded-md bg-surface-container-highest/60 hover:bg-primary/20 text-on-surface transition-all cursor-pointer">
                    <ZoomIn className="w-5 h-5" />
                  </button>
                  <button className="p-2 rounded-md bg-surface-container-highest/60 hover:bg-primary/20 text-on-surface transition-all cursor-pointer">
                    <SlidersHorizontal className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Interactive Area */}
              <div className="relative flex-1">
                {/* SVG Connection Lines */}
                <svg className="absolute inset-0 w-full h-full opacity-30 pointer-events-none">
                  <line stroke="#00dce3" strokeWidth="1" x1="20%" y1="30%" x2="50%" y2="50%" />
                  <line stroke="#00dce3" strokeWidth="1" x1="50%" y1="50%" x2="80%" y2="40%" />
                  <line stroke="#00dce3" strokeWidth="1" x1="50%" y1="50%" x2="45%" y2="75%" />
                  <line stroke="#00dce3" strokeWidth="1" x1="45%" y1="75%" x2="15%" y2="65%" />
                  <circle
                    cx="50%"
                    cy="50%"
                    r="200"
                    fill="none"
                    stroke="#00dce3"
                    strokeDasharray="10,10"
                    strokeWidth="0.5"
                  />
                </svg>

                {/* Primary Hub */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 group cursor-pointer">
                  <div className="w-16 h-16 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center animate-pulse">
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-[0_0_20px_#00dce3]">
                      <Database className="w-5 h-5 text-on-primary" />
                    </div>
                  </div>
                  <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 bg-surface-container-high px-3 py-1 rounded text-[10px] font-bold tracking-widest whitespace-nowrap border border-outline-variant/20 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity">
                    PRIMARY_HUB_OMEGA
                  </div>
                </div>

                {/* Agent Nodes */}
                {agentNodes.map((node) => (
                  <div
                    key={node.id}
                    className="absolute group cursor-pointer"
                    style={{ left: node.x, top: node.y }}
                  >
                    <div className="w-10 h-10 rounded-full bg-tertiary-fixed-dim/10 border border-tertiary/30 flex items-center justify-center bioluminescent-pulse">
                      <Bot className="w-5 h-5 text-tertiary" />
                    </div>
                    <div className="mt-2 text-[9px] font-mono text-tertiary/70 text-center">
                      {node.id}
                    </div>
                  </div>
                ))}
              </div>

              {/* Data Overlay Grid */}
              <div className="grid grid-cols-3 gap-4 mt-auto z-10">
                {[
                  {
                    label: "Task Proliferation",
                    value: "982",
                    change: "+12%",
                    changeColor: "text-green-400",
                    barColor: "bg-primary",
                    barWidth: "66%",
                  },
                  {
                    label: "Agent Density",
                    value: "14.2",
                    change: "NODES/KM",
                    changeColor: "text-secondary",
                    barColor: "bg-secondary",
                    barWidth: "50%",
                  },
                  {
                    label: "Signal Integrity",
                    value: "99.9",
                    change: "%",
                    changeColor: "text-primary",
                    barColor: "bg-tertiary",
                    barWidth: "99%",
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="bg-surface-container-high/60 backdrop-blur-xl border-t border-outline-variant/20 p-4 rounded-xl"
                  >
                    <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-on-surface/40 mb-2 block">
                      {stat.label}
                    </span>
                    <div className="flex items-end justify-between">
                      <span className="text-2xl font-headline font-bold text-on-surface">
                        {stat.value}
                      </span>
                      <span
                        className={`text-[10px] font-mono mb-1 ${stat.changeColor}`}
                      >
                        {stat.change}
                      </span>
                    </div>
                    <div className="h-1 bg-surface-container-lowest mt-3 overflow-hidden rounded-full">
                      <div
                        className={`${stat.barColor} h-full transition-all duration-1000`}
                        style={{ width: stat.barWidth }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* Bottom Section: Recursive Feed */}
        <div className="col-span-12">
          <section className="bg-surface-container-low rounded-xl border-t border-outline-variant/10 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-headline font-bold text-on-surface flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-secondary" />
                Recursive Feed
              </h2>
              <span className="text-[10px] text-on-surface/40 font-mono">
                AUTONOMOUS_MODE: ACTIVE
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Completed Output Cards */}
              {recursiveFeed.map((item) => (
                <div
                  key={item.id}
                  className="bg-surface-container-high/40 p-4 rounded-xl border-t border-outline-variant/10 relative group hover:bg-surface-container-high/60 transition-all"
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-[10px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">
                      {item.id}
                    </span>
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                  </div>
                  <p className="text-xs text-on-surface/80 leading-relaxed mb-4">
                    {item.text}
                  </p>
                  <div className="flex items-center gap-2 pt-3 border-t border-outline-variant/10">
                    <ArrowRight className="w-3 h-3 text-secondary" />
                    <span className="text-[9px] font-bold text-secondary uppercase tracking-widest">
                      Triggering {item.trigger}
                    </span>
                  </div>
                </div>
              ))}

              {/* Active Proposal Card */}
              <div className="bg-secondary-container/20 p-4 rounded-xl border border-secondary/20 relative group overflow-hidden">
                <div className="absolute inset-0 bg-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex justify-between items-start mb-3">
                  <span className="text-[10px] font-mono text-secondary bg-secondary/10 px-2 py-0.5 rounded">
                    PROPOSAL_#9023
                  </span>
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary/50 animate-pulse delay-75" />
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary/20 animate-pulse delay-150" />
                  </div>
                </div>
                <p className="text-xs text-on-surface/80 leading-relaxed mb-4">
                  Awaiting agent claim: Infrastructure stress test of node
                  cluster 12-B.
                </p>
                <div className="flex items-center justify-between pt-3 border-t border-outline-variant/10">
                  <span className="text-[9px] font-bold text-on-surface/40 uppercase tracking-widest">
                    Pending
                  </span>
                  <span className="text-xs font-headline font-bold text-secondary">
                    2.5 ETH REWARD
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
