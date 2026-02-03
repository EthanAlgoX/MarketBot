import React, { useState, useEffect, useRef } from 'react';
import {
    Play,
    Terminal,
    CheckCircle2,
    XCircle,
    Loader2,
    Cpu,
    Activity,
    ChevronRight,
    Eye,
    Compass,
    Zap,
    Clock,
    Search,
    Settings,
    Layout,
    Maximize2,
    MessageSquare,
    Image as ImageIcon
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface Action {
    id: string;
    action: string;
    input: Record<string, any>;
    thought?: string;
    observation?: string;
    screenshots?: string[];
    point?: { x: number; y: number };
    actionType?: string;
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
    output?: any;
    error?: string;
}

interface Intent {
    id: string;
    intent: string;
    steps: Action[];
    timestamp?: number;
}

export default function App() {
    const [intents, setIntents] = useState<Intent[]>([]);
    const [selectedIntentId, setSelectedIntentId] = useState<string | null>(null);
    const [inputText, setInputText] = useState('');
    const [isParsing, setIsParsing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    // Filtered intents for sidebar search
    const filteredIntents = intents.filter(i =>
        i.intent.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.id.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const selectedIntent = intents.find(i => i.id === selectedIntentId) || intents[0];

    useEffect(() => {
        // Initial selection
        if (intents.length > 0 && !selectedIntentId) {
            setSelectedIntentId(intents[0].id);
        }
    }, [intents]);

    const handleRun = async () => {
        if (!inputText.trim()) return;
        setIsParsing(true);
        try {
            const resp = await fetch('/api/executor.parse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ params: { text: inputText } })
            });
            const data = await resp.json();
            if (data.ok) {
                const intent = { ...data.result, timestamp: Date.now() };
                setIntents(prev => [intent, ...prev]);
                setSelectedIntentId(intent.id);

                await fetch('/api/executor.run', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ params: intent })
                });
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsParsing(false);
            setInputText('');
        }
    };

    const getLatestScreenshot = (steps: Action[]) => {
        for (let i = steps.length - 1; i >= 0; i--) {
            if (steps[i].screenshots && steps[i].screenshots!.length > 0) {
                return {
                    url: steps[i].screenshots![0],
                    stepIdx: i,
                    point: steps[i].point,
                    actionType: steps[i].actionType || steps[i].action
                };
            }
        }
        return null;
    };

    const latestVisual = selectedIntent ? getLatestScreenshot(selectedIntent.steps) : null;

    return (
        <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans">
            {/* Sidebar: Task Sessions */}
            <aside className="w-80 border-r border-border flex flex-col glass z-20">
                <div className="p-6 border-b border-border space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <Cpu className="text-white w-5 h-5" />
                        </div>
                        <h1 className="text-sm font-bold tracking-widest uppercase">MarketBot <span className="text-blue-500">Core</span></h1>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search tasks..."
                            className="w-full bg-white/[0.03] border border-white/5 rounded-xl py-2 pl-10 pr-4 text-xs focus:outline-none focus:border-blue-500/50 transition-colors"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-1 scroll-hide">
                    {filteredIntents.map(intent => (
                        <div
                            key={intent.id}
                            onClick={() => setSelectedIntentId(intent.id)}
                            className={cn(
                                "sidebar-item",
                                selectedIntentId === intent.id && "active"
                            )}
                        >
                            <div className="flex-1 min-w-0">
                                <p className="truncate text-white">{intent.intent}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <Clock className="w-3 h-3" />
                                    <span className="text-[10px] opacity-60">
                                        {intent.timestamp ? new Date(intent.timestamp).toLocaleTimeString() : 'Just now'}
                                    </span>
                                </div>
                            </div>
                            <ChevronRight className={cn("w-4 h-4 opacity-0 transition-opacity", selectedIntentId === intent.id && "opacity-100")} />
                        </div>
                    ))}
                    {filteredIntents.length === 0 && (
                        <div className="py-12 text-center text-slate-600 space-y-3">
                            <Compass className="w-8 h-8 mx-auto opacity-20" />
                            <p className="text-xs">No tasks found</p>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-border flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[10px] font-bold uppercase tracking-tighter opacity-60">Gateway Ready</span>
                    </div>
                    <Settings className="w-4 h-4 text-slate-500 cursor-pointer hover:text-white transition-colors" />
                </div>
            </aside>

            {/* Main Workspace */}
            <main className="flex-1 flex overflow-hidden relative">
                {/* Left Panel: Action Trace */}
                <section className="flex-1 flex flex-col border-r border-border relative">
                    <header className="h-16 px-8 border-b border-border flex items-center justify-between glass z-10">
                        <div className="flex items-center gap-4">
                            <MessageSquare className="w-4 h-4 text-blue-400" />
                            <h2 className="text-sm font-semibold tracking-tight">
                                {selectedIntent ? selectedIntent.intent : 'Select a process'}
                            </h2>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-1 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-bold border border-blue-500/20 uppercase tracking-widest">
                                Live Trace
                            </span>
                        </div>
                    </header>

                    <div className="flex-1 overflow-y-auto p-12 space-y-12 scroll-hide" ref={scrollRef}>
                        {!selectedIntent ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-4">
                                <Activity className="w-12 h-12 opacity-10 animate-pulse" />
                                <p className="text-sm">Initiate a request to see the execution trace.</p>
                            </div>
                        ) : (
                            <div className="max-w-2xl mx-auto w-full">
                                {selectedIntent.steps.map((step, idx) => (
                                    <div key={step.id} className="trace-card group animate-in">
                                        <div className={cn(
                                            "trace-dot",
                                            step.status === 'COMPLETED' ? "bg-green-500/20 text-green-500 border-green-500/30" :
                                                step.status === 'RUNNING' ? "bg-blue-500 animate-pulse border-blue-500/30" :
                                                    step.status === 'FAILED' ? "bg-red-500/20 text-red-500 border-red-500/30" : "bg-slate-800 border-white/5"
                                        )}>
                                            {step.status === 'COMPLETED' ? <CheckCircle2 className="w-4 h-4" /> :
                                                step.status === 'RUNNING' ? <Zap className="w-4 h-4 text-blue-400" /> :
                                                    step.status === 'FAILED' ? <XCircle className="w-4 h-4" /> : null}
                                        </div>

                                        <div className="space-y-6">
                                            {step.thought && (
                                                <div className="flex gap-4 items-start">
                                                    <Eye className="w-4 h-4 text-blue-400/40 mt-1 shrink-0" />
                                                    <p className="text-sm text-slate-400 leading-relaxed font-medium">
                                                        {step.thought}
                                                    </p>
                                                </div>
                                            )}

                                            <div className="glass-card p-4 space-y-4 group-hover:border-white/20 transition-colors">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <span className="action-badge">{step.action}</span>
                                                        <span className="text-[10px] font-mono text-slate-500">ID: {step.id}</span>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Step {idx + 1}</span>
                                                </div>
                                                <pre className="text-xs font-mono text-slate-500 overflow-x-auto p-3 bg-black/20 rounded-lg">
                                                    {JSON.stringify(step.input, null, 2)}
                                                </pre>
                                            </div>

                                            {step.observation && (
                                                <div className="flex gap-4 items-start pl-4 py-3 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
                                                    <ChevronRight className="w-4 h-4 text-emerald-500 mt-1 shrink-0" />
                                                    <p className="text-sm text-emerald-400/80 font-medium">
                                                        {step.observation}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Floating Command Bar */}
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-xl px-4 z-30">
                        <div className="relative group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
                            <div className="relative flex glass rounded-2xl overflow-hidden shadow-2xl border border-white/10">
                                <input
                                    className="flex-1 bg-transparent px-6 py-4 outline-none text-sm placeholder:text-slate-500"
                                    placeholder="What should MarketBot do next?"
                                    value={inputText}
                                    onChange={e => setInputText(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleRun()}
                                />
                                <button
                                    onClick={handleRun}
                                    disabled={isParsing || !inputText.trim()}
                                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-colors px-6 flex items-center gap-2 text-xs font-bold uppercase tracking-widest"
                                >
                                    {isParsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                                    Run
                                </button>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Right Panel: Visual Workspace (UI-TARS Style) */}
                <section className="w-[40%] flex flex-col glass overflow-hidden translate-x-0 transition-transform">
                    <header className="h-16 px-6 border-b border-border flex items-center justify-between glass z-10">
                        <div className="flex items-center gap-4">
                            <ImageIcon className="w-4 h-4 text-emerald-400" />
                            <h2 className="text-xs font-bold uppercase tracking-widest">Visual Feedback</h2>
                        </div>
                        <div className="flex items-center gap-2">
                            <Layout className="w-4 h-4 text-slate-500 cursor-pointer" />
                            <Maximize2 className="w-4 h-4 text-slate-500 cursor-pointer" />
                        </div>
                    </header>

                    <div className="flex-1 overflow-hidden flex flex-col">
                        {latestVisual ? (
                            <div className="flex-1 relative flex items-center justify-center p-8 bg-slate-950/50">
                                <div className="relative w-full h-full flex items-center justify-center">
                                    <img
                                        src={latestVisual.url.startsWith('http') || latestVisual.url.startsWith('data:') ? latestVisual.url : `/media/${latestVisual.url}`}
                                        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl border border-white/5"
                                        alt="Current screen"
                                    />

                                    {/* UI-TARS Coordinate Marker */}
                                    {latestVisual.point && (
                                        <div
                                            className="absolute z-30"
                                            style={{
                                                left: `${(latestVisual.point.x / 1000) * 100}%`,
                                                top: `${(latestVisual.point.y / 1000) * 100}%`,
                                                transform: 'translate(-50%, -50%)'
                                            }}
                                        >
                                            <div className="relative group/marker">
                                                <div className="absolute inset-0 w-12 h-12 -m-6 bg-red-500/30 rounded-full animate-ping" />
                                                <div className="w-5 h-5 bg-red-600 rounded-full border-2 border-white shadow-2xl flex items-center justify-center">
                                                    <div className="w-1.5 h-1.5 bg-white rounded-full" />
                                                </div>

                                                {/* Tooltip */}
                                                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-4 px-3 py-1.5 bg-black/90 backdrop-blur rounded-lg border border-white/10 text-[10px] text-white whitespace-nowrap shadow-2xl pointer-events-none transition-all scale-90 opacity-0 group-hover/marker:scale-100 group-hover/marker:opacity-100 uppercase font-bold tracking-tighter">
                                                    {latestVisual.actionType}: [{latestVisual.point.x}, {latestVisual.point.y}]
                                                </div>

                                                {/* Magnifier: UI-TARS Style Detail View */}
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-6 w-48 h-48 rounded-2xl border-2 border-blue-500 bg-slate-950 shadow-[0_0_50px_rgba(59,130,246,0.3)] overflow-hidden pointer-events-none opacity-0 group-hover/marker:opacity-100 transition-all duration-500 scale-50 group-hover/marker:scale-100 origin-bottom border-dashed">
                                                    <img
                                                        src={latestVisual.url.startsWith('http') || latestVisual.url.startsWith('data:') ? latestVisual.url : `/media/${latestVisual.url}`}
                                                        className="absolute max-w-none"
                                                        style={{
                                                            width: '800%', // 8x zoom
                                                            left: `${-(latestVisual.point.x / 1000) * 800 + 50}%`,
                                                            top: `${-(latestVisual.point.y / 1000) * 800 + 50}%`,
                                                            imageRendering: 'pixelated'
                                                        }}
                                                        alt="Zoomed detail"
                                                    />
                                                    {/* Crosshair */}
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <div className="w-full h-[1px] bg-red-400 opacity-50 shadow-[0_0_5px_rgba(248,113,113,0.8)]" />
                                                        <div className="absolute h-full w-[1px] bg-red-400 opacity-50 shadow-[0_0_5px_rgba(248,113,113,0.8)]" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-600 space-y-6">
                                <div className="w-24 h-24 rounded-3xl border-2 border-dashed border-white/5 flex items-center justify-center">
                                    <Layout className="w-10 h-10 opacity-10" />
                                </div>
                                <div className="text-center space-y-1">
                                    <p className="text-sm font-semibold text-slate-400 uppercase tracking-widest">No visual data</p>
                                    <p className="text-xs opacity-50">Visual steps will appear here in real-time.</p>
                                </div>
                            </div>
                        )}

                        <footer className="h-12 border-t border-border/40 flex items-center px-6 justify-between text-[9px] text-slate-600 font-bold uppercase tracking-[0.2em] glass">
                            <div>Step Observation Feed</div>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <Activity className="w-3 h-3 text-blue-500" />
                                    <span>Sync: 12ms</span>
                                </div>
                            </div>
                        </footer>
                    </div>
                </section>
            </main>
        </div>
    );
}
