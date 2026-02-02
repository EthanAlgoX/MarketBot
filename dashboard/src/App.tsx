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
    Zap
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
}

export default function App() {
    const [intents, setIntents] = useState<Intent[]>([]);
    const [inputText, setInputText] = useState('');
    const [isParsing, setIsParsing] = useState(false);
    const [playbackIndex, setPlaybackIndex] = useState<number>(-1);
    const [isPlaybackActive, setIsPlaybackActive] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Simple WebSocket mock for demo or implementation skeleton
    useEffect(() => {
        // In real implementation, connect to MarketBot Gateway WS
        console.log("Connecting to MarketBot Gateway...");
    }, []);

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
                // Start execution
                const intent = data.result;
                setIntents(prev => [intent, ...prev]);

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

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-blue-500/30">
            {/* Header */}
            <header className="h-16 border-b border-border glass flex items-center px-8 justify-between sticky top-0 z-50">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <Cpu className="text-white w-5 h-5" />
                    </div>
                    <h1 className="text-lg font-semibold tracking-tight">MarketBot <span className="text-blue-500">Trace</span></h1>
                </div>

                <div className="flex items-center gap-6 text-sm text-slate-400">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        Gateway Connected
                    </div>
                    <Activity className="w-4 h-4" />
                </div>
            </header>

            <main className="flex-1 max-w-5xl mx-auto w-full p-8 space-y-12">
                {/* Input Area */}
                <section className="space-y-4">
                    <div className="relative group">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                        <div className="relative flex glass rounded-2xl overflow-hidden shadow-2xl">
                            <input
                                className="flex-1 bg-transparent px-6 py-5 outline-none text-lg placeholder:text-slate-600"
                                placeholder="What should MarketBot do next?"
                                value={inputText}
                                onChange={e => setInputText(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleRun()}
                            />
                            <button
                                onClick={handleRun}
                                disabled={isParsing || !inputText.trim()}
                                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors px-8 flex items-center gap-2 font-medium"
                            >
                                {isParsing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
                                Run
                            </button>
                        </div>
                    </div>
                </section>

                {/* Trace List */}
                <div className="space-y-16" ref={scrollRef}>
                    {intents.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-24 text-slate-500 space-y-4 border border-dashed border-border rounded-3xl">
                            <Compass className="w-12 h-12 opacity-20" />
                            <p>No active execution traces.</p>
                        </div>
                    )}

                    {intents.map(intent => (
                        <div key={intent.id} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <h2 className="text-2xl font-bold text-white tracking-tight">{intent.intent}</h2>
                                    <p className="text-slate-500 text-sm font-mono">ID: {intent.id}</p>
                                </div>
                                <div className="flex items-center gap-4">
                                    {intent.steps.length > 1 && (
                                        <div className="flex items-center bg-slate-800/50 rounded-lg p-1 border border-white/5">
                                            <button
                                                onClick={() => {
                                                    setIsPlaybackActive(true);
                                                    setPlaybackIndex(0);
                                                }}
                                                className={cn(
                                                    "px-3 py-1 rounded-md text-xs font-bold transition-all",
                                                    isPlaybackActive ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
                                                )}
                                            >
                                                Playback Mode
                                            </button>
                                            {isPlaybackActive && (
                                                <div className="flex items-center gap-2 px-3 border-l border-white/10 ml-2">
                                                    <button
                                                        disabled={playbackIndex <= 0}
                                                        onClick={() => setPlaybackIndex(prev => prev - 1)}
                                                        className="text-slate-400 hover:text-white disabled:opacity-30"
                                                    >
                                                        Prev
                                                    </button>
                                                    <span className="text-[10px] font-mono text-blue-400 w-8 text-center">{playbackIndex + 1}/{intent.steps.length}</span>
                                                    <button
                                                        disabled={playbackIndex >= intent.steps.length - 1}
                                                        onClick={() => setPlaybackIndex(prev => prev + 1)}
                                                        className="text-slate-400 hover:text-white disabled:opacity-30"
                                                    >
                                                        Next
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setIsPlaybackActive(false);
                                                            setPlaybackIndex(-1);
                                                        }}
                                                        className="ml-2 text-red-400 hover:text-red-300"
                                                    >
                                                        Exit
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <div className="px-3 py-1 bg-blue-500/10 text-blue-400 rounded-full text-xs font-semibold border border-blue-500/20 uppercase tracking-wider">
                                        {intent.steps.some(s => s.status === 'RUNNING') ? 'Executing' : 'Completed'}
                                    </div>
                                </div>
                            </div>

                            <div className="relative pl-8 space-y-12 border-l border-border/50 translate-x-3">
                                {intent.steps.filter((_, i) => !isPlaybackActive || i === playbackIndex).map((step, idx) => (
                                    <div key={step.id} className="relative group">
                                        {/* Step Icon Node */}
                                        <div className={cn(
                                            "absolute -left-12 top-0 w-8 h-8 rounded-full flex items-center justify-center z-10 border-4 border-background transition-colors duration-500",
                                            step.status === 'COMPLETED' ? "bg-green-500" :
                                                step.status === 'RUNNING' ? "bg-blue-500 animate-pulse" :
                                                    step.status === 'FAILED' ? "bg-red-500" : "bg-slate-800"
                                        )}>
                                            {step.status === 'COMPLETED' ? <CheckCircle2 className="w-4 h-4 text-white" /> :
                                                step.status === 'RUNNING' ? <Zap className="w-4 h-4 text-white" /> :
                                                    step.status === 'FAILED' ? <XCircle className="w-4 h-4 text-white" /> :
                                                        <div className="w-2 h-2 rounded-full bg-slate-400" />}
                                        </div>

                                        <div className="space-y-4">
                                            {/* Reasoning Card */}
                                            {step.thought && (
                                                <div className="flex gap-4 items-start translate-y-1">
                                                    <Eye className="w-5 h-5 text-blue-400/50 mt-1 shrink-0" />
                                                    <div className="glass p-4 rounded-xl text-slate-400 italic text-sm leading-relaxed border-l-2 border-l-blue-500 group-hover:text-slate-300 transition-colors">
                                                        {step.thought}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Action Card */}
                                            <div className="glass rounded-xl overflow-hidden border border-border group-hover:border-border/40 transition-all shadow-lg">
                                                <div className="px-5 py-3 border-b border-border flex items-center justify-between bg-white/[0.01]">
                                                    <div className="flex items-center gap-3">
                                                        <Terminal className="w-4 h-4 text-emerald-400" />
                                                        <span className="font-mono text-sm font-medium text-emerald-400">{step.action}</span>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest leading-none">Step {idx + 1}</span>
                                                </div>
                                                <div className="p-5 overflow-x-auto">
                                                    <pre className="text-xs font-mono text-slate-400">
                                                        {JSON.stringify(step.input, null, 2)}
                                                    </pre>
                                                </div>
                                            </div>

                                            {/* Observation Card */}
                                            {step.status === 'COMPLETED' && (step.observation || step.output) && (
                                                <div className="flex gap-4 items-start">
                                                    <ChevronRight className="w-5 h-5 text-green-400/50 mt-1 shrink-0" />
                                                    <div className="bg-green-500/5 border border-green-500/10 p-4 rounded-xl w-full">
                                                        <div className="text-xs font-bold text-green-500 uppercase mb-2 flex items-center gap-2 tracking-tighter">
                                                            Observation
                                                        </div>
                                                        <div className="text-sm text-slate-300 leading-relaxed font-medium">
                                                            {step.observation || "Operation completed successfully."}
                                                        </div>

                                                        {/* Screenshots Grid */}
                                                        {step.screenshots && step.screenshots.length > 0 && (
                                                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                                {step.screenshots.map((s, si) => (
                                                                    <div key={si} className="relative aspect-video rounded-lg overflow-hidden border border-white/10 group/img bg-slate-900">
                                                                        <img
                                                                            src={s.startsWith('http') || s.startsWith('data:') ? s : `/media/${s}`}
                                                                            alt={`Step ${idx + 1} screenshot ${si + 1}`}
                                                                            className="w-full h-full object-contain transition-transform duration-500 group-hover/img:scale-105"
                                                                        />

                                                                        {/* Coordinate-based Action Marker (UI-TARS style) */}
                                                                        {step.point && (
                                                                            <div
                                                                                className="absolute z-20"
                                                                                style={{
                                                                                    left: `${(step.point.x / 1000) * 100}%`,
                                                                                    top: `${(step.point.y / 1000) * 100}%`,
                                                                                    transform: 'translate(-50%, -50%)'
                                                                                }}
                                                                            >
                                                                                <div className="relative group/marker">
                                                                                    <div className="absolute inset-0 w-8 h-8 -m-4 bg-red-500/40 rounded-full animate-ping" />
                                                                                    <div className="w-4 h-4 bg-red-600 rounded-full border-2 border-white shadow-lg shadow-red-500/50" />

                                                                                    {/* Popover label on hover */}
                                                                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-black/80 backdrop-blur rounded text-[10px] text-white whitespace-nowrap opacity-0 group-hover/marker:opacity-100 transition-opacity z-30 uppercase font-bold tracking-tighter">
                                                                                        {step.actionType || step.action}: [{step.point.x}, {step.point.y}]
                                                                                    </div>

                                                                                    {/* Interaction Zoom (Magnifying Glass) */}
                                                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-32 h-32 rounded-full border-2 border-blue-500 bg-slate-950 shadow-2xl shadow-blue-500/20 overflow-hidden pointer-events-none opacity-0 group-hover/marker:opacity-100 transition-all duration-300 z-50 scale-50 group-hover/marker:scale-100 origin-bottom">
                                                                                        <img
                                                                                            src={s.startsWith('http') || s.startsWith('data:') ? s : `/media/${s}`}
                                                                                            alt="Zoomed"
                                                                                            className="absolute max-w-none"
                                                                                            style={{
                                                                                                width: '800%', // Magnify 8x
                                                                                                left: `${-(step.point.x / 1000) * 800 + 50}%`,
                                                                                                top: `${-(step.point.y / 1000) * 800 + 50}%`,
                                                                                                imageRendering: 'pixelated'
                                                                                            }}
                                                                                        />
                                                                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                                                            <div className="w-full h-[0.5px] bg-red-400 opacity-40" />
                                                                                            <div className="absolute h-full w-[0.5px] bg-red-400 opacity-40" />
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        )}

                                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                                                            <button className="text-white text-xs font-bold uppercase tracking-widest bg-blue-600 px-3 py-1.5 rounded-full shadow-xl transform translate-y-2 group-hover/img:translate-y-0 transition-transform">View Full</button>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}

                                                        {step.output && (
                                                            <div className="mt-4 p-3 bg-black/40 rounded-lg border border-white/5 overflow-x-auto max-h-48">
                                                                <pre className="text-[10px] font-mono text-green-400/80">
                                                                    {JSON.stringify(step.output, null, 2)}
                                                                </pre>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {step.status === 'FAILED' && (
                                                <div className="bg-red-500/10 border border-red-500/20 p-5 rounded-xl text-red-400 flex items-start gap-4">
                                                    <XCircle className="w-5 h-5 shrink-0" />
                                                    <div className="space-y-1">
                                                        <p className="font-bold text-sm">Execution Failed</p>
                                                        <p className="text-sm opacity-80 font-mono break-all">{step.error}</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </main>

            <footer className="h-12 border-t border-border/40 flex items-center px-8 justify-between text-[10px] text-slate-600 font-medium uppercase tracking-widest glass">
                <div>MarketBot v1.0.0-alpha</div>
                <div className="flex gap-4">
                    <a href="#" className="hover:text-slate-400 transition-colors">Documentation</a>
                    <a href="#" className="hover:text-slate-400 transition-colors">Support</a>
                </div>
            </footer>
        </div>
    );
}
