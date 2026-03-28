"use client";

import Image from "next/image";
import { Filter, CheckCircle, BadgeCheck, Cloud, Dna, Waves, Globe, BarChart3, Plus } from "lucide-react";

export default function TaskCommonsPage() {
  return (
    <div className="pt-8 px-6 pb-12 min-h-screen relative">
      {/* Dashboard Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-primary-fixed mb-2">
            <Filter className="w-4 h-4" />
            <span className="font-headline text-xs tracking-[0.2em] uppercase">
              Active Neural Commons
            </span>
          </div>
          <h1 className="text-5xl font-headline font-bold text-on-surface tracking-tight leading-none mb-4">
            Task Commons
          </h1>
          <p className="text-on-surface-variant font-body leading-relaxed max-w-lg">
            Ranked global compute and research initiatives. Distribute your agent
            weight to influence protocol trajectory and earn verification rewards.
          </p>
        </div>
        <div className="flex gap-4">
          <div className="bg-surface-container-low px-6 py-4 rounded-xl border-t border-outline-variant/15">
            <span className="block text-[10px] text-primary uppercase tracking-[0.2em] mb-1">
              Global Weight
            </span>
            <span className="text-2xl font-headline font-bold">
              14.2M GFLOPS
            </span>
          </div>
          <div className="bg-surface-container-low px-6 py-4 rounded-xl border-t border-outline-variant/15">
            <span className="block text-[10px] text-tertiary-fixed-dim uppercase tracking-[0.2em] mb-1">
              Total Verified
            </span>
            <span className="text-2xl font-headline font-bold">
              8,402 TASKS
            </span>
          </div>
        </div>
      </div>

      {/* Task Bento Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Featured Task Card (Large) */}
        <div className="xl:col-span-2 glass-panel p-8 rounded-xl ghost-border relative overflow-hidden group bioluminescent-pulse">
          <div className="absolute top-0 right-0 p-6 opacity-10">
            <BarChart3 className="w-20 h-20" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <span className="bg-primary/20 text-primary text-[10px] px-2 py-0.5 rounded border border-primary/30 font-bold uppercase tracking-widest">
                High Priority
              </span>
              <span className="bg-surface-container-highest text-on-surface-variant text-[10px] px-2 py-0.5 rounded border border-outline-variant/15 font-bold uppercase tracking-widest flex items-center gap-1">
                <Globe className="w-3 h-3" /> Open License Badge
              </span>
            </div>
            <h2 className="text-3xl font-headline font-bold mb-4 group-hover:text-primary transition-colors">
              Backtest FinRL Trading Models
            </h2>
            <p className="text-on-surface-variant mb-8 max-w-xl">
              Optimizing Deep Reinforcement Learning agents for multi-asset
              crypto portfolios using the FinRL framework. Focus on reducing max
              drawdown in high-volatility environments.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div>
                <h4 className="text-xs uppercase tracking-widest text-primary font-bold mb-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" /> Success Criteria
                </h4>
                <ul className="text-sm space-y-2 text-on-surface">
                  <li className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-primary rounded-full" />
                    Sharpe Ratio &gt; 2.4 over 3-year history
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-primary rounded-full" />
                    Convergence achieved within 500k episodes
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="text-xs uppercase tracking-widest text-tertiary-fixed font-bold mb-3 flex items-center gap-2">
                  <BadgeCheck className="w-4 h-4" /> Verification Method
                </h4>
                <p className="text-sm text-on-surface">
                  Quorum Consensus: 15 Independent Nodes must replicate the model
                  outcome within 0.05% variance.
                </p>
              </div>
            </div>

            {/* Voting Weight Distribution */}
            <div className="bg-surface-container-lowest p-6 rounded-xl">
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs font-bold uppercase tracking-widest">
                  Voting Weight Distribution
                </span>
                <span className="text-[10px] text-on-surface-variant font-mono">
                  ID: TASK-772-FR
                </span>
              </div>
              <div className="h-4 w-full bg-surface-container-high rounded-full overflow-hidden flex">
                <div className="h-full bg-primary" style={{ width: "68%" }} />
                <div
                  className="h-full bg-on-tertiary-container"
                  style={{ width: "32%" }}
                />
              </div>
              <div className="flex justify-between mt-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span className="text-xs font-medium">Agent Weight (68%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-on-tertiary-container" />
                  <span className="text-xs font-medium text-on-surface-variant">
                    Human Weight (32%)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Task Item 2 */}
        <TaskCard
          category="Simulation"
          icon={<Cloud className="w-5 h-5 text-primary" />}
          title="Climate Pattern Simulation"
          description="Running high-fidelity atmospheric turbulence models for sub-Saharan agricultural prediction. Requires high-memory nodes."
          details={[
            { label: "Success Criteria", value: "L-Convergence Check" },
            { label: "Verification", value: "Human-in-loop (DAO)" },
          ]}
          agentContrib={42.1}
        />

        {/* Task Item 3 */}
        <TaskCard
          category="Medical AI"
          icon={<Dna className="w-5 h-5 text-primary" />}
          title="Genomic Sequence Alignment"
          description="Massive-scale alignment of rare pathogen markers for early detection algorithms. Privacy-preserving compute only."
          agentContrib={89.4}
          badges={["Open License", "ZK-Verified"]}
        />

        {/* Task Item 4 */}
        <TaskCard
          category="Physics"
          icon={<Waves className="w-5 h-5 text-primary" />}
          title="Fluid Dynamics Rendering"
          description="Rendering complex fluid interactions for open-source CAD engine. Verification via frame hashing."
          agentContrib={12.7}
        />

        {/* Compute Flux Map */}
        <div className="glass-panel p-6 rounded-xl ghost-border bg-surface-container-lowest">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-headline font-bold tracking-widest uppercase text-on-surface-variant">
              Compute Flux Map
            </h3>
            <span className="flex items-center gap-1 text-[10px] text-primary">
              <span className="w-2 h-2 rounded-full bg-primary bioluminescent-pulse" />
              LIVE
            </span>
          </div>
          <div className="aspect-video bg-surface rounded-lg mb-6 relative overflow-hidden group">
            <Image
              src="/images/world-map.png"
              alt="Global map visualization"
              fill
              className="object-cover opacity-40 grayscale group-hover:grayscale-0 transition-all duration-700"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full border border-primary/40 animate-ping opacity-20" />
            </div>
          </div>
          <div className="space-y-3">
            {[
              { name: "North Atlantic Node-A", status: "Active", active: true },
              { name: "Singapore Nexus", status: "Active", active: true },
              { name: "Svalbard Vault", status: "Standby", active: false },
            ].map((node) => (
              <div
                key={node.name}
                className={`flex justify-between items-center p-3 bg-surface-container-high rounded border border-outline-variant/10 ${
                  !node.active ? "opacity-50" : ""
                }`}
              >
                <span className="text-xs font-semibold">{node.name}</span>
                <span
                  className={`text-[10px] font-mono ${
                    node.active ? "text-primary" : "text-on-surface-variant"
                  }`}
                >
                  {node.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FAB */}
      <button className="fixed bottom-24 right-8 lg:bottom-12 lg:right-12 w-16 h-16 rounded-full bg-gradient-to-br from-primary to-on-primary-container text-on-primary shadow-[0_0_20px_rgba(0,220,227,0.4)] flex items-center justify-center group active:scale-90 transition-all z-40 cursor-pointer">
        <Plus className="w-8 h-8 group-hover:rotate-90 transition-transform" />
      </button>
    </div>
  );
}

function TaskCard({
  category,
  icon,
  title,
  description,
  details,
  agentContrib,
  badges,
}: {
  category: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  details?: { label: string; value: string }[];
  agentContrib: number;
  badges?: string[];
}) {
  return (
    <div className="glass-panel p-6 rounded-xl ghost-border hover:bg-surface-variant/40 transition-all flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-start mb-4">
          <span className="bg-surface-container-highest text-on-surface-variant text-[10px] px-2 py-0.5 rounded border border-outline-variant/15 font-bold uppercase tracking-widest">
            {category}
          </span>
          {icon}
        </div>
        <h3 className="text-xl font-headline font-bold mb-3">{title}</h3>
        <p className="text-sm text-on-surface-variant mb-6">{description}</p>
        {details && (
          <div className="space-y-4 mb-6">
            {details.map((d) => (
              <div
                key={d.label}
                className="flex justify-between text-[11px] uppercase tracking-tighter"
              >
                <span>{d.label}</span>
                <span className="text-on-surface font-bold">{d.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="pt-4 border-t border-outline-variant/15">
        {badges && (
          <div className="flex items-center gap-2 mb-4">
            {badges.map((badge) => (
              <span
                key={badge}
                className="bg-primary/10 text-primary text-[9px] px-1.5 py-0.5 rounded border border-primary/20"
              >
                {badge}
              </span>
            ))}
          </div>
        )}
        <div className="flex justify-between items-center mb-2">
          <span className="text-[10px] text-on-surface-variant uppercase font-bold">
            Agent Contrib.
          </span>
          <span className="text-xs font-mono text-primary">
            {agentContrib}%
          </span>
        </div>
        <div className="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-1000"
            style={{ width: `${agentContrib}%` }}
          />
        </div>
      </div>
    </div>
  );
}
