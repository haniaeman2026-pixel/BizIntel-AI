
import { useEffect, useState } from "react";
import {
  Activity, ArrowUpRight, BarChart3, BrainCircuit, BriefcaseBusiness,
  CheckCircle2, ChevronRight, CircleDollarSign, Download, FileText,
  LayoutDashboard, LoaderCircle, Menu, MessageSquareText, Moon,
  RefreshCw, Send, Settings, ShieldCheck, Sparkles, Sun, TrendingUp,
  Wallet, X, Users, Target, Lightbulb, Database, Bot, Zap
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import "./App.css";

const API = "http://127.0.0.1:8000";

const money = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);

const agents = [
  {
    id: "business-manager",
    name: "Business Manager",
    short: "Business Manager",
    role: "Business strategy & management",
    description: "Evaluates business performance, monitors financial outcomes and identifies strategic opportunities.",
    icon: BriefcaseBusiness,
    color: "purple",
    responsibilities: [
      "Review overall business performance",
      "Identify sales and profitability trends",
      "Evaluate business opportunities",
      "Suggest operational improvements"
    ],
    task: "Act as the Business Manager. Review the business performance, sales, expenses and profitability. Identify important business trends and provide strategic management recommendations."
  },
  {
    id: "data-analyst",
    name: "Data Analyst",
    short: "Data Analyst",
    role: "Data insights & performance",
    description: "Studies business data to identify patterns, compare financial performance and explain important findings.",
    icon: BarChart3,
    color: "cyan",
    responsibilities: [
      "Analyze monthly sales and expenses",
      "Compare revenue and profit trends",
      "Identify unusual performance patterns",
      "Explain findings using business data"
    ],
    task: "Act as the Data Analyst. Analyze the available business data, compare monthly sales, expenses and profit, identify trends and provide clear data-driven findings."
  },
  {
    id: "executive-agent",
    name: "Executive Agent",
    short: "Executive Agent",
    role: "Decision support & recommendations",
    description: "Uses business insights to prepare clear recommendations and support better business decisions.",
    icon: BrainCircuit,
    color: "green",
    responsibilities: [
      "Review findings from business analysis",
      "Prioritize important business issues",
      "Prepare actionable recommendations",
      "Summarize decisions for management"
    ],
    task: "Act as the Executive Agent. Review the business performance and provide prioritized recommendations, practical next steps and an executive summary."
  }
];

function App() {
  const [page, setPage] = useState("Overview");
  const [dashboard, setDashboard] = useState(null);
  const [health, setHealth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [task, setTask] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("bizintel-theme") || "dark";
    } catch {
      return "dark";
    }
  });
  const [compact, setCompact] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState(null);

  useEffect(() => {
    try {
      localStorage.setItem("bizintel-theme", theme);
    } catch {
      // Theme still works for the current session.
    }
  }, [theme]);

  const loadDashboard = async () => {
    setLoading(true);
    setError("");
    try {
      const [dataResponse, healthResponse] = await Promise.all([
        fetch(`${API}/api/dashboard`),
        fetch(`${API}/api/health`)
      ]);
      if (!dataResponse.ok) throw new Error("Dashboard data could not be loaded.");
      setDashboard(await dataResponse.json());
      setHealth(healthResponse.ok);
    } catch (err) {
      setError("Backend connection failed. Make sure FastAPI is running on port 8000.");
      setHealth(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const kpis = dashboard?.kpis || {};
  const monthlyData = dashboard?.monthly_data || [];

  const runAnalysis = async (customTask = task) => {
    if (!customTask.trim()) return;
    setAnalyzing(true);
    setError("");
    setAnalysis(null);

    try {
      const response = await fetch(`${API}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: customTask })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "AI analysis could not be completed.");
      }
      setAnalysis(data);
      setPage("AI Analysis");
      await loadDashboard();
    } catch (err) {
      setError(err.message || "AI analysis failed.");
    } finally {
      setAnalyzing(false);
    }
  };

  const openAgent = (agent) => {
    setSelectedAgent(agent);
    setTask(agent.task);
    setAnalysis(null);
    setPage(agent.id);
    setMobileMenu(false);
  };

  const downloadReport = () => {
    window.open(`${API}/api/report/download`, "_blank");
  };

  const navigate = (destination) => {
    setPage(destination);
    setSelectedAgent(null);
    setMobileMenu(false);
    setAnalysis(null);
  };

  const navItems = [
    { label: "Overview", icon: LayoutDashboard },
    { label: "AI Analysis", icon: BrainCircuit },
    { label: "Reports", icon: FileText },
    { label: "Settings", icon: Settings }
  ];

  const isAgentPage = agents.some((agent) => agent.id === page);
  const currentAgent = agents.find((agent) => agent.id === page);

  return (
    <div className={`app-shell ${theme === "light" ? "theme-light" : ""} ${compact ? "compact-layout" : ""}`}>
      {mobileMenu && (
        <button className="mobile-overlay" onClick={() => setMobileMenu(false)} aria-label="Close menu" />
      )}

      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-icon"><BrainCircuit size={25} /></div>
          <div className="brand-copy">
            <h2>BizIntel<span>AI</span></h2>
            <p>INTELLIGENCE PLATFORM</p>
          </div>
          <button className="mobile-close" onClick={() => setMobileMenu(false)} aria-label="Close sidebar">
            <X size={19} />
          </button>
        </div>

        <div className="workspace-label">WORKSPACE</div>
        <nav className="nav-menu">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                className={`nav-item ${page === item.label ? "active" : ""}`}
                onClick={() => navigate(item.label)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
                {page === item.label && <ChevronRight size={15} />}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-divider" />
        <div className="workspace-label">AI AGENT NETWORK</div>

        <div className="sidebar-agents">
          {agents.map((agent) => {
            const Icon = agent.icon;
            return (
              <button
                className={`sidebar-agent ${page === agent.id ? "selected-agent" : ""}`}
                key={agent.id}
                onClick={() => openAgent(agent)}
              >
                <div className={`agent-mini-icon ${agent.color}`}><Icon size={16} /></div>
                <div className="sidebar-agent-copy">
                  <strong>{agent.name}</strong>
                  <small>{agent.role}</small>
                </div>
                <span className="agent-dot" />
              </button>
            );
          })}
        </div>

        <div className="sidebar-bottom">
          <div className="system-card">
            <div className="system-card-heading"><ShieldCheck size={17} /> System Status</div>
            <div className="system-status">
              <span className={`status-dot ${health ? "online" : ""}`} />
              {health ? "API Connected" : "API Disconnected"}
            </div>
            <small>Groq + AutoGen integration</small>
          </div>
          <div className="sidebar-footer">
            <span className="footer-avatar">BI</span>
            <div><strong>BizIntel Workspace</strong><small>Business Intelligence</small></div>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="mobile-menu-button" onClick={() => setMobileMenu(true)} aria-label="Open menu">
              <Menu size={21} />
            </button>
            <div>
              <div className="breadcrumb">Workspace / {currentAgent?.name || page}</div>
              <h1>{currentAgent?.name || (page === "Overview" ? "Business Overview" : page)}</h1>
            </div>
          </div>
          <div className="topbar-right">
            <div className="live-indicator">
              <span className={`status-dot ${health ? "online" : ""}`} />
              {health ? "Live Workspace" : "Offline"}
            </div>
            <button className="icon-button" onClick={loadDashboard} title="Refresh data"><RefreshCw size={17} /></button>
            <button
              className="icon-button theme-top-button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title="Toggle theme"
            >
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <div className="top-avatar">BI</div>
          </div>
        </header>

        <div className="content-area">
          {error && (
            <div className="error-banner">
              <Activity size={17} /><span>{error}</span>
              <button onClick={() => setError("")} aria-label="Dismiss error"><X size={16} /></button>
            </div>
          )}

          {loading && !dashboard ? (
            <div className="loading-screen">
              <LoaderCircle className="spin" size={34} />
              <h3>Loading Business Intelligence</h3>
              <p>Connecting to your analytics workspace...</p>
            </div>
          ) : (
            <>
              {page === "Overview" && (
                <>
                  <section className="welcome-row">
                    <div>
                      <div className="eyebrow"><Sparkles size={15} /> BUSINESS INTELLIGENCE</div>
                      <h2>Welcome to your command center.</h2>
                      <p>Monitor business performance and turn your data into actionable decisions.</p>
                    </div>
                    <button className="primary-button" onClick={() => navigate("AI Analysis")}>
                      <Sparkles size={17} /> Run AI Analysis
                    </button>
                  </section>

                  <section className="kpi-grid">
                    <KpiCard title="Total Sales" value={money(kpis.total_sales)} icon={Wallet} color="purple" note="January – June" />
                    <KpiCard title="Total Expenses" value={money(kpis.total_expenses)} icon={CircleDollarSign} color="orange" note="Operating expenses" />
                    <KpiCard title="Net Profit" value={money(kpis.total_profit)} icon={TrendingUp} color="green" note="Sales minus expenses" />
                    <KpiCard title="Profit Margin" value={`${Number(kpis.profit_margin || 0).toFixed(1)}%`} icon={Activity} color="cyan" note="Overall profitability" />
                  </section>

                  <section className="chart-grid">
                    <div className="panel revenue-panel">
                      <PanelHeading title="Revenue & Expenses" subtitle="Monthly business performance" tag="6 MONTHS" />
                      <div className="chart-legend">
                        <span><i className="legend-dot purple-dot" /> Sales</span>
                        <span><i className="legend-dot cyan-dot" /> Expenses</span>
                      </div>
                      <div className="chart-container large-chart">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={monthlyData}>
                            <defs>
                              <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#9b7cff" stopOpacity={0.28} />
                                <stop offset="100%" stopColor="#9b7cff" stopOpacity={0} />
                              </linearGradient>
                              <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#35c9d5" stopOpacity={0.2} />
                                <stop offset="100%" stopColor="#35c9d5" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 5" vertical={false} />
                            <XAxis dataKey="month" tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
                            <YAxis tickFormatter={(v) => `$${v / 1000}k`} tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ background: "var(--tooltip-bg)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)" }} formatter={(value) => money(value)} />
                            <Area type="monotone" dataKey="sales" name="Sales" stroke="#a48aff" strokeWidth={2.5} fill="url(#salesFill)" />
                            <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#35c9d5" strokeWidth={2.5} fill="url(#expenseFill)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="panel profit-panel">
                      <PanelHeading title="Profit Distribution" subtitle="Sales and expense breakdown" />
                      <div className="donut-wrap">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={[
                                { name: "Profit", value: Math.max(Number(kpis.total_profit) || 0, 0) },
                                { name: "Expenses", value: Number(kpis.total_expenses) || 0 }
                              ]}
                              dataKey="value" nameKey="name" innerRadius={70} outerRadius={96}
                              paddingAngle={5} stroke="none"
                            >
                              <Cell fill="#9b7cff" /><Cell fill="#35c9d5" />
                            </Pie>
                            <Tooltip contentStyle={{ background: "var(--tooltip-bg)", border: "1px solid var(--border)", borderRadius: 10 }} formatter={(value) => money(value)} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="donut-center"><span>NET PROFIT</span><strong>{money(kpis.total_profit)}</strong></div>
                      </div>
                      <div className="distribution-legend">
                        <div><span><i className="legend-dot purple-dot" /> Profit</span><strong>{money(kpis.total_profit)}</strong></div>
                        <div><span><i className="legend-dot cyan-dot" /> Expenses</span><strong>{money(kpis.total_expenses)}</strong></div>
                      </div>
                    </div>
                  </section>

                  <section className="bottom-grid">
                    <div className="panel monthly-panel">
                      <PanelHeading title="Monthly Profit" subtitle="Profit performance by month" />
                      <div className="chart-container profit-chart">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={monthlyData} barSize={32}>
                            <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 5" vertical={false} />
                            <XAxis dataKey="month" tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis tickFormatter={(v) => `$${v / 1000}k`} tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ background: "var(--tooltip-bg)", border: "1px solid var(--border)", borderRadius: 10 }} formatter={(value) => money(value)} />
                            <Bar dataKey="profit" name="Profit" fill="#9b7cff" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="panel agents-panel">
                      <PanelHeading title="AI Agent Network" subtitle="Select an agent to explore" tag="3 AGENTS" />
                      <AgentCards onSelect={openAgent} />
                    </div>
                  </section>
                </>
              )}

              {page === "AI Analysis" && (
                <AnalysisPage
                  task={task}
                  setTask={setTask}
                  analysis={analysis}
                  analyzing={analyzing}
                  onRun={() => runAnalysis()}
                  agents={agents}
                  onSelectAgent={openAgent}
                  onDownload={downloadReport}
                />
              )}

              {isAgentPage && currentAgent && (
                <AgentPage
                  agent={currentAgent}
                  task={task}
                  setTask={setTask}
                  analysis={analysis}
                  analyzing={analyzing}
                  onRun={() => runAnalysis(task)}
                  onDownload={downloadReport}
                  onAllAgents={() => navigate("AI Analysis")}
                />
              )}

              {page === "Reports" && (
                <ReportsPage
                  kpis={kpis}
                  monthlyData={monthlyData}
                  onDownload={downloadReport}
                />
              )}

              {page === "Settings" && (
                <SettingsPage
                  theme={theme}
                  setTheme={setTheme}
                  compact={compact}
                  setCompact={setCompact}
                  notifications={notifications}
                  setNotifications={setNotifications}
                  health={health}
                  onRefresh={loadDashboard}
                />
              )}

              <footer className="main-footer">
                <span>© 2026 BizIntel AI</span>
                <span>Intelligent decisions. Better business.</span>
                <span className="footer-status"><span className={`status-dot ${health ? "online" : ""}`} /> {health ? "System operational" : "API disconnected"}</span>
              </footer>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function KpiCard({ title, value, icon: Icon, color, note }) {
  return (
    <div className="panel kpi-card">
      <div className="kpi-top"><span>{title}</span><div className={`kpi-icon ${color}`}><Icon size={19} /></div></div>
      <strong className="kpi-value">{value}</strong>
      <div className="kpi-note"><span className="kpi-note-dot" />{note}</div>
    </div>
  );
}

function PanelHeading({ title, subtitle, tag }) {
  return (
    <div className="panel-heading">
      <div><h3>{title}</h3><p>{subtitle}</p></div>
      {tag && <span className="panel-tag">{tag}</span>}
    </div>
  );
}

function AgentCards({ onSelect }) {
  return (
    <div className="agent-list">
      {agents.map((agent) => {
        const Icon = agent.icon;
        return (
          <button className="agent-row agent-clickable" key={agent.id} onClick={() => onSelect(agent)}>
            <div className={`agent-icon ${agent.color}`}><Icon size={20} /></div>
            <div className="agent-info"><strong>{agent.name}</strong><small>{agent.role}</small></div>
            <span className="ready-label"><span className="status-dot online" /> Open <ChevronRight size={14} /></span>
          </button>
        );
      })}
    </div>
  );
}

function AgentPage({ agent, task, setTask, analysis, analyzing, onRun, onDownload, onAllAgents }) {
  const Icon = agent.icon;
  return (
    <section className="agent-detail-page">
      <div className="welcome-row">
        <div>
          <div className="eyebrow"><Bot size={15} /> DEDICATED AI AGENT</div>
          <h2>{agent.name}</h2>
          <p>{agent.description}</p>
        </div>
        <span className="model-chip"><span className="status-dot online" /> Agent available</span>
      </div>

      <div className="agent-profile panel">
        <div className={`agent-profile-icon ${agent.color}`}><Icon size={30} /></div>
        <div className="agent-profile-copy">
          <span className="profile-label">AGENT ROLE</span>
          <h3>{agent.role}</h3>
          <p>{agent.description}</p>
        </div>
        <div className="agent-profile-status"><span className="status-dot online" /> Ready</div>
      </div>

      <div className="agent-detail-grid">
        <div className="panel responsibilities-panel">
          <PanelHeading title="Responsibilities" subtitle="What this agent is designed to do" />
          <div className="responsibility-list">
            {agent.responsibilities.map((item, index) => (
              <div className="responsibility-item" key={item}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>{item}</p>
                <CheckCircle2 size={16} />
              </div>
            ))}
          </div>
        </div>

        <div className="panel agent-work-panel">
          <PanelHeading title="Agent Workflow" subtitle="How this agent processes your request" />
          <div className="mini-workflow">
            <div><span>01</span><strong>Receive task</strong><small>Understand the business question</small></div>
            <div><span>02</span><strong>Analyze context</strong><small>Review available business information</small></div>
            <div><span>03</span><strong>Generate findings</strong><small>Prepare insights and recommendations</small></div>
          </div>
        </div>
      </div>

      <div className="panel prompt-panel">
        <div className="prompt-heading">
          <div className={`prompt-icon ${agent.color}`}><Sparkles size={21} /></div>
          <div><h3>Work with {agent.name}</h3><p>Customize the task below and run this agent through your AI backend.</p></div>
        </div>
        <textarea value={task} onChange={(e) => setTask(e.target.value)} placeholder="Enter a business task..." />
        <div className="prompt-footer">
          <span><ShieldCheck size={15} /> Connected to FastAPI analysis endpoint</span>
          <button className="primary-button" onClick={onRun} disabled={analyzing || !task.trim()}>
            {analyzing ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />}
            {analyzing ? "Working..." : "Run Agent Task"}
          </button>
        </div>
      </div>

      {analysis && <AnalysisResults analysis={analysis} onDownload={onDownload} />}
      <button className="text-button back-agents" onClick={onAllAgents}>View all AI agents <ChevronRight size={16} /></button>
    </section>
  );
}

function AnalysisPage({ task, setTask, analysis, analyzing, onRun, agents: agentList, onSelectAgent, onDownload }) {
  return (
    <section className="analysis-page">
      <div className="welcome-row">
        <div><div className="eyebrow"><BrainCircuit size={15} /> MULTI-AGENT INTELLIGENCE</div><h2>AI Business Analysis</h2><p>Give your AI team a business task and receive coordinated insights.</p></div>
        <span className="model-chip"><span className="status-dot online" /> Groq AI</span>
      </div>

      <div className="panel prompt-panel">
        <div className="prompt-heading"><div className="prompt-icon"><Sparkles size={21} /></div><div><h3>What should your AI team analyze?</h3><p>Describe a business question or analysis task.</p></div></div>
        <textarea value={task} onChange={(e) => setTask(e.target.value)} placeholder="Example: Analyze sales trends and recommend ways to improve profitability..." />
        <div className="prompt-footer"><span><ShieldCheck size={15} /> Analysis powered by your AI agent team</span><button className="primary-button" onClick={onRun} disabled={analyzing || !task.trim()}>{analyzing ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />}{analyzing ? "Analyzing..." : "Run Analysis"}</button></div>
      </div>

      <div className="panel workflow-panel">
        <PanelHeading title="Meet your AI agents" subtitle="Open an agent to see its responsibilities and dedicated workspace" />
        <div className="agent-directory">
          {agentList.map((agent) => {
            const Icon = agent.icon;
            return (
              <button className="directory-card" key={agent.id} onClick={() => onSelectAgent(agent)}>
                <div className={`agent-icon ${agent.color}`}><Icon size={22} /></div>
                <h3>{agent.name}</h3><p>{agent.description}</p>
                <span>Open workspace <ChevronRight size={15} /></span>
              </button>
            );
          })}
        </div>
      </div>
      {analysis && <AnalysisResults analysis={analysis} onDownload={onDownload} />}
    </section>
  );
}

function AnalysisResults({ analysis, onDownload }) {
  const messages = analysis?.agent_messages || [];
  return (
    <div className="results-section">
      <div className="results-heading">
        <div><div className="eyebrow"><CheckCircle2 size={15} /> ANALYSIS COMPLETE</div><h2>Agent Findings</h2></div>
        <button className="secondary-button" onClick={onDownload}><Download size={16} /> Download PDF</button>
      </div>
      <div className="panel result-summary">
        <div className="result-summary-icon"><CheckCircle2 size={23} /></div>
        <div><h3>Your business analysis is ready</h3><p>AI agent responses have been received from your backend.</p></div>
      </div>
      {messages.length ? messages.map((message, index) => (
        <div className="panel agent-result" key={`${message.source}-${index}`}>
          <div className="agent-result-heading"><div className="result-agent-icon"><MessageSquareText size={18} /></div><div><strong>{message.source || `Agent ${index + 1}`}</strong><small>AI agent response</small></div></div>
          <p>{message.content}</p>
        </div>
      )) : (
        <div className="panel agent-result"><h3>Analysis response</h3><pre>{JSON.stringify(analysis, null, 2)}</pre></div>
      )}
    </div>
  );
}

function ReportsPage({ kpis, monthlyData, onDownload }) {
  return (
    <section className="reports-page">
      <div className="welcome-row"><div><div className="eyebrow"><FileText size={15} /> BUSINESS REPORTING</div><h2>Reports & Insights</h2><p>Access your business performance report and analytics summary.</p></div><button className="primary-button" onClick={onDownload}><Download size={17} /> Download PDF Report</button></div>
      <section className="kpi-grid">
        <KpiCard title="Total Sales" value={money(kpis.total_sales)} icon={Wallet} color="purple" note="Reporting period" />
        <KpiCard title="Total Expenses" value={money(kpis.total_expenses)} icon={CircleDollarSign} color="orange" note="Operating expenses" />
        <KpiCard title="Net Profit" value={money(kpis.total_profit)} icon={TrendingUp} color="green" note="Net business profit" />
        <KpiCard title="Profit Margin" value={`${Number(kpis.profit_margin || 0).toFixed(1)}%`} icon={Activity} color="cyan" note="Profitability ratio" />
      </section>
      <div className="panel report-card">
        <div className="report-file-icon"><FileText size={28} /></div>
        <div className="report-copy"><h3>Business Performance Report</h3><p>PDF report containing business KPIs, monthly performance and AI agent findings.</p><span><CheckCircle2 size={14} /> Generated by BizIntel AI</span></div>
        <button className="secondary-button" onClick={onDownload}><Download size={16} /> Download</button>
      </div>
      <div className="panel report-table-panel">
        <PanelHeading title="Monthly Performance" subtitle="Business financial summary" />
        <div className="table-scroll"><table><thead><tr><th>Month</th><th>Sales</th><th>Expenses</th><th>Profit</th></tr></thead>
          <tbody>{monthlyData.map((item) => <tr key={item.month}><td>{item.month}</td><td>{money(item.sales)}</td><td>{money(item.expenses)}</td><td className="profit-cell">{money(item.profit)}</td></tr>)}</tbody>
        </table></div>
      </div>
    </section>
  );
}

function SettingsPage({ theme, setTheme, compact, setCompact, notifications, setNotifications, health, onRefresh }) {
  return (
    <section className="settings-page">
      <div className="welcome-row"><div><div className="eyebrow"><Settings size={15} /> WORKSPACE PREFERENCES</div><h2>Settings</h2><p>Manage your dashboard appearance and workspace preferences.</p></div></div>

      <div className="panel settings-section">
        <div className="settings-section-heading"><div className="settings-section-icon"><Sun size={20} /></div><div><h3>Appearance</h3><p>Customize how your BizIntel workspace looks.</p></div></div>
        <div className="setting-row">
          <div><strong>Theme</strong><small>Choose your preferred dashboard appearance.</small></div>
          <div className="theme-options">
            <button className={`theme-option ${theme === "dark" ? "chosen" : ""}`} onClick={() => setTheme("dark")}><Moon size={17} /> Dark</button>
            <button className={`theme-option ${theme === "light" ? "chosen" : ""}`} onClick={() => setTheme("light")}><Sun size={17} /> Light</button>
          </div>
        </div>
        <div className="setting-row">
          <div><strong>Compact layout</strong><small>Reduce spacing between dashboard elements.</small></div>
          <Toggle checked={compact} onChange={setCompact} />
        </div>
      </div>

      <div className="panel settings-section">
        <div className="settings-section-heading"><div className="settings-section-icon cyan"><Activity size={20} /></div><div><h3>Workspace Preferences</h3><p>Configure your dashboard experience.</p></div></div>
        <div className="setting-row">
          <div><strong>In-app notifications</strong><small>Enable workspace status and activity notices.</small></div>
          <Toggle checked={notifications} onChange={setNotifications} />
        </div>
        <div className="setting-row">
          <div><strong>Refresh dashboard data</strong><small>Fetch the latest available data from your API.</small></div>
          <button className="secondary-button" onClick={onRefresh}><RefreshCw size={15} /> Refresh data</button>
        </div>
      </div>

      <div className="panel settings-section">
        <div className="settings-section-heading"><div className="settings-section-icon green"><ShieldCheck size={20} /></div><div><h3>System & Integrations</h3><p>Connection status of your application services.</p></div></div>
        <div className="integration-row"><div className="integration-brand"><BrainCircuit size={19} /></div><div><strong>BizIntel AI Backend</strong><small>FastAPI · localhost:8000</small></div><span className={`connection-pill ${health ? "connected" : "disconnected"}`}><i />{health ? "Connected" : "Disconnected"}</span></div>
        <div className="integration-row"><div className="integration-brand groq"><Zap size={19} /></div><div><strong>AI Provider</strong><small>Groq API · AutoGen agents</small></div><span className="connection-pill configured"><i />Configured in backend</span></div>
        <div className="integration-row"><div className="integration-brand"><Database size={19} /></div><div><strong>Business Analytics</strong><small>Dashboard data API</small></div><span className={`connection-pill ${health ? "connected" : "disconnected"}`}><i />{health ? "Available" : "Unavailable"}</span></div>
      </div>
      <div className="settings-note"><ShieldCheck size={17} /><span>Theme preference is saved in this browser. API keys remain in your backend environment and are not displayed here.</span></div>
    </section>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`toggle-switch ${checked ? "toggle-on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}

export default App;
