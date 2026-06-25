import { motion } from 'motion/react';
import { Rocket, Activity, ScanFace, ChevronRight, Terminal, Cpu, Zap, Orbit, AlertTriangle, Fingerprint, Waves, BrainCircuit } from 'lucide-react';
import VRWorld from './components/VRWorld';

export default function App() {
  const openSimulator = () => {
    // Open the WebXR simulator in a new tab to ensure immersive permissions are granted natively
    const win = window.open('/simulator.html', '_blank');
    // If the browser popup blocker blocks the new tab (typical inside sandboxed developer previews), navigate inline
    if (!win || win.closed || typeof win.closed === 'undefined') {
       window.location.href = '/simulator.html';
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  } as const;

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
  } as const;

  return (
    <div className="min-h-screen bg-slate-900 text-gray-200 font-sans selection:bg-neon-orange selection:text-white pb-20 overflow-x-hidden">
      {/* Dynamic Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-neon-orange/5 rounded-full blur-[120px]" />
        <div className="absolute top-[40%] right-[-10%] w-[40%] h-[60%] bg-neon-cyan/5 rounded-full blur-[100px]" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
      </div>

      {/* Header */}
      <header className="glass-panel sticky top-0 z-50 px-6 py-4 border-b border-white/10 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-neon-orange/10 border border-neon-orange/30 rounded-md">
            <Orbit className="text-neon-orange w-5 h-5" />
          </div>
          <div>
             <h1 className="font-display font-bold text-lg tracking-tight leading-none">Multiverse Academy</h1>
             <p className="font-mono text-[10px] text-neon-cyan uppercase tracking-wider mt-1">Ground Control System</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-2 font-mono text-xs text-white/50 bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
             <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             Core Engine Online
           </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 pt-16 relative z-10">
        <motion.div 
          className="text-center max-w-3xl mx-auto mb-16"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <div className="inline-flex items-center gap-2 font-mono text-xs text-neon-orange border border-neon-orange/20 bg-neon-orange/5 px-4 py-1.5 rounded-full mb-6 uppercase tracking-widest">
            <Activity className="w-3.5 h-3.5" />
            Project MVP-3 Ready
          </div>
          <h2 className="font-display text-5xl md:text-6xl font-bold tracking-tighter mb-6 text-white text-balance">
            Mixed Reality <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-orange to-red-600">Drone Physics</span> & Synthesis.
          </h2>
          <p className="text-lg text-gray-400 font-medium leading-relaxed mb-10 max-w-2xl mx-auto">
            A specialized educational sandbox bridging fluid drone dynamics, 
            generative techno sequencing, and AI-driven spatial optical targeting directly in your browser.
          </p>

          <button 
            onClick={openSimulator}
            className="group relative inline-flex items-center gap-4 bg-white text-black px-8 py-4 rounded-xl font-display font-bold text-lg tracking-wide hover:shadow-[0_0_40px_rgba(255,255,255,0.3)] transition-all duration-300 transform hover:-translate-y-1"
          >
            INITIALIZE SIMULATOR
            <span className="bg-black/10 p-1.5 rounded-lg group-hover:bg-black/20 transition-colors">
               <ChevronRight className="w-5 h-5" />
            </span>
            <div className="absolute inset-0 rounded-xl border border-white/50 group-hover:scale-105 opacity-0 group-hover:opacity-100 transition-transform duration-300 pointer-events-none" />
          </button>
          
          <p className="font-mono text-xs text-gray-500 mt-6 inline-flex border border-white/10 bg-white/5 px-4 py-2 rounded-md mb-8">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Hardware Warning: Immersive WebXR requires Chrome on Android or Meta Quest Browser. 
            Fallback controls: WASD / Arrows.
          </p>

          <VRWorld />
        </motion.div>

        {/* Phase 1 / Current MVP Features */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12"
        >
          <motion.div variants={itemVariants} className="glass-panel p-8 rounded-3xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-neon-cyan/10 rounded-full blur-[40px] group-hover:bg-neon-cyan/20 transition-colors" />
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex justify-center items-center mb-6">
              <Rocket className="w-6 h-6 text-neon-cyan" />
            </div>
            <h3 className="font-display text-xl font-bold mb-3 text-white">Flight Dynamics</h3>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">
              Master Newtonian drone physics using native spatial pinch-and-drag gestures. The flight controller maps 6DOF inputs directly to thrust vectors.
            </p>
            <div className="font-mono text-[11px] text-gray-500 uppercase tracking-widest pt-4 border-t border-white/10">
              Module 01 // Mechanics
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="glass-panel p-8 rounded-3xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-neon-orange/10 rounded-full blur-[40px] group-hover:bg-neon-orange/20 transition-colors" />
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex justify-center items-center mb-6">
              <Zap className="w-6 h-6 text-neon-orange" />
            </div>
            <h3 className="font-display text-xl font-bold mb-3 text-white">Flight-to-Techno Sync</h3>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">
              Learn audio synthesis by flying. Altitude controls master filters, throttle ramps BPM, and yaw interpolates hat decays for generative compositions.
            </p>
            <div className="font-mono text-[11px] text-gray-500 uppercase tracking-widest pt-4 border-t border-white/10">
              Module 02 // Sequencing
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="glass-panel p-8 rounded-3xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-[40px] group-hover:bg-purple-500/20 transition-colors" />
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex justify-center items-center mb-6">
              <ScanFace className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="font-display text-xl font-bold mb-3 text-white">Spatial AI Targeting</h3>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">
              Activate the scanner to route your forward camera feed into the Gemini LLM. Understand real-world object detection and tactical contextualization.
            </p>
            <div className="font-mono text-[11px] text-gray-500 uppercase tracking-widest pt-4 border-t border-white/10">
              Module 03 // Intelligence
            </div>
          </motion.div>
        </motion.div>

        {/* Phase 2 / Advanced Architectures Section */}
        <motion.div 
          className="mb-8 flex items-center gap-4"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          <div className="h-px bg-white/10 flex-1" />
          <h3 className="font-mono text-sm tracking-widest uppercase text-gray-500">Phase 2 Capabilities (In Development)</h3>
          <div className="h-px bg-white/10 flex-1" />
        </motion.div>

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16"
        >
          <motion.div variants={itemVariants} className="glass-panel p-6 rounded-2xl relative overflow-hidden group border-white/5">
            <Fingerprint className="w-5 h-5 text-gray-500 mb-4" />
            <h4 className="font-display text-lg font-bold mb-2 text-gray-300">Kinetic Flight (Telekinesis)</h4>
            <p className="text-gray-500 text-xs leading-relaxed">
              Bypass RC joysticks. Use proportional PID controllers to physically drag and anchor the drone through 3D space with an open palm gesture.
            </p>
          </motion.div>

          <motion.div variants={itemVariants} className="glass-panel p-6 rounded-2xl relative overflow-hidden group border-white/5">
            <Waves className="w-5 h-5 text-gray-500 mb-4" />
            <h4 className="font-display text-lg font-bold mb-2 text-gray-300">3D Ambisonic Audio</h4>
            <p className="text-gray-500 text-xs leading-relaxed">
              Upgrade the Web Audio API graph with true HRTF (Head-Related Transfer Function) spatial panning, tying synth stems directly to real-world drone coordinates.
            </p>
          </motion.div>

          <motion.div variants={itemVariants} className="glass-panel p-6 rounded-2xl relative overflow-hidden group border-white/5">
            <BrainCircuit className="w-5 h-5 text-gray-500 mb-4" />
            <h4 className="font-display text-lg font-bold mb-2 text-gray-300">Gemini Live Co-Pilot</h4>
            <p className="text-gray-500 text-xs leading-relaxed">
              Transition from static LLM API calls to continuous WebRTC streaming. Talk directly to your drone for conversational flight assistance and generative dynamic swarming.
            </p>
          </motion.div>
        </motion.div>

        {/* Console / Terminal Section */}
        <motion.div 
          className="glass-panel rounded-3xl p-6"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
             <div className="flex items-center gap-3">
               <Cpu className="w-5 h-5 text-gray-400" />
               <span className="font-display font-medium text-white">System Architecture Overview</span>
             </div>
             <div className="flex gap-2">
                <span className="w-3 h-3 rounded-full border border-white/20 bg-emerald-500/20" />
                <span className="w-3 h-3 rounded-full border border-white/20 bg-amber-500/20" />
                <span className="w-3 h-3 rounded-full border border-white/20 bg-rose-500/20" />
             </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
            <div>
              <h4 className="text-gray-300 font-bold mb-3 font-mono flex items-center gap-2">
                 <Terminal className="w-4 h-4 text-neon-cyan" /> 
                 Tech Stack
              </h4>
              <ul className="space-y-2 text-gray-400 font-mono text-[13px]">
                <li><span className="text-neon-cyan">const</span> framework = "React 19 + Vite";</li>
                <li><span className="text-neon-cyan">const</span> styles = "Tailwind v4";</li>
                <li><span className="text-neon-cyan">const</span> engine = "Three.js + XRBlocks";</li>
                <li><span className="text-neon-cyan">const</span> intelligence = "@google/genai";</li>
              </ul>
            </div>
            <div>
              <h4 className="text-gray-300 font-bold mb-3 font-mono flex items-center gap-2">
                 <ScanFace className="w-4 h-4 text-neon-orange" />
                 Backend Routing
              </h4>
              <ul className="space-y-2 text-gray-400 font-mono text-[13px]">
                <li><span className="text-neon-orange">POST</span> /api/scan</li>
                <li className="pl-4 border-l border-white/10 ml-2 py-1">Accepts: `image/jpeg` feed</li>
                <li className="pl-4 border-l border-white/10 ml-2 py-1">Integrates: `gemini-3.5-flash`</li>
                <li className="pl-4 border-l border-white/10 ml-2 py-1">Returns: Spatial tactics JSON</li>
              </ul>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
