import { useState, useEffect, useRef, useCallback } from "react";
import Webcam from "react-webcam";
import { motion, AnimatePresence } from "framer-motion";
import { getRhumbLineBearing, getDistance } from "geolib";
import { TreeDeciduous, Dog, Bird, Leaf, X, CameraOff, MapPin, CheckCircle2, Trophy, Clock, Target, Camera, BarChart3, TrendingUp, History, Sprout, Footprints } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Checkpoint } from "@shared/schema";

const STATIONARY_AVATARS = [TreeDeciduous, Sprout, Leaf];
const ROVING_AVATARS = [Dog, Bird, Footprints];

const getAvatar = (id: number, isRoving: boolean) => {
  if (isRoving) {
    const Icon = ROVING_AVATARS[id % ROVING_AVATARS.length];
    return <Icon className="w-10 h-10 text-white" />;
  }
  const Icon = STATIONARY_AVATARS[id % STATIONARY_AVATARS.length];
  return <Icon className="w-10 h-10 text-white" />;
};

interface ARViewProps {
  checkpoints: (Checkpoint & { distance?: number })[];
  userLat: number;
  userLng: number;
  score: number;
  timeRemaining: number | null;
  onCheckpointTap: (checkpoint: Checkpoint) => void;
  onClose: () => void;
}

interface DeviceOrientation {
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
}

export function ARView({ checkpoints: initialCheckpoints, userLat, userLng, score, timeRemaining, onCheckpointTap, onClose }: ARViewProps) {
  const [checkpoints, setCheckpoints] = useState(initialCheckpoints);
  const [cameraPermission, setCameraPermission] = useState<"granted" | "denied" | "prompt">("prompt");
  const [deviceOrientation, setDeviceOrientation] = useState<DeviceOrientation>({ alpha: null, beta: null, gamma: null });
  const [compassHeading, setCompassHeading] = useState<number>(0);
  const [tappingCheckpoint, setTappingCheckpoint] = useState<number | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [showGallery, setShowGallery] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [totalDistance, setTotalDistance] = useState(0);
  const lastLocation = useRef<{ lat: number; lng: number } | null>(null);
  const webcamRef = useRef<Webcam>(null);

  useEffect(() => {
    setCheckpoints(initialCheckpoints);
  }, [initialCheckpoints]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCheckpoints(prev => prev.map(cp => {
        if (!cp.isRoving || cp.collected) return cp;
        const drift = 0.00001;
        const newLat = cp.lat + (Math.random() - 0.5) * drift;
        const newLng = cp.lng + (Math.random() - 0.5) * drift;
        return { ...cp, lat: newLat, lng: newLng };
      }));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (userLat && userLng) {
      if (lastLocation.current) {
        const d = getDistance(
          { latitude: lastLocation.current.lat, longitude: lastLocation.current.lng },
          { latitude: userLat, longitude: userLng }
        );
        if (d > 0.5) {
          setTotalDistance(prev => prev + d);
        }
      }
      lastLocation.current = { lat: userLat, lng: userLng };
    }
  }, [userLat, userLng]);

  const capturePhoto = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        setPhotos(prev => [imageSrc, ...prev]);
        const flash = document.createElement("div");
        flash.className = "fixed inset-0 bg-white z-[100] animate-out fade-out duration-300";
        document.body.appendChild(flash);
        setTimeout(() => flash.remove(), 300);
      }
    }
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const accuracy = Math.round((checkpoints.filter(cp => cp.collected).length / checkpoints.length) * 100) || 0;
  const remainingCount = checkpoints.filter(cp => !cp.collected).length;

  useEffect(() => {
    const handleOrientation = (event: DeviceOrientationEvent) => {
      setDeviceOrientation({ alpha: event.alpha, beta: event.beta, gamma: event.gamma });
      if (event.alpha !== null) {
        let heading = event.alpha;
        if ((event as any).webkitCompassHeading !== undefined) {
          heading = (event as any).webkitCompassHeading;
        } else {
          heading = 360 - event.alpha;
        }
        setCompassHeading(heading);
      }
    };
    if (typeof DeviceOrientationEvent !== "undefined" && typeof (DeviceOrientationEvent as any).requestPermission === "function") {
      (DeviceOrientationEvent as any).requestPermission().then((response: string) => {
        if (response === "granted") window.addEventListener("deviceorientation", handleOrientation as any, true);
      }).catch(err => console.error(err));
    } else {
      window.addEventListener("deviceorientation", handleOrientation as any, true);
    }
    return () => window.removeEventListener("deviceorientation", handleOrientation as any, true);
  }, []);

  const handleUserMedia = useCallback(() => setCameraPermission("granted"), []);
  const handleUserMediaError = useCallback((error: any) => setCameraPermission("denied"), []);

  const handleTap = (cp: Checkpoint) => {
    if (cp.collected) return;
    setTappingCheckpoint(cp.id);
    setTimeout(() => {
      onCheckpointTap(cp);
      setTappingCheckpoint(null);
    }, 600);
  };

  const getCheckpointScreenPosition = (cp: Checkpoint) => {
    const bearing = getRhumbLineBearing({ latitude: userLat, longitude: userLng }, { latitude: cp.lat, longitude: cp.lng });
    let relativeBearing = bearing - compassHeading;
    while (relativeBearing > 180) relativeBearing -= 360;
    while (relativeBearing < -180) relativeBearing += 360;
    const fov = 60;
    const screenX = 50 + (relativeBearing / fov) * 100;
    const dist = getDistance({ latitude: userLat, longitude: userLng }, { latitude: cp.lat, longitude: cp.lng });
    const maxDist = 100;
    const minScale = 0.5;
    const maxScale = 1.5;
    const scale = maxScale - ((dist / maxDist) * (maxScale - minScale));
    const screenY = 40 + (dist / maxDist) * 20;
    return { x: Math.max(5, Math.min(95, screenX)), y: Math.max(20, Math.min(60, screenY)), scale: Math.max(minScale, Math.min(maxScale, scale)), isVisible: Math.abs(relativeBearing) < fov / 2, distance: dist };
  };

  const nearbyCheckpoints = checkpoints.filter(cp => getDistance({ latitude: userLat, longitude: userLng }, { latitude: cp.lat, longitude: cp.lng }) < 100);

  if (cameraPermission === "denied") {
    return <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center text-white p-8"><CameraOff className="w-16 h-16 mb-4 text-red-400" /><h2 className="text-xl font-bold mb-2">Camera Access Required</h2><p className="text-center text-white/70 mb-6">Please enable camera access to use AR mode.</p><Button variant="outline" onClick={onClose}>Back</Button></div>;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black touch-none select-none">
      <Webcam ref={webcamRef} audio={false} screenshotFormat="image/jpeg" videoConstraints={{ facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }} onUserMedia={handleUserMedia} onUserMediaError={handleUserMediaError} className="absolute inset-0 w-full h-full object-cover" />
      {timeRemaining !== null && timeRemaining <= 120 && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[60]">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-red-600/90 text-white px-6 py-2 rounded-full flex items-center gap-3 shadow-2xl border-2 border-white/50 animate-pulse">
            <Clock className="w-6 h-6" /><span className="text-2xl font-black font-mono">{formatTime(timeRemaining)}</span>
          </motion.div>
        </div>
      )}
      <div className="absolute inset-0 pointer-events-none">
        <AnimatePresence>
          {nearbyCheckpoints.map((cp) => {
            const pos = getCheckpointScreenPosition(cp);
            if (!pos.isVisible) return null;
            return (
              <motion.div key={cp.id} initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: pos.scale }} exit={{ opacity: 0, scale: 0 }} style={{ position: "absolute", left: `${pos.x}%`, top: `${pos.y}%`, transform: "translate(-50%, -50%)" }} className="pointer-events-auto cursor-pointer" onClick={() => pos.distance < 20 && handleTap(cp)}>
                <div className="relative">
                  <motion.div animate={tappingCheckpoint === cp.id ? { scale: [1, 2, 0], rotate: [0, 90, 180], opacity: [1, 1, 0] } : { y: [0, -10, 0], scale: pos.distance < 20 ? [1, 1.1, 1] : [1, 0.9, 1] }} transition={tappingCheckpoint === cp.id ? { duration: 0.6, ease: "backIn" } : { duration: 3, repeat: Infinity, ease: "easeInOut" }} className="relative">
                    <AnimatePresence mode="wait">
                      {cp.collected ? (
                        <motion.div key="collected" initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1.2 }} className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center shadow-lg border-2 border-white/50">
                          <CheckCircle2 className="w-10 h-10 text-white" />
                        </motion.div>
                      ) : pos.distance < 20 ? (
                        <motion.div key="avatar" initial={{ opacity: 0, scale: 0.5, rotate: -20 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} exit={{ opacity: 0, scale: 0.5, rotate: 20 }} className={`w-20 h-20 rounded-full bg-gradient-to-br ${cp.isRoving ? 'from-orange-500 to-red-700' : 'from-emerald-500 to-green-700'} flex items-center justify-center shadow-2xl ring-4 ring-white/30`}>
                          {getAvatar(cp.id, !!cp.isRoving)}
                        </motion.div>
                      ) : (
                        <motion.div key="orb" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1, boxShadow: cp.isRoving ? ["0 0 20px rgba(249, 115, 22, 0.4)", "0 0 40px rgba(249, 115, 22, 0.8)", "0 0 20px rgba(249, 115, 22, 0.4)"] : ["0 0 20px rgba(74, 222, 128, 0.4)", "0 0 40px rgba(74, 222, 128, 0.8)", "0 0 20px rgba(74, 222, 128, 0.4)"] }} exit={{ opacity: 0, scale: 0.5 }} transition={{ boxShadow: { duration: 2, repeat: Infinity } }} className={`w-12 h-12 rounded-full ${cp.isRoving ? 'bg-orange-400/80 border-orange-300' : 'bg-green-400/80 border-green-300'} backdrop-blur-sm border-2 flex items-center justify-center`}>
                          <div className="w-4 h-4 rounded-full bg-white blur-[2px] animate-pulse" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                  <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
                    <span className="bg-black/70 text-white text-xs px-2 py-1 rounded-full font-bold">{Math.round(pos.distance)}m</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-[70]">
        <Button size="icon" variant="secondary" onClick={() => setShowStats(true)} className="rounded-full bg-black/40 backdrop-blur-md hover:bg-black/60 border-white/20"><BarChart3 className="w-5 h-5 text-white" /></Button>
        <div className="flex gap-2">
          {photos.length > 0 && <Button size="icon" variant="secondary" onClick={() => setShowGallery(true)} className="rounded-full bg-black/40 backdrop-blur-md hover:bg-black/60 border-white/20 relative"><History className="w-5 h-5 text-white" /><span className="absolute -top-1 -right-1 bg-primary text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center border border-white">{photos.length}</span></Button>}
          <Button size="icon" variant="secondary" onClick={onClose} className="rounded-full bg-black/40 backdrop-blur-md hover:bg-black/60 border-white/20"><X className="w-5 h-5 text-white" /></Button>
        </div>
      </div>
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-[70]">
        <Button size="icon" variant="ghost" onClick={capturePhoto} className="w-20 h-20 rounded-full border-4 border-white shadow-2xl bg-white/20 backdrop-blur-sm hover:bg-white/40 active:scale-95 transition-all flex items-center justify-center p-0"><div className="w-14 h-14 rounded-full bg-white flex items-center justify-center"><Camera className="w-8 h-8 text-black" /></div></Button>
      </div>
      <div className="absolute bottom-32 left-0 right-0 flex flex-col items-center gap-2 pointer-events-none">
        <div className="bg-black/50 backdrop-blur-sm rounded-2xl px-4 py-2 flex items-center gap-4 text-white text-[10px] font-bold uppercase tracking-wider border border-white/10">
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-400" /><span>Static</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-orange-400" /><span>Roving</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500" /><span>Found</span></div>
        </div>
        <div className="bg-black/40 backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-2"><MapPin className="w-4 h-4 text-white" /><span className="text-white text-sm font-bold">{remainingCount} left</span></div>
      </div>
      <AnimatePresence>{showStats && <motion.div initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 100 }} className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-lg p-6 flex items-center justify-center"><Card className="w-full max-w-sm bg-slate-900 border-white/10 text-white p-6 relative overflow-hidden"><div className="absolute top-0 right-0 p-4"><Button variant="ghost" size="icon" onClick={() => setShowStats(false)}><X className="w-5 h-5" /></Button></div><h2 className="text-2xl font-black font-display mb-6 flex items-center gap-2 text-primary"><BarChart3 className="w-6 h-6" /> Mission Stats</h2><div className="grid grid-cols-2 gap-4"><div className="bg-white/5 rounded-2xl p-4 border border-white/5"><div className="flex items-center gap-2 text-muted-foreground text-xs font-bold uppercase mb-1"><Trophy className="w-3 h-3 text-yellow-500" /> Points</div><div className="text-2xl font-black text-white">{score}</div></div><div className="bg-white/5 rounded-2xl p-4 border border-white/5"><div className="flex items-center gap-2 text-muted-foreground text-xs font-bold uppercase mb-1"><TrendingUp className="w-3 h-3 text-emerald-500" /> Accuracy</div><div className="text-2xl font-black text-white">{accuracy}%</div></div><div className="bg-white/5 rounded-2xl p-4 border border-white/5"><div className="flex items-center gap-2 text-muted-foreground text-xs font-bold uppercase mb-1"><Target className="w-3 h-3 text-primary" /> Remaining</div><div className="text-2xl font-black text-white">{remainingCount}</div></div><div className="bg-white/5 rounded-2xl p-4 border border-white/5"><div className="flex items-center gap-2 text-muted-foreground text-xs font-bold uppercase mb-1"><MapPin className="w-3 h-3 text-blue-500" /> Distance</div><div className="text-2xl font-black text-white">{Math.round(totalDistance)}m</div></div></div><div className="mt-6 p-4 bg-primary/10 rounded-2xl border border-primary/20 flex items-center justify-between"><div className="flex items-center gap-2"><Clock className="w-4 h-4 text-primary" /><span className="text-sm font-bold">Time Left</span></div><span className="text-xl font-mono font-black text-primary">{timeRemaining ? formatTime(timeRemaining) : "--:--"}</span></div></Card></motion.div>}</AnimatePresence>
      <AnimatePresence>{showGallery && (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="fixed inset-0 z-[110] bg-black/95 backdrop-blur-xl p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-black font-display text-white flex items-center gap-2"><History className="w-6 h-6 text-primary" /> Mission Photos</h2>
            <Button variant="secondary" size="icon" className="rounded-full" onClick={() => setShowGallery(false)}><X className="w-5 h-5" /></Button>
          </div>
          <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-4 pb-12">
            {photos.map((src, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: i * 0.1 }} 
                className="aspect-[3/4] rounded-2xl overflow-hidden border-2 border-white/10 relative group cursor-pointer"
                onClick={() => setSelectedPhoto(src)}
              >
                <img src={src} className="w-full h-full object-cover" alt={`Mission photo ${i}`} />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-white text-xs font-bold uppercase tracking-wider">Full Screen</span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}</AnimatePresence>

      <AnimatePresence>
        {selectedPhoto && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
            onClick={() => setSelectedPhoto(null)}
          >
            <motion.img 
              initial={{ scale: 0.8 }} 
              animate={{ scale: 1 }} 
              src={selectedPhoto} 
              className="max-w-full max-h-full rounded-xl shadow-2xl"
            />
            <Button 
              variant="secondary" 
              size="icon" 
              className="absolute top-6 right-6 rounded-full"
              onClick={() => setSelectedPhoto(null)}
            >
              <X size={24} />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
