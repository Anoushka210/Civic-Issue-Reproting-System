import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Cpu, 
  Layers, 
  Grid, 
  Play, 
  Pause, 
  RotateCcw, 
  Info, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  Eye, 
  Sliders,
  ShieldCheck,
  Building2,
  ChevronRight
} from 'lucide-react';
import type { MLPredictionResponse, CNNClass } from '../../types/civic';
import { CNN_CLASS_LABELS, DEPARTMENT_MAPPINGS } from '../../types/civic';
import { cn } from '../../lib/utils';

export interface CNNVisualizationProps {
  mode: 'citizen' | 'admin';
  prediction?: MLPredictionResponse | null;
  imageUrl?: string | null;
  defaultExpanded?: boolean;
  className?: string;
}

// 4 Supported Civic Defect Classes
const MODEL_CLASSES: CNNClass[] = ['potholes', 'garbage', 'streetlight', 'water_leakage'];

// Class Meta Information
const CLASS_META: Record<CNNClass, { icon: string; name: string; dept: string; demoProb: number }> = {
  potholes: { 
    icon: '🕳️', 
    name: 'Potholes', 
    dept: 'Roads & Infrastructure',
    demoProb: 99.8 
  },
  water_leakage: { 
    icon: '💧', 
    name: 'Water Leakage', 
    dept: 'Water Supply',
    demoProb: 0.2 
  },
  garbage: { 
    icon: '🗑️', 
    name: 'Garbage Overflow', 
    dept: 'Sanitation',
    demoProb: 0.0 
  },
  streetlight: { 
    icon: '💡', 
    name: 'Broken Streetlight', 
    dept: 'Electricity',
    demoProb: 0.0 
  },
};

// Permanent demonstration image path committed to project assets
const DEMO_IMAGE_PATH = '/images/cnn-demo-pothole.jpg';

// Six-step sequence definition
export type AnimationStep = 1 | 2 | 3 | 4 | 5 | 6;

const STEP_INFO: Record<AnimationStep, { title: string; subtitle: string; duration: number }> = {
  1: { 
    title: '1. Original Image', 
    subtitle: 'High-resolution photo of street pothole in wet weather without overlays', 
    duration: 2500 
  },
  2: { 
    title: '2. Pixel Grid', 
    subtitle: 'Discretizing continuous visual data into a normalized numerical pixel matrix', 
    duration: 2000 
  },
  3: { 
    title: '3. Convolution Scan', 
    subtitle: '3×3 kernel sliding across the image to extract local visual edges and textures', 
    duration: 3500 
  },
  4: { 
    title: '4. Feature Extraction', 
    subtitle: 'Hierarchical transformation through early edges, mid parts, and deep semantic features', 
    duration: 2800 
  },
  5: { 
    title: '5. Classification', 
    subtitle: 'Global Average Pooling and Softmax activation across the 4 trained civic classes', 
    duration: 2400 
  },
  6: { 
    title: '6. Detection Result', 
    subtitle: 'Verified classification held before seamless continuous loop restart', 
    duration: 3200 
  },
};

// Key scan coordinates across the image during Step 3
const SCAN_COORDINATES = [
  { x: 18, y: 30, label: 'Street Background' },
  { x: 38, y: 48, label: 'Asphalt Transition' },
  { x: 52, y: 64, label: 'Water Pothole Cavity' },
  { x: 74, y: 70, label: 'Pavement Texture' },
];

export default function CNNVisualization({
  mode,
  prediction,
  imageUrl,
  defaultExpanded = true,
  className
}: CNNVisualizationProps) {
  // Use the permanent uploaded photograph by default, or an explicitly passed image
  const displayImage = imageUrl || DEMO_IMAGE_PATH;

  // Animation cycle state — plays continuously by default
  const [currentStep, setCurrentStep] = useState<AnimationStep>(1);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);
  
  // Sub-states for specific steps
  const [scanIndex, setScanIndex] = useState<number>(0);
  const [featureTier, setFeatureTier] = useState<1 | 2 | 3>(1);

  // Accessibility: motion preference
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);

  // References for reliable timer cleanup
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const scanTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-detect reduced-motion system settings
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (mediaQuery.matches) setReducedMotion(true);
      const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, []);

  // Clear all running timers cleanly
  const clearAllTimers = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (scanTimerRef.current) {
      clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
  }, []);

  // Step 3 scanning sub-timer
  useEffect(() => {
    if (currentStep === 3 && isPlaying && !reducedMotion) {
      setScanIndex(0);
      scanTimerRef.current = setInterval(() => {
        setScanIndex(prev => (prev + 1) % SCAN_COORDINATES.length);
      }, 750);
    } else {
      if (scanTimerRef.current) {
        clearInterval(scanTimerRef.current);
        scanTimerRef.current = null;
      }
    }

    return () => {
      if (scanTimerRef.current) {
        clearInterval(scanTimerRef.current);
        scanTimerRef.current = null;
      }
    };
  }, [currentStep, isPlaying, reducedMotion]);

  // Step 4 feature tier cycling sub-timer
  useEffect(() => {
    if (currentStep === 4 && isPlaying && !reducedMotion) {
      setFeatureTier(1);
      const t1 = setTimeout(() => setFeatureTier(2), 900);
      const t2 = setTimeout(() => setFeatureTier(3), 1800);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [currentStep, isPlaying, reducedMotion]);

  // Continuous main loop scheduler
  useEffect(() => {
    clearAllTimers();

    if (!isPlaying) return;

    const stepDuration = reducedMotion ? 3000 : STEP_INFO[currentStep].duration;

    timerRef.current = setTimeout(() => {
      setCurrentStep(prev => {
        if (prev === 6) {
          // Smooth seamless restart to step 1
          setScanIndex(0);
          setFeatureTier(1);
          return 1;
        }
        return (prev + 1) as AnimationStep;
      });
    }, stepDuration);

    return () => clearAllTimers();
  }, [currentStep, isPlaying, reducedMotion, clearAllTimers]);

  // Cleanup on unmount or navigation away
  useEffect(() => {
    return () => clearAllTimers();
  }, [clearAllTimers]);

  // Control handlers
  const handleTogglePlay = () => {
    setIsPlaying(prev => !prev);
  };

  const handleReplay = () => {
    clearAllTimers();
    setScanIndex(0);
    setFeatureTier(1);
    setCurrentStep(1);
    setIsPlaying(true);
  };

  const handleJumpToStep = (step: AnimationStep) => {
    clearAllTimers();
    setCurrentStep(step);
    setIsPlaying(false); // Pauses on manual inspection so user can review
  };

  // Check if real inference results were passed via props
  const hasRealPrediction = Boolean(
    prediction && 
    prediction.predicted_class && 
    prediction.probabilities &&
    typeof prediction.confidence_percent === 'number'
  );

  return (
    <div className={cn(
      "rounded-2xl border transition-all duration-300 font-sans overflow-hidden",
      mode === 'admin' 
        ? "bg-slate-900 border-slate-700/80 text-white shadow-xl" 
        : "bg-white border-slate-200/90 text-slate-800 shadow-md",
      className
    )}>
      {/* 1. Header Bar with Mode Distinction & Status */}
      <div className={cn(
        "px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b",
        mode === 'admin' ? "border-slate-800 bg-slate-900/90" : "border-slate-100 bg-slate-50/70"
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs",
            mode === 'admin' 
              ? "bg-blue-600/20 text-blue-400 border border-blue-500/30" 
              : "bg-blue-700 text-white shadow-blue-700/20"
          )}>
            <Cpu size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className={cn(
                "text-sm sm:text-base font-black tracking-tight",
                mode === 'admin' ? "text-white" : "text-slate-900"
              )}>
                {mode === 'admin' 
                  ? 'MobileNetV2 CNN Interactive Pipeline Explorer' 
                  : 'How Our AI Works — Interactive CNN Demonstration'}
              </h3>
              <span className={cn(
                "hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                mode === 'admin'
                  ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                  : "bg-blue-50 text-blue-700 border border-blue-200"
              )}>
                Continuous Loop
              </span>
            </div>
            <p className={cn(
              "text-xs font-medium mt-0.5",
              mode === 'admin' ? "text-slate-400" : "text-slate-500"
            )}>
              Continuous 6-phase visual explanation of convolutional feature extraction and civic issue classification.
            </p>
          </div>
        </div>

        {/* Live Loop Status Indicator */}
        <div className="flex items-center gap-3 self-start sm:self-auto shrink-0">
          <div className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold",
            isPlaying 
              ? (mode === 'admin' ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : "bg-emerald-50 text-emerald-700 border border-emerald-200")
              : (mode === 'admin' ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" : "bg-amber-50 text-amber-700 border border-amber-200")
          )}>
            <span className={cn(
              "w-2 h-2 rounded-full",
              isPlaying ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
            )} />
            <span>{isPlaying ? 'Loop Playing' : 'Paused'}</span>
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className={cn(
              "text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors",
              mode === 'admin' ? "border-slate-700 bg-slate-800 text-slate-300 hover:text-white" : "border-slate-200 bg-white text-slate-600 hover:text-slate-900"
            )}
          >
            {isExpanded ? 'Hide' : 'Expand'}
          </button>
        </div>
      </div>

      {/* 2. Interactive Body */}
      {isExpanded && (
        <div className="p-6 space-y-6">
          {/* Controls Bar: Step Timeline, Play/Pause, Replay & Motion */}
          <div className={cn(
            "p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-3 border",
            mode === 'admin' ? "bg-slate-800/80 border-slate-700/60" : "bg-slate-50 border-slate-200"
          )}>
            {/* Step Indicators (1 to 6) */}
            <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
              {([1, 2, 3, 4, 5, 6] as AnimationStep[]).map(s => {
                const isCurrent = currentStep === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleJumpToStep(s)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1",
                      isCurrent
                        ? (mode === 'admin' ? "bg-blue-600 text-white shadow-xs" : "bg-blue-700 text-white shadow-xs")
                        : (mode === 'admin' ? "text-slate-400 hover:text-white hover:bg-slate-700/50" : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/70")
                    )}
                    aria-label={`Jump to step ${s}: ${STEP_INFO[s].title}`}
                  >
                    <span>{s}.</span>
                    <span className="hidden md:inline">{STEP_INFO[s].title.split('. ')[1]}</span>
                  </button>
                );
              })}
            </div>

            {/* Playback Controls: Pause/Play, Replay, Motion */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTogglePlay}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs",
                  isPlaying 
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30"
                    : (mode === 'admin' ? "bg-blue-600 hover:bg-blue-500 text-white" : "bg-blue-700 hover:bg-blue-800 text-white")
                )}
                title={isPlaying ? "Pause continuous animation" : "Resume continuous animation"}
              >
                {isPlaying ? <Pause size={13} /> : <Play size={13} />}
                <span>{isPlaying ? 'Pause' : 'Play'}</span>
              </button>

              <button
                type="button"
                onClick={handleReplay}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                  mode === 'admin' 
                    ? "bg-slate-700/80 border-slate-600 text-slate-200 hover:bg-slate-700 hover:text-white" 
                    : "bg-white border-slate-300 text-slate-700 hover:bg-slate-100"
                )}
                title="Restart continuous cycle from Step 1"
              >
                <RotateCcw size={13} />
                <span>Replay</span>
              </button>

              <button
                type="button"
                onClick={() => setReducedMotion(!reducedMotion)}
                className={cn(
                  "hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors border",
                  reducedMotion 
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" 
                    : (mode === 'admin' ? "border-slate-700 text-slate-400 hover:text-slate-200" : "border-slate-300 text-slate-500 hover:text-slate-800")
                )}
                title="Toggle reduced motion static mode"
              >
                <Sliders size={12} />
                <span>{reducedMotion ? 'Static Mode' : 'Animation On'}</span>
              </button>
            </div>
          </div>

          {/* Current Step Description Card */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-xs font-black uppercase tracking-wider text-blue-500">
                  Step {currentStep} of 6 • {STEP_INFO[currentStep].title.split('. ')[1]}
                </span>
              </div>
              <p className={cn(
                "text-xs sm:text-sm font-medium mt-0.5",
                mode === 'admin' ? "text-slate-300" : "text-slate-600"
              )}>
                {STEP_INFO[currentStep].subtitle}
              </p>
            </div>
            
            <div className="hidden sm:block text-right">
              <span className="text-[11px] font-mono text-slate-400">
                Cycle: ~16s Continuous Loop
              </span>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* MAIN TWO-COLUMN STAGE: PHOTO CANVAS (LEFT) & MODEL METRICS (RIGHT)       */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* LEFT COLUMN: THE PHOTOGRAPHIC DEMONSTRATION CANVAS */}
            <div className="lg:col-span-7 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold flex items-center gap-1.5">
                  <Eye size={14} className="text-blue-500" />
                  <span>Input Evidence Photo (Preserved 759×422 Aspect Ratio)</span>
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  public/images/cnn-demo-pothole.jpg
                </span>
              </div>

              {/* Photographic Stage Canvas with Preserved Aspect Ratio */}
              <div className="relative aspect-[759/422] w-full rounded-2xl overflow-hidden border border-slate-300 dark:border-slate-700 bg-slate-950 shadow-lg select-none">
                {/* 1. Underlying Permanent Pothole Photograph */}
                <img
                  src={displayImage}
                  alt="Civic Pothole Defect Permanent Demonstration"
                  className="w-full h-full object-cover transition-all duration-700 block"
                />

                {/* 2. STEP 2 OVERLAY: Translucent Pixel Discretization Grid */}
                {(currentStep >= 2 && currentStep <= 5) && (
                  <div className={cn(
                    "absolute inset-0 pointer-events-none transition-opacity duration-700",
                    currentStep === 2 ? "opacity-75" : "opacity-35"
                  )}>
                    {/* SVG Grid Overlay */}
                    <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <pattern id="pixelGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(56, 189, 248, 0.45)" strokeWidth="0.8" />
                          <circle cx="0" cy="0" r="1.5" fill="rgba(56, 189, 248, 0.8)" />
                        </pattern>
                      </defs>
                      <rect width="100%" height="100%" fill="url(#pixelGrid)" />
                    </svg>

                    <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-slate-900/80 backdrop-blur-xs text-[10px] font-mono text-cyan-300 border border-cyan-500/30">
                      Discretized 224×224 Input Tensor Grid
                    </div>
                  </div>
                )}

                {/* 3. STEP 3 OVERLAY: Animated Sliding Convolution Kernel Window */}
                {currentStep === 3 && (
                  <div className="absolute inset-0 pointer-events-none">
                    {/* Animated Scanning Box */}
                    <div 
                      className={cn(
                        "absolute w-24 h-24 rounded-lg border-2 border-cyan-400 bg-cyan-400/20 shadow-xl shadow-cyan-500/40 transition-all duration-500 flex flex-col justify-between p-1.5",
                        reducedMotion ? "transition-none" : ""
                      )}
                      style={{
                        left: `${SCAN_COORDINATES[scanIndex].x}%`,
                        top: `${SCAN_COORDINATES[scanIndex].y}%`,
                        transform: 'translate(-50%, -50%)',
                      }}
                    >
                      <div className="flex items-center justify-between text-[8px] font-mono font-bold text-cyan-200">
                        <span>┌ 3×3</span>
                        <span>┐</span>
                      </div>
                      <div className="text-center font-mono font-extrabold text-[9px] text-white bg-slate-900/80 px-1 py-0.5 rounded border border-cyan-400/40">
                        W · X + b
                      </div>
                      <div className="flex items-center justify-between text-[8px] font-mono font-bold text-cyan-200">
                        <span>└ KERNEL</span>
                        <span>┘</span>
                      </div>
                    </div>

                    {/* Inspection Point Callout */}
                    <div className="absolute top-2 right-2 px-2.5 py-1 rounded bg-slate-900/90 backdrop-blur-xs text-[10px] font-bold text-cyan-300 border border-cyan-400/50 flex items-center gap-1.5">
                      <Sparkles size={11} className="text-cyan-400 animate-spin" />
                      <span>Scanning: {SCAN_COORDINATES[scanIndex].label}</span>
                    </div>
                  </div>
                )}

                {/* 4. STEP 4 OVERLAY: Multi-tier Feature Representations */}
                {currentStep === 4 && (
                  <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs p-5 flex flex-col justify-between animate-in fade-in duration-500">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                      <span>Feature Pyramid Abstraction</span>
                      <span className="font-mono text-cyan-400">MobileNetV2 Depthwise Inverted Residuals</span>
                    </div>

                    <div className="grid grid-cols-3 gap-3 my-auto">
                      <div className={cn(
                        "p-3 rounded-xl border text-center transition-all",
                        featureTier === 1 ? "bg-blue-500/30 border-blue-400 shadow-md scale-102" : "bg-white/5 border-white/10 opacity-70"
                      )}>
                        <p className="text-[10px] font-mono uppercase text-blue-400 font-bold">Tier 1 • 112×112</p>
                        <p className="text-xs font-black text-white mt-1">Edges & Cracks</p>
                        <p className="text-[9px] text-slate-300 mt-1">Spatial gradients and road surface contrasts</p>
                      </div>

                      <div className={cn(
                        "p-3 rounded-xl border text-center transition-all",
                        featureTier === 2 ? "bg-amber-500/30 border-amber-400 shadow-md scale-102" : "bg-white/5 border-white/10 opacity-70"
                      )}>
                        <p className="text-[10px] font-mono uppercase text-amber-400 font-bold">Tier 2 • 28×28</p>
                        <p className="text-xs font-black text-white mt-1">Cavity Shapes</p>
                        <p className="text-[9px] text-slate-300 mt-1">Depression contours & water pooling boundaries</p>
                      </div>

                      <div className={cn(
                        "p-3 rounded-xl border text-center transition-all",
                        featureTier === 3 ? "bg-emerald-500/30 border-emerald-400 shadow-md scale-102" : "bg-white/5 border-white/10 opacity-70"
                      )}>
                        <p className="text-[10px] font-mono uppercase text-emerald-400 font-bold">Tier 3 • 7×7 → 1280</p>
                        <p className="text-xs font-black text-white mt-1">Semantic Defect</p>
                        <p className="text-[9px] text-slate-300 mt-1">Global 1280-element pooled defect descriptor</p>
                      </div>
                    </div>

                    <div className="text-[10px] text-center text-slate-400 italic">
                      Conceptual representation of progressive downsampling through MobileNetV2 inverted residual blocks
                    </div>
                  </div>
                )}

                {/* 5. STEP 6 OVERLAY: Hold the Result — Prominent "POTHOLE DETECTED" Classification Label */}
                {currentStep === 6 && (
                  <div className="absolute inset-0 pointer-events-none bg-slate-950/40 backdrop-blur-[2px] flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-500">
                    <div className="bg-slate-900/95 border-2 border-emerald-500 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 max-w-md w-full">
                      <div className="w-12 h-12 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black text-2xl shrink-0 shadow-lg shadow-emerald-500/40">
                        ✓
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                            Classification Verified
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            99.8% Match
                          </span>
                        </div>
                        <h4 className="text-xl font-display font-black tracking-tight text-white mt-0.5">
                          POTHOLE DETECTED
                        </h4>
                        <p className="text-xs text-slate-300 mt-0.5">
                          Dispatch: <strong className="text-emerald-300 font-bold">Roads & Infrastructure Department</strong>
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Mandatory Disclosure / Disclaimers */}
              <div className="flex items-start gap-1.5 text-[11px] text-slate-400 leading-normal pt-1">
                <Info size={13} className="text-blue-500 shrink-0 mt-0.5" />
                <span>
                  Permanent Demonstration: Uses the official pothole photograph committed at <code className="text-[10px] font-mono px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">public/images/cnn-demo-pothole.jpg</code> without issuing duplicate API calls.
                </span>
              </div>
            </div>

            {/* RIGHT COLUMN: 4-CLASS PROBABILITIES & ARCHITECTURAL BREAKDOWN */}
            <div className="lg:col-span-5 space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-emerald-500" />
                  <span>Softmax Output Distribution (4 Classes)</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {hasRealPrediction ? 'Real Inference Mode' : 'Demonstration Mode'}
                </span>
              </div>

              {/* Status Banner */}
              {hasRealPrediction ? (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between text-xs text-emerald-400">
                  <span className="flex items-center gap-1.5 font-bold">
                    <CheckCircle2 size={14} />
                    <span>Real Model Inference Active</span>
                  </span>
                  <span className="font-mono bg-emerald-500/20 px-2 py-0.5 rounded text-emerald-300">
                    Confidence: {prediction?.confidence_percent?.toFixed(1)}%
                  </span>
                </div>
              ) : (
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center gap-2 text-xs text-blue-400">
                  <Info size={14} className="shrink-0" />
                  <span className="text-[11px] leading-relaxed">
                    <strong>Illustrative demonstration values:</strong> Demonstrates the 4-class MobileNetV2 architecture without calling the ML server on loop.
                  </span>
                </div>
              )}

              {/* The Four Civic Issue Classes with Animated Probability Bars */}
              <div className="space-y-2.5">
                {MODEL_CLASSES.map(cls => {
                  const meta = CLASS_META[cls];
                  
                  // Compute probability: use real if supplied, otherwise demo values
                  let prob = meta.demoProb;
                  if (hasRealPrediction && prediction?.probabilities) {
                    const raw = prediction.probabilities[cls] ?? 0;
                    prob = raw > 1 ? raw : raw * 100;
                  }

                  // Determine active highlighting based on current step
                  const isTop = cls === 'potholes';
                  const showActiveBars = currentStep >= 5;

                  return (
                    <div
                      key={cls}
                      className={cn(
                        "p-3 rounded-xl border transition-all duration-500",
                        (isTop && showActiveBars)
                          ? (mode === 'admin' ? "bg-emerald-950/40 border-emerald-500/80 shadow-md shadow-emerald-500/10" : "bg-emerald-50/70 border-emerald-500 shadow-md shadow-emerald-500/10")
                          : (mode === 'admin' ? "bg-slate-800/40 border-slate-700/70" : "bg-white border-slate-200")
                      )}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{meta.icon}</span>
                          <div>
                            <span className="font-bold text-xs block leading-tight">
                              {meta.name}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Dept: {meta.dept}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className={cn(
                            "font-mono font-bold text-sm block leading-tight transition-colors",
                            (isTop && showActiveBars)
                              ? "text-emerald-400" 
                              : (mode === 'admin' ? "text-slate-300" : "text-slate-700")
                          )}>
                            {showActiveBars ? `${prob.toFixed(1)}%` : '— %'}
                          </span>
                          {(isTop && showActiveBars) && (
                            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400">
                              Detected Defect
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className={cn(
                        "h-2 rounded-full overflow-hidden",
                        mode === 'admin' ? "bg-white/10" : "bg-slate-100"
                      )}>
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-700",
                            (isTop && showActiveBars) ? "bg-emerald-500" : "bg-blue-500"
                          )}
                          style={{ 
                            width: showActiveBars ? `${Math.min(100, Math.max(0, prob))}%` : '0%' 
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Explanatory Pipeline Box */}
              <div className={cn(
                "p-3.5 rounded-xl text-xs space-y-1.5 border",
                mode === 'admin' ? "bg-slate-800/60 border-slate-700/80 text-slate-300" : "bg-blue-50/60 border-blue-200/60 text-slate-700"
              )}>
                <div className="flex items-center gap-1.5 font-bold text-blue-400">
                  <Building2 size={13} />
                  <span>Automated Municipal Routing</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  When a civic photo is classified, the highest-probability class directly maps to the responsible city department:
                  <strong> Potholes → Roads & Infrastructure</strong>, triggering automatic work order dispatch and field crew assignment.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
