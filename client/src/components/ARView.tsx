import { useState, useEffect, useRef, useCallback } from "react";
import Webcam from "react-webcam";
import { motion, AnimatePresence } from "framer-motion";
import { getBearing, getDistance } from "geolib";
import { MapPin, Target, X, Camera, CameraOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Checkpoint } from "@shared/schema";

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
        } else if (event.alpha !== null) {
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
        .catch(err => {
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

  const nearbyCheckpoints = checkpoints.filter(cp => {
    if (cp.collected) return false;
    const dist = cp.distance ?? getDistance(
      { latitude: userLat, longitude: userLng },
      { latitude: cp.lat, longitude: cp.lng }
    );
    return dist < 100;
  });

  const getCheckpointScreenPosition = (cp: Checkpoint) => {
    const bearing = getBearing(
      { latitude: userLat, longitude: userLng },
      { latitude: cp.lat, longitude: cp.lng }
    );

    let relativeBearing = bearing - compassHeading;
    while (relativeBearing > 180) relativeBearing -= 360;
    while (relativeBearing < -180) relativeBearing += 360;

    const fov = 60;
    const screenX = 50 + (relativeBearing / fov) * 100;

    const dist = cp.distance ?? getDistance(
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
                onClick={() => pos.distance < 20 && onCheckpointTap(cp)}
                data-testid={`ar-checkpoint-${cp.id}`}
              >
                <div className="relative">
                  <motion.div
                    animate={{
                      y: [0, -10, 0],
                      rotate: [0, 5, -5, 0],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="relative"
                  >
                    <div
                      className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg ${
                        pos.distance < 20
                          ? "bg-gradient-to-br from-green-400 to-green-600 ring-4 ring-green-300/50"
                          : "bg-gradient-to-br from-purple-500 to-indigo-600"
                      }`}
                    >
                      <Target className="w-8 h-8 text-white" />
                    </div>

                    {pos.distance < 20 && (
                      <motion.div
                        className="absolute -inset-2 rounded-full border-2 border-green-400"
                        animate={{ scale: [1, 1.3, 1], opacity: [1, 0, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                    )}
                  </motion.div>

                  <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
                    <span className="bg-black/70 text-white text-xs px-2 py-1 rounded-full font-bold">
                      {pos.distance}m
                    </span>
                  </div>

                  {pos.distance < 20 && (
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
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
            {nearbyCheckpoints.length} checkpoint{nearbyCheckpoints.length !== 1 ? "s" : ""} nearby
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
              <div className="w-3 h-3 rounded-full bg-purple-500" />
              <span>Nearby ({">"}20m)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span>In Range ({"<"}20m)</span>
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
