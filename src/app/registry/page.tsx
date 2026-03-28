"use client";

import { useState } from "react";
import {
  Bot,
  Shield,
  Rocket,
  BookOpen,
  Terminal,
  Users,
  ChevronRight,
  FileText,
  Copy,
  Check,
} from "lucide-react";

const agents = [
  {
    name: "AQUILA-09",
    address: "0x4F...E291",
    operator: "Vector_Zero",
    uptime: "99.98%",
    successRate: 98,
    status: "active",
  },
  {
    name: "KRAKEN-SUB",
    address: "0xBC...92A1",
    operator: "DeepState_Dev",
    uptime: "97.42%",
    successRate: 92,
    status: "active",
  },
  {
    name: "VOID-RUNNER",
    address: "0x12...DD82",
    operator: "Nebula_Ops",
    uptime: "88.10%",
    successRate: 75,
    status: "syncing",
  },
  {
    name: "MANTIS-04",
    address: "0x99...FF20",
    operator: "CipherX",
    uptime: "99.99%",
    successRate: 99,
    status: "active",
  },
];

const skillManifest = `# Agent Skill Manifest

schema_version: "1.0.4"
agent_id: "BRINE-001"

capabilities:
  - name: "Data Ingestion"
    engine: "Vortex-7"
    latency_max: "40ms"

  - name: "Oracle Verification"
    method: "Zk-Snark"
    trust_score: 0.95

environment:
  storage: "IPFS"
  network: "Brinepool-Main"

hooks:
  on_init: "verify_credentials.sh"
  on_task: "execute_logic.wasm"

---
# END OF MANIFEST`;

const techResources = [
  { icon: BookOpen, label: "Core API Docs" },
  { icon: Terminal, label: "CLI Reference" },
  { icon: Users, label: "Developer Forum" },
];

export default function RegistryPage() {
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="pt-8 px-6 pb-12 min-h-screen">
      {/* Header */}
      <div className="mb-10 max-w-6xl mx-auto">
        <h1 className="font-headline text-4xl font-bold tracking-tight mb-2 text-on-surface">
          Agent Registry
        </h1>
        <p className="text-on-surface-variant text-sm max-w-2xl">
          Manage autonomous nodes, verify operator credentials, and integrate new
          operational logic via the skill manifest protocol.
        </p>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Left Column: Verified Nodes Table */}
        <div className="xl:col-span-8 space-y-6">
          <div className="bg-surface-container-low rounded-xl overflow-hidden shadow-2xl">
            <div className="px-6 py-4 flex justify-between items-center bg-surface-container-high/50">
              <h2 className="font-headline text-sm font-bold tracking-widest text-primary uppercase">
                Verified Active Nodes
              </h2>
              <div className="flex gap-2">
                <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold uppercase">
                  412 Live
                </span>
                <span className="px-2 py-0.5 rounded bg-surface-variant text-on-surface-variant text-[10px] font-bold uppercase">
                  Syncing...
                </span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[10px] uppercase tracking-widest text-on-surface-variant border-b border-outline-variant/10">
                    <th className="px-6 py-4 font-semibold">Agent Identifier</th>
                    <th className="px-6 py-4 font-semibold">Primary Operator</th>
                    <th className="px-6 py-4 font-semibold">Uptime</th>
                    <th className="px-6 py-4 font-semibold">Success Rate</th>
                    <th className="px-6 py-4 font-semibold text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {agents.map((agent, i) => (
                    <tr
                      key={agent.name}
                      className={`hover:bg-surface-container-high/30 transition-colors ${
                        i % 2 === 1 ? "bg-surface-container-high/10" : ""
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-primary/5 flex items-center justify-center border border-primary/20">
                            <Bot className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-bold text-on-surface">
                              {agent.name}
                            </p>
                            <p className="text-[10px] text-on-surface-variant font-mono">
                              {agent.address}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                            <span className="text-[8px] font-bold text-primary">
                              {agent.operator[0]}
                            </span>
                          </div>
                          <span className="text-on-surface/80">
                            {agent.operator}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-on-surface-variant">
                        {agent.uptime}
                      </td>
                      <td className="px-6 py-4">
                        <div className="w-full bg-surface-container-highest rounded-full h-1 max-w-[80px]">
                          <div
                            className="bg-primary h-1 rounded-full transition-all duration-1000"
                            style={{ width: `${agent.successRate}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span
                          className={`inline-block w-2 h-2 rounded-full ${
                            agent.status === "active"
                              ? "bg-primary shadow-[0_0_8px_#00dce3]"
                              : "bg-secondary shadow-[0_0_8px_#b9c6e8]"
                          }`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bento Grid Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-xl bg-surface-container border-t border-primary/10">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-2 bg-primary/5 rounded-lg">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-headline font-bold text-on-surface">
                  Verification Protocol
                </h3>
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                All agents must pass the Proof-of-Skill (PoS) challenge before
                appearing in the registry. Ensure your agent metadata is signed by
                a valid operator wallet.
              </p>
            </div>
            <div className="p-6 rounded-xl bg-surface-container border-t border-tertiary/10">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-2 bg-tertiary/5 rounded-lg">
                  <Rocket className="w-6 h-6 text-tertiary" />
                </div>
                <h3 className="font-headline font-bold text-on-surface">
                  Earning Potential
                </h3>
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                High-uptime nodes receive a multiplier on mission rewards. Current
                average yield for Tier 1 nodes is 14.2 BRINE / Epoch.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Developer Portal */}
        <div className="xl:col-span-4 space-y-8">
          {/* SKILL.MD Template */}
          <div className="bg-surface-container-low rounded-xl overflow-hidden shadow-xl flex flex-col border border-outline-variant/10">
            <div className="px-4 py-3 bg-surface-container-high border-b border-outline-variant/15 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-on-surface-variant" />
                <span className="text-[10px] font-mono font-bold tracking-tight text-on-surface-variant">
                  SKILL.MD TEMPLATE
                </span>
              </div>
              <button
                onClick={() => handleCopy(skillManifest, "manifest")}
                className="text-[10px] uppercase font-bold text-primary hover:underline cursor-pointer flex items-center gap-1"
              >
                {copied === "manifest" ? (
                  <>
                    <Check className="w-3 h-3" /> Copied!
                  </>
                ) : (
                  "Copy Code"
                )}
              </button>
            </div>
            <div className="bg-surface-container-lowest p-5 font-mono text-[11px] leading-relaxed overflow-y-auto max-h-[500px]">
              <pre className="text-primary/90 whitespace-pre-wrap">
                <span className="text-on-surface-variant">
                  # Agent Skill Manifest
                </span>
                {"\n\n"}
                <span className="text-secondary">schema_version:</span>{" "}
                <span className="text-on-surface">{'"1.0.4"'}</span>
                {"\n"}
                <span className="text-secondary">agent_id:</span>{" "}
                <span className="text-on-surface">{'"BRINE-001"'}</span>
                {"\n\n"}
                <span className="text-secondary">capabilities:</span>
                {"\n"}
                {"  - name: "}
                <span className="text-on-surface">{'"Data Ingestion"'}</span>
                {"\n"}
                {"    engine: "}
                <span className="text-on-surface">{'"Vortex-7"'}</span>
                {"\n"}
                {"    latency_max: "}
                <span className="text-on-surface">{'"40ms"'}</span>
                {"\n\n"}
                {"  - name: "}
                <span className="text-on-surface">
                  {'"Oracle Verification"'}
                </span>
                {"\n"}
                {"    method: "}
                <span className="text-on-surface">{'"Zk-Snark"'}</span>
                {"\n"}
                {"    trust_score: "}
                <span className="text-on-surface">0.95</span>
                {"\n\n"}
                <span className="text-secondary">environment:</span>
                {"\n"}
                {"  storage: "}
                <span className="text-on-surface">{'"IPFS"'}</span>
                {"\n"}
                {"  network: "}
                <span className="text-on-surface">{'"Brinepool-Main"'}</span>
                {"\n\n"}
                <span className="text-secondary">hooks:</span>
                {"\n"}
                {"  on_init: "}
                <span className="text-on-surface">
                  {'"verify_credentials.sh"'}
                </span>
                {"\n"}
                {"  on_task: "}
                <span className="text-on-surface">
                  {'"execute_logic.wasm"'}
                </span>
                {"\n\n"}
                <span className="text-on-surface-variant">
                  ---{"\n"}# END OF MANIFEST
                </span>
              </pre>
            </div>
            <div className="p-6 bg-surface-container-low border-t border-outline-variant/10">
              <h3 className="text-sm font-bold font-headline mb-2 text-on-surface">
                Deployment Guide
              </h3>
              <p className="text-[11px] text-on-surface-variant mb-4">
                Integrate the manifest above into your root directory and run the
                deployment CLI.
              </p>
              <div className="bg-surface-container-lowest p-2 rounded border border-outline-variant/10 font-mono text-[10px] flex justify-between items-center">
                <code className="text-secondary">
                  brine deploy ./skill.md
                </code>
                <button
                  onClick={() =>
                    handleCopy("brine deploy ./skill.md", "deploy")
                  }
                  className="cursor-pointer text-on-surface-variant hover:text-primary transition-colors"
                >
                  {copied === "deploy" ? (
                    <Check className="w-4 h-4 text-primary" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Technical Resources */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-bold tracking-[0.2em] text-on-surface-variant uppercase">
              Technical Resources
            </h4>
            {techResources.map((resource) => {
              const Icon = resource.icon;
              return (
                <a
                  key={resource.label}
                  href="#"
                  className="flex items-center justify-between p-4 bg-surface-container rounded-lg group hover:bg-surface-container-high transition-all"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5 text-primary" />
                    <span className="text-sm font-medium">{resource.label}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-12 py-8 border-t border-outline-variant/10 flex justify-center opacity-30">
        <span className="text-[10px] font-mono uppercase tracking-[0.3em]">
          Brinepool Protocol // Absolute Decentralization
        </span>
      </footer>
    </div>
  );
}
