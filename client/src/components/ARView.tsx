import { useState, useEffect, useRef, useCallback } from "react";
import Webcam from "react-webcam";
import { motion, AnimatePresence } from "framer-motion";
import { getRhumbLineBearing, getDistance } from "geolib";
import { TreeDeciduous, Dog, Bird, Leaf, X, CameraOff, MapPin, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Checkpoint } from "@shared/schema";

// Nature avatars for close-range checkpoints
const NATURE_AVATARS = [TreeDeciduous, Dog, Bird, Leaf];

const getAvatar = (id: number) => {
  const Icon = NATURE_AVATARS[id % NATURE_AVATARS.length];
  return <Icon className="w-10 h-10 text-white" />;
};

interface ARViewProps {
  checkpoints: (Checkpoint & { distance?: number })[];
  userLat: number;
  userLng: number;
  onCheckpointTap: (checkpoint: Checkpoint) => void;
  onClose: () => void;
}

interface DeviceOrientation {
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
}

export function ARView({ checkpoints, userLat, userLng, onCheckpointTap, onClose }: ARViewProps) {
  const [cameraPermission, setCameraPermission] = useState<"granted" | "denied" | "prompt">("prompt");
  const [deviceOrientation, setDeviceOrientation] = useState<DeviceOrientation>({ alpha: null, beta: null, gamma: null });
  const [compassHeading, setCompassHeading] = useState<number>(0);
  const [tappingCheckpoint, setTappingCheckpoint] = useState<number | null>(null);
  const webcamRef = useRef<Webcam>(null);

  useEffect(() => {
    const handleOrientation = (event: DeviceOrientationEvent) => {
      setDeviceOrientation({
        alpha: event.alpha,
        beta: event.beta,
        gamma: event.gamma,
      });

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
      (DeviceOrientationEvent as any).requestPermission()
        .then((response: string) => {
          if (response === "granted") {
            window.addEventListener("deviceorientation", handleOrientation as any, true);
          }
        })
        .catch((err: Error) => {
          console.error("Orientation permission error:", err);
        });
    } else {
      window.addEventListener("deviceorientation", handleOrientation as any, true);
    }

    return () => {
      window.removeEventListener("deviceorientation", handleOrientation as any, true);
    };
  }, []);

  const handleUserMedia = useCallback(() => {
    setCameraPermission("granted");
  }, []);

  const handleUserMediaError = useCallback((error: any) => {
    console.error("Webcam error:", error);
    setCameraPermission("denied");
  }, []);

  const handleTap = (cp: Checkpoint) => {
    if (cp.collected) return;
    setTappingCheckpoint(cp.id);
    setTimeout(() => {
      onCheckpointTap(cp);
      setTappingCheckpoint(null);
    }, 600);
  };

  const nearbyCheckpoints = checkpoints.filter(cp => {
    const dist = (cp as any).distance ?? getDistance(
      { latitude: userLat, longitude: userLng },
      { latitude: cp.lat, longitude: cp.lng }
    );
    return dist < 100;
  });

  const getCheckpointScreenPosition = (cp: Checkpoint) => {
    const bearing = getRhumbLineBearing(
      { latitude: userLat, longitude: userLng },
      { latitude: cp.lat, longitude: cp.lng }
    );

    let relativeBearing = bearing - compassHeading;
    while (relativeBearing > 180) relativeBearing -= 360;
    while (relativeBearing < -180) relativeBearing += 360;

    const fov = 60;
    const screenX = 50 + (relativeBearing / fov) * 100;

    const dist = (cp as any).distance ?? getDistance(
      { latitude: userLat, longitude: userLng },
      { latitude: cp.lat, longitude: cp.lng }
    );

    const maxDist = 100;
    const minScale = 0.5;
    const maxScale = 1.5;
    const scale = maxScale - ((dist / maxDist) * (maxScale - minScale));

    const screenY = 40 + (dist / maxDist) * 20;

    return {
      x: Math.max(5, Math.min(95, screenX)),
      y: Math.max(20, Math.min(60, screenY)),
      scale: Math.max(minScale, Math.min(maxScale, scale)),
      isVisible: Math.abs(relativeBearing) < fov / 2,
      distance: dist,
    };
  };

  if (cameraPermission === "denied") {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center text-white p-8">
        <CameraOff className="w-16 h-16 mb-4 text-red-400" />
        <h2 className="text-xl font-bold mb-2">Camera Access Required</h2>
        <p className="text-center text-white/70 mb-6">Please enable camera access to use AR mode.</p>
        <Button variant="outline" onClick={onClose} data-testid="button-close-ar">
          Back to List
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <Webcam
        ref={webcamRef}
        audio={false}
        videoConstraints={{
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        }}
        onUserMedia={handleUserMedia}
        onUserMediaError={handleUserMediaError}
        className="absolute inset-0 w-full h-full object-cover"
      />

      <div className="absolute inset-0 pointer-events-none">
        <AnimatePresence>
          {nearbyCheckpoints.map((cp) => {
            const pos = getCheckpointScreenPosition(cp);
            if (!pos.isVisible) return null;

            return (
              <motion.div
                key={cp.id}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: pos.scale }}
                exit={{ opacity: 0, scale: 0 }}
                style={{
                  position: "absolute",
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  transform: "translate(-50%, -50%)",
                }}
                className="pointer-events-auto cursor-pointer"
                onClick={() => pos.distance < 20 && handleTap(cp)}
                data-testid={`ar-checkpoint-${cp.id}`}
              >
                <div className="relative">
                  <motion.div
                    animate={tappingCheckpoint === cp.id ? {
                      scale: [1, 2, 0],
                      rotate: [0, 90, 180],
                      opacity: [1, 1, 0]
                    } : {
                      y: [0, -10, 0],
                      scale: pos.distance < 20 ? [1, 1.1, 1] : [1, 0.9, 1],
                    }}
                    transition={tappingCheckpoint === cp.id ? {
                      duration: 0.6,
                      ease: "backIn"
                    } : {
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="relative"
                  >
                    <AnimatePresence mode="wait">
                      {cp.collected ? (
                        <motion.div
                          key="collected"
                          initial={{ opacity: 0, scale: 0 }}
                          animate={{ opacity: 1, scale: 1.2 }}
                          className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center shadow-lg border-2 border-white/50"
                        >
                          <CheckCircle2 className="w-10 h-10 text-white" />
                        </motion.div>
                      ) : pos.distance < 20 ? (
                        <motion.div
                          key="avatar"
                          initial={{ opacity: 0, scale: 0.5, rotate: -20 }}
                          animate={{ opacity: 1, scale: 1, rotate: 0 }}
                          exit={{ opacity: 0, scale: 0.5, rotate: 20 }}
                          className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-green-700 flex items-center justify-center shadow-2xl ring-4 ring-green-300/50"
                        >
                          {getAvatar(cp.id)}
                        </motion.div>
                      ) : (
                        <motion.div
                          key="orb"
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ 
                            opacity: 1, 
                            scale: 1,
                            boxShadow: [
                              "0 0 20px rgba(74, 222, 128, 0.4)",
                              "0 0 40px rgba(74, 222, 128, 0.8)",
                              "0 0 20px rgba(74, 222, 128, 0.4)"
                            ]
                          }}
                          exit={{ opacity: 0, scale: 0.5 }}
                          transition={{
                            boxShadow: { duration: 2, repeat: Infinity }
                          }}
                          className="w-12 h-12 rounded-full bg-green-400/80 backdrop-blur-sm border-2 border-green-300 flex items-center justify-center"
                        >
                          <div className="w-4 h-4 rounded-full bg-white blur-[2px] animate-pulse" />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {pos.distance < 20 && !cp.collected && (
                      <motion.div
                        className="absolute -inset-4 rounded-full border-4 border-green-400/30"
                        animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    )}
                  </motion.div>

                  <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
                    <span className="bg-black/70 text-white text-xs px-2 py-1 rounded-full font-bold">
                      {Math.round(pos.distance)}m
                    </span>
                  </div>

                  {pos.distance < 20 && !cp.collected && (
                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap">
                      <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full font-bold animate-pulse">
                        TAP TO COLLECT
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <div className="absolute top-4 left-0 right-0 flex justify-center">
        <div className="bg-black/50 backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-white" />
          <span className="text-white text-sm font-bold">
            {nearbyCheckpoints.filter(cp => !cp.collected).length} checkpoint{nearbyCheckpoints.length !== 1 ? "s" : ""} nearby
          </span>
        </div>
      </div>

      <div className="absolute top-4 right-4">
        <Button
          size="icon"
          variant="secondary"
          onClick={onClose}
          className="rounded-full bg-black/50 backdrop-blur-sm hover:bg-black/70"
          data-testid="button-close-ar"
        >
          <X className="w-5 h-5 text-white" />
        </Button>
      </div>

      <div className="absolute bottom-8 left-0 right-0 flex justify-center">
        <div className="bg-black/50 backdrop-blur-sm rounded-2xl px-6 py-3">
          <div className="flex items-center gap-4 text-white text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-400" />
              <span>Distant (Orb)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-600" />
              <span>In Range (Avatar)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span>Collected (Checkmark)</span>
            </div>
          </div>
        </div>
      </div>

      {deviceOrientation.alpha === null && (
        <div className="absolute bottom-24 left-0 right-0 flex justify-center">
          <div className="bg-yellow-500/90 rounded-lg px-4 py-2 text-black text-xs font-bold">
            Compass not available - AR positioning limited
          </div>
        </div>
      )}
    </div>
  );
}
