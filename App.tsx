
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Plus, Search, Settings, ChevronDown, Sparkles, Send, Loader2, 
  Clock, Menu, X, FileText, Zap, MessageSquare, ArrowRight,
  BarChart3, Layout, CreditCard, TrendingUp, TrendingDown, PieChart as PieIcon
} from 'lucide-react';
import { Asset, Liability, Transaction, Message, FinancialMetrics } from './types';
import { callGeminiWithRetry } from './services/geminiService';

// --- Custom Notion-style Pie Chart Component ---
const AssetPieChart = ({ assets }: { assets: Asset[] }) => {
  const data = useMemo(() => {
    const categories: Record<string, number> = {};
    assets.forEach(a => {
      categories[a.type] = (categories[a.type] || 0) + a.value;
    });
    return Object.entries(categories).map(([name, value]) => ({ name, value }));
  }, [assets]);

  const total = useMemo(() => data.reduce((sum, item) => sum + item.value, 0), [data]);
  
  // Colors aligned with the Notion aesthetic
  const colors: Record<string, string> = {
    'Stock': '#0EA5E9',    // Sky 500
    'Property': '#10B981', // Emerald 500
    'Cash': '#F59E0B',     // Amber 500
    'Business': '#8B5CF6'  // Violet 500
  };

  let cumulativePercent = 0;

  const getCoordinatesForPercent = (percent: number) => {
    const x = Math.cos(2 * Math.PI * percent);
    const y = Math.sin(2 * Math.PI * percent);
    return [x, y];
  };

  return (
    <div className="flex flex-col md:flex-row items-center gap-8 p-6 bg-white border border-[#EDECE9] rounded-lg">
      <div className="relative w-48 h-48">
        <svg viewBox="-1 -1 2 2" className="transform -rotate-90 w-full h-full">
          {data.map((slice, i) => {
            const percent = slice.value / total;
            const [startX, startY] = getCoordinatesForPercent(cumulativePercent);
            cumulativePercent += percent;
            const [endX, endY] = getCoordinatesForPercent(cumulativePercent);
            const largeArcFlag = percent > 0.5 ? 1 : 0;
            const pathData = [
              `M ${startX} ${startY}`,
              `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`,
              `L 0 0`,
            ].join(' ');

            return (
              <path
                key={i}
                d={pathData}
                fill={colors[slice.name] || '#E5E7EB'}
                className="hover:opacity-80 transition-opacity cursor-help"
              >
                <title>{`${slice.name}: ${((slice.value / total) * 100).toFixed(1)}%`}</title>
              </path>
            );
          })}
          {/* Inner circle for donut style */}
          <circle cx="0" cy="0" r="0.6" fill="white" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[10px] font-bold text-[#91918E] uppercase">Allocation</span>
          <span className="text-sm font-black">Assets</span>
        </div>
      </div>

      <div className="flex-1 space-y-3 w-full">
        <h4 className="text-[11px] font-bold text-[#91918E] uppercase tracking-widest mb-4">Portfolio Mix</h4>
        {data.sort((a, b) => b.value - a.value).map((item, i) => (
          <div key={i} className="flex items-center justify-between group">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors[item.name] }} />
              <span className="text-[13px] font-medium text-[#37352F]">{item.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[12px] font-mono text-[#91918E]">{((item.value / total) * 100).toFixed(1)}%</span>
              <span className="text-[13px] font-bold min-w-[80px] text-right font-mono">${(item.value / 1000000).toFixed(2)}M</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const INITIAL_ASSETS: Asset[] = [
  { id: 'ASSET_001', name: '台積電 (2330.TW)', type: 'Stock', value: 2450000, change: '+15.2%', emoji: '📈' },
  { id: 'ASSET_002', name: '台北信義區房產', type: 'Property', value: 28000000, change: '+4.5%', emoji: '🏠' },
  { id: 'ASSET_004', name: '美金定存 (USD)', type: 'Cash', value: 320000, change: '+0.5%', emoji: '💵' }
];

const INITIAL_LIABILITIES: Liability[] = [
  { id: 'LIAB_001', name: '長期房貸 (Mortgage)', type: 'Loan', value: 12000000, rate: '2.1%', emoji: '🏦' },
  { id: 'LIAB_002', name: '商業信貸 (LOC)', type: 'Debt', value: 500000, rate: '3.5%', emoji: '💳' }
];

const INITIAL_TRANSACTIONS: Transaction[] = [
  { id: 'TX_01', date: 'Jan 10', desc: '每月薪資 (Salary)', amount: 185000, type: 'Income', category: 'Salary' },
  { id: 'TX_02', date: 'Jan 11', desc: 'GCP 雲端伺服器託管', amount: -12500, type: 'Expense', category: 'Ops' },
  { id: 'TX_03', date: 'Jan 12', desc: '大樓管理費 (TPE)', amount: -4500, type: 'Expense', category: 'Housing' }
];

const App: React.FC = () => {
  // --- State ---
  const [assets] = useState<Asset[]>(INITIAL_ASSETS);
  const [liabilities] = useState<Liability[]>(INITIAL_LIABILITIES);
  const [transactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);
  const [isPending, setIsPending] = useState(false);
  const [input, setInput] = useState("");
  const [activeTab, setActiveTab] = useState('Overview');
  const [showAI, setShowAI] = useState(true);
  const [report, setReport] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', text: '你好 Torres。我是你的 AI 財務顧問。我已同步您的資產配置並產生了即時圖表。需要我針對資產權重提供建議嗎？', timestamp: new Date() }
  ]);
  const [timestamp, setTimestamp] = useState(new Date().toLocaleTimeString());

  const logEndRef = useRef<HTMLDivElement>(null);

  // --- Metrics Calculation ---
  const metrics: FinancialMetrics = (() => {
    const totalAssets = assets.reduce((a, b) => a + b.value, 0);
    const totalDebt = liabilities.reduce((a, b) => a + b.value, 0);
    const netWorth = totalAssets - totalDebt;
    const debtRatio = (totalDebt / totalAssets) * 100;
    const cashflow = transactions.reduce((a, b) => a + b.amount, 0);
    return { totalAssets, totalDebt, netWorth, debtRatio, cashflow };
  })();

  // --- Effects ---
  useEffect(() => {
    const timer = setInterval(() => setTimestamp(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // --- AI Logic ---
  const getSystemInstruction = useCallback(() => {
    const contextStr = `
      老闆名稱: Torres Liu (18年 BIOS/工控/KAM 背景)
      當前資產: ${assets.map(a => `${a.name}($${a.value})`).join(', ')}
      總負債: $${metrics.totalDebt}
      淨資產: $${metrics.netWorth}
      負債比: ${metrics.debtRatio.toFixed(2)}%
      現金流(本月): $${metrics.cashflow}
    `;
    return `你是一位專精於工控產業動態與金融理財的資深顧問，服務對象是具備 18 年電子業背景的 Torres。
    你的說話風格必須像 Notion 專家一樣：冷靜、精煉、數據導向且親切。
    請使用繁體中文。
    當前財務上下文：
    ${contextStr}`;
  }, [assets, metrics]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isPending) return;

    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: 'user', text: userMsg, timestamp: new Date() }]);
    setIsPending(true);

    const result = await callGeminiWithRetry(userMsg, getSystemInstruction());
    setMessages(prev => [...prev, { role: 'assistant', text: result, timestamp: new Date() }]);
    setIsPending(false);
  };

  const generateReport = async () => {
    setIsPending(true);
    const prompt = "請根據我目前的資產負債數據，產出一份結構化的財務健康診斷週報。特別針對目前的資產分配比例（圓餅圖數據）提供風險評估。";
    const result = await callGeminiWithRetry(prompt, getSystemInstruction());
    setReport(result);
    setIsPending(false);
  };

  const analyzeAsset = async (assetName: string, value: number) => {
    setShowAI(true);
    setIsPending(true);
    const prompt = `針對資產「${assetName}」（目前估值 $${value}）進行穿透式 AI 診斷，分析其在當前全球供應鏈與利率環境下的表現。`;
    const result = await callGeminiWithRetry(prompt, getSystemInstruction());
    setMessages(prev => [...prev, { role: 'user', text: `分析 ${assetName}`, timestamp: new Date() }]);
    setMessages(prev => [...prev, { role: 'assistant', text: result, timestamp: new Date() }]);
    setIsPending(false);
  };

  // --- UI Components Helpers ---
  const SidebarItem = ({ icon: Icon, label, id, emoji }: { icon?: any, label: string, id: string, emoji?: string }) => (
    <div 
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-2 py-1.5 text-[13px] rounded cursor-pointer transition-colors group ${
        activeTab === id ? 'bg-[#EBEAEA] text-[#37352F] font-semibold' : 'text-[#6B6B6B] hover:bg-[#EBEAEA] hover:text-[#37352F]'
      }`}
    >
      {emoji ? (
        <span className="text-base w-5 flex justify-center">{emoji}</span>
      ) : Icon && (
        <Icon size={16} className="text-[#91918E] group-hover:text-[#37352F]" />
      )}
      <span className="truncate">{label}</span>
    </div>
  );

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar */}
      <aside className="w-64 bg-[#F7F6F3] border-r border-[#EDECE9] flex flex-col shrink-0">
        <div className="p-4 flex items-center gap-2 hover:bg-[#EBEAEA] cursor-pointer transition-colors">
          <div className="w-6 h-6 bg-[#37352F] rounded flex items-center justify-center text-white text-[10px] font-bold">TL</div>
          <span className="font-semibold text-[14px] truncate">Vibe Capital Node</span>
          <ChevronDown size={14} className="ml-auto text-[#91918E]" />
        </div>

        <div className="flex-1 py-4 overflow-y-auto custom-scrollbar">
          <div className="px-3 mb-6 space-y-0.5">
            <SidebarItem icon={Search} label="快速搜索" id="Search" />
            <SidebarItem icon={Clock} label="最近動態" id="Updates" />
            <SidebarItem icon={Settings} label="節點設置" id="Settings" />
          </div>

          <div className="px-3">
            <h3 className="px-2 mb-2 text-[11px] font-bold text-[#91918E] uppercase tracking-wider">Workspace</h3>
            <div className="space-y-0.5">
              <SidebarItem emoji="🏦" label="資產總覽" id="Overview" />
              <SidebarItem emoji="📈" label="證券投資" id="Stocks" />
              <SidebarItem emoji="🏠" label="不動產管理" id="Property" />
              <SidebarItem emoji="🧾" label="現金流量" id="Cashflow" />
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-[#EDECE9] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-mono text-[#91918E]">AI_CORE_ONLINE</span>
          </div>
          <span className="text-[10px] font-mono text-[#91918E]">{timestamp.split(' ')[0]}</span>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        <header className="h-11 px-4 flex items-center justify-between border-b border-[#EDECE9] sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2 text-[14px] text-[#91918E]">
            <Menu size={16} className="md:hidden cursor-pointer" />
            <span className="hover:bg-[#EBEAEA] px-1.5 py-0.5 rounded cursor-pointer">Private</span>
            <span className="text-[#D3D2CE]">/</span>
            <span className="text-[#37352F] font-medium">🏦 資產管理終端</span>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={generateReport}
              disabled={isPending}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-[#EDECE9] rounded hover:bg-[#F7F6F3] text-[13px] font-medium transition-colors disabled:opacity-50"
            >
              {isPending ? <Loader2 size={14} className="animate-spin text-sky-500" /> : <Sparkles size={14} className="text-sky-500" />}
              <span>健康週報</span>
            </button>
            <div className="w-px h-4 bg-[#EDECE9]"></div>
            <button 
              onClick={() => setShowAI(!showAI)}
              className={`p-1.5 rounded transition-colors ${showAI ? 'bg-sky-50 text-sky-600' : 'hover:bg-[#F7F6F3] text-[#91918E]'}`}
            >
              <MessageSquare size={18} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 md:px-12 lg:px-24 py-16 custom-scrollbar">
          {/* Header Section */}
          <div className="max-w-4xl mx-auto mb-12">
            <div className="text-7xl mb-6">🏦</div>
            <h1 className="text-4xl font-bold mb-4 tracking-tight">資產管理終端 (Vibe Capital)</h1>
            <p className="text-[#6B6B6B] text-[15px] leading-relaxed">
              Torres Liu 的私人資產節點。整合個人理財與專業決策，由 Gemini 提供即時分析與風險監控。
            </p>
          </div>

          {/* Metrics Grid */}
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="p-5 border border-[#EDECE9] rounded-lg group hover:border-[#D3D2CE] transition-all">
              <div className="text-[11px] font-bold text-[#91918E] uppercase mb-1 flex items-center gap-2">
                <Layout size={12} /> Net Worth
              </div>
              <div className="text-2xl font-bold font-mono">${(metrics.netWorth / 1000000).toFixed(2)}M</div>
              <div className="mt-2 text-[11px] font-medium text-emerald-600 flex items-center gap-1">
                <TrendingUp size={12} /> +2.4% vs last week
              </div>
            </div>
            <div className="p-5 border border-[#EDECE9] rounded-lg group hover:border-[#D3D2CE] transition-all">
              <div className="text-[11px] font-bold text-[#91918E] uppercase mb-1 flex items-center gap-2">
                <CreditCard size={12} /> Debt Ratio
              </div>
              <div className="text-2xl font-bold font-mono text-rose-500">{metrics.debtRatio.toFixed(1)}%</div>
              <div className="mt-2 text-[11px] font-medium text-amber-500">Monitor Leverage</div>
            </div>
            <div className="p-5 border border-[#EDECE9] rounded-lg group hover:border-[#D3D2CE] transition-all">
              <div className="text-[11px] font-bold text-[#91918E] uppercase mb-1 flex items-center gap-2">
                <BarChart3 size={12} /> Monthly Flow
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-600">+${(metrics.cashflow / 1000).toFixed(1)}k</div>
              <div className="mt-2 text-[11px] font-medium text-slate-400">Synced via Cloud</div>
            </div>
          </div>

          {/* Visualization Section */}
          <div className="max-w-4xl mx-auto mb-16">
            <h2 className="text-[18px] font-bold mb-6 flex items-center gap-2">
              <PieIcon size={20} className="text-sky-500" /> Asset Allocation
            </h2>
            <AssetPieChart assets={assets} />
          </div>

          {/* AI Weekly Report */}
          {report && (
            <div className="max-w-4xl mx-auto mb-16 p-6 bg-[#F7F6F3] border border-[#EDECE9] rounded-lg relative group">
              <button 
                onClick={() => setReport(null)}
                className="absolute top-4 right-4 text-[#91918E] hover:text-[#37352F] opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={16} />
              </button>
              <h3 className="text-[14px] font-bold mb-4 flex items-center gap-2 text-sky-700">
                <Sparkles size={16} /> 智能財務診斷報告 (Analysis)
              </h3>
              <div className="text-[14px] leading-7 text-[#37352F] whitespace-pre-wrap font-medium">
                {String(report)}
              </div>
            </div>
          )}

          {/* Database: Assets */}
          <section className="max-w-4xl mx-auto mb-20">
            <h2 className="text-[18px] font-bold mb-4 flex items-center gap-2">
              <FileText size={20} className="text-[#D3D2CE]" /> Assets Metadata
            </h2>
            <div className="overflow-x-auto border-t border-[#EDECE9]">
              <table className="w-full text-[14px] text-left">
                <thead>
                  <tr className="border-b border-[#EDECE9] text-[#91918E] text-[12px] font-semibold">
                    <th className="py-3 px-2 w-10">Meta</th>
                    <th className="py-3 px-2">Name</th>
                    <th className="py-3 px-2">Type</th>
                    <th className="py-3 px-2 text-right">Value (USD)</th>
                    <th className="py-3 px-2 text-right">Yield</th>
                    <th className="py-3 px-2 text-center w-12">AI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EDECE9]">
                  {assets.map((a) => (
                    <tr key={a.id} className="hover:bg-[#F7F6F3] transition-colors group">
                      <td className="py-4 px-2 text-lg">{a.emoji}</td>
                      <td className="py-4 px-2">
                        <div className="font-semibold">{a.name}</div>
                        <div className="text-[11px] font-mono text-[#91918E]">{a.id}</div>
                      </td>
                      <td className="py-4 px-2">
                        <span className="px-1.5 py-0.5 bg-white border border-[#EDECE9] rounded text-[10px] font-bold text-[#6B6B6B] uppercase">
                          {a.type}
                        </span>
                      </td>
                      <td className="py-4 px-2 text-right font-mono font-semibold">
                        ${a.value.toLocaleString()}
                      </td>
                      <td className={`py-4 px-2 text-right font-bold ${a.change.startsWith('+') ? 'text-emerald-600' : 'text-rose-500'}`}>
                        {a.change}
                      </td>
                      <td className="py-4 px-2 text-center">
                        <button 
                          onClick={() => analyzeAsset(a.name, a.value)}
                          className="p-1.5 hover:bg-sky-50 text-sky-400 hover:text-sky-600 rounded transition-colors"
                        >
                          <Zap size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Database: Liabilities */}
          <section className="max-w-4xl mx-auto mb-20">
            <h2 className="text-[18px] font-bold mb-4 flex items-center gap-2">
              <ArrowRight size={20} className="text-[#D3D2CE]" /> Liabilities & Debts
            </h2>
            <div className="overflow-x-auto border-t border-[#EDECE9]">
              <table className="w-full text-[14px] text-left">
                <thead>
                  <tr className="border-b border-[#EDECE9] text-[#91918E] text-[12px] font-semibold">
                    <th className="py-3 px-2 w-10">Meta</th>
                    <th className="py-3 px-2">Name</th>
                    <th className="py-3 px-2">Type</th>
                    <th className="py-3 px-2 text-right">Balance</th>
                    <th className="py-3 px-2 text-right">Interest</th>
                    <th className="py-3 px-2 text-center w-12">AI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EDECE9]">
                  {liabilities.map((l) => (
                    <tr key={l.id} className="hover:bg-rose-50 transition-colors group">
                      <td className="py-4 px-2 text-lg">{l.emoji}</td>
                      <td className="py-4 px-2">
                        <div className="font-semibold text-rose-900">{l.name}</div>
                        <div className="text-[11px] font-mono text-rose-400">{l.id}</div>
                      </td>
                      <td className="py-4 px-2">
                        <span className="px-1.5 py-0.5 bg-rose-100 rounded text-[10px] font-bold text-rose-600 uppercase">
                          {l.type}
                        </span>
                      </td>
                      <td className="py-4 px-2 text-right font-mono font-semibold text-rose-600">
                        -${l.value.toLocaleString()}
                      </td>
                      <td className="py-4 px-2 text-right font-mono text-rose-400">
                        {l.rate}
                      </td>
                      <td className="py-4 px-2 text-center">
                        <button 
                          onClick={() => analyzeAsset(l.name, -l.value)}
                          className="p-1.5 hover:bg-rose-200 text-rose-400 rounded transition-colors"
                        >
                          <Zap size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Cashflow Log */}
          <section className="max-w-4xl mx-auto mb-32">
            <h2 className="text-[18px] font-bold mb-4 flex items-center gap-2">
              <Plus size={20} className="text-[#D3D2CE]" /> Transactions Log
            </h2>
            <div className="space-y-0.5">
              {transactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between py-3 px-2 hover:bg-[#F7F6F3] rounded transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="text-[12px] font-mono text-[#91918E] w-12">{t.date}</div>
                    <div className="flex flex-col">
                      <div className="font-medium text-[14px]">{t.desc}</div>
                      <div className="text-[11px] text-[#91918E]">{t.category}</div>
                    </div>
                  </div>
                  <div className={`font-mono font-bold ${t.amount > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {t.amount > 0 ? '+' : ''}{t.amount.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* AI Sidebar Chat */}
        {showAI && (
          <div className="absolute top-11 bottom-0 right-0 w-[420px] bg-white border-l border-[#EDECE9] shadow-2xl flex flex-col z-20 animate-in slide-in-from-right duration-300">
            <div className="h-12 px-4 flex items-center justify-between border-b border-[#EDECE9] bg-[#F7F6F3]/50">
              <div className="flex items-center gap-2 text-[12px] font-bold text-[#37352F] uppercase tracking-wider">
                <Sparkles size={16} className="text-sky-500" /> AI Neural Advisor
              </div>
              <button 
                onClick={() => setShowAI(false)}
                className="p-1 hover:bg-[#EBEAEA] rounded text-[#91918E]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
              {messages.map((msg, i) => (
                <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-2 mb-1.5 ml-1">
                      <div className="w-5 h-5 bg-sky-500 rounded flex items-center justify-center text-white text-[8px] font-bold">AI</div>
                      <span className="text-[10px] font-bold text-[#91918E] uppercase tracking-tighter">Diagnostic Node</span>
                    </div>
                  )}
                  <div 
                    className={`max-w-[90%] px-4 py-3 rounded-xl text-[13.5px] leading-relaxed shadow-sm ${
                      msg.role === 'user' 
                        ? 'bg-sky-600 text-white font-medium rounded-tr-none' 
                        : 'bg-[#F1F1EF] text-[#37352F] font-medium rounded-tl-none border border-[#EDECE9]'
                    }`}
                  >
                    {String(msg.text)}
                  </div>
                </div>
              ))}
              {isPending && (
                <div className="flex items-center gap-2 text-sky-500 text-[11px] font-bold italic animate-pulse px-2">
                  <Loader2 size={12} className="animate-spin" />
                  ANALYZING_FINANCIAL_CONTEXT...
                </div>
              )}
              <div ref={logEndRef} />
            </div>

            <div className="p-4 bg-[#F7F6F3]/30 border-t border-[#EDECE9]">
              <form onSubmit={handleSendMessage} className="relative">
                <textarea 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="詢問關於您的資產動態..."
                  className="w-full h-24 p-3 pr-12 text-[14px] bg-white border border-[#EDECE9] rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 shadow-sm resize-none transition-all placeholder:text-[#D3D2CE]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <button 
                  type="submit"
                  disabled={!input.trim() || isPending}
                  className="absolute bottom-3 right-3 p-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 disabled:bg-[#D3D2CE] shadow-md transition-all active:scale-95"
                >
                  <Send size={16} />
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
