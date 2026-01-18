import { useState, useEffect, useMemo } from "react";
import { useGeolocation } from "@/hooks/use-geolocation";
import { useGenerateGame, useVerifyAnswer } from "@/hooks/use-game";
import { CheckpointCard } from "@/components/CheckpointCard";
import { QuestionDialog } from "@/components/QuestionDialog";
import { Radar } from "@/components/Radar";
import { ARView } from "@/components/ARView";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getDistance } from "geolib";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Trophy, MapPin, AlertCircle, Camera, Settings, Timer, Target, Map as MapIcon, Leaf, Sparkles, Flame, Calendar } from "lucide-react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { Checkpoint } from "@shared/schema";
import { NatureScavengerHunt } from "@/components/NatureScavengerHunt";
import { LeafBackground } from "@/components/layout/LeafBackground";

export default function Game() {
  const { lat, lng, error: geoError, loading: geoLoading } = useGeolocation();
  const generateGameMutation = useGenerateGame();
  const verifyAnswerMutation = useVerifyAnswer();
  
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [score, setScore] = useState(0);
  const [gameMode, setGameMode] = useState<"menu" | "ar" | "nature">("menu");
  const [activeQuestion, setActiveQuestion] = useState<Checkpoint | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [gameOver, setGameOver] = useState(false);

  const settingsQuery = useQuery<{ timeLimit: number; checkpointCount: number; radius: number }>({
    queryKey: ["/api/settings"],
  });

  const statsQuery = useQuery({
    queryKey: ["/api/stats"],
  });

  // Derived state: sorted and deduplicated checkpoints by distance
  const sortedCheckpoints = useMemo(() => {
    if (!lat || !lng || checkpoints.length === 0) return [];
    
    // Deduplicate by ID
    const uniqueCheckpointsMap = new Map();
    checkpoints.forEach(cp => {
      uniqueCheckpointsMap.set(cp.id, cp);
    });
    const uniqueCheckpoints = Array.from(uniqueCheckpointsMap.values());
    
    return uniqueCheckpoints.map(cp => {
      const dist = getDistance(
        { latitude: lat, longitude: lng },
        { latitude: cp.lat, longitude: cp.lng }
      );
      return { ...cp, distance: dist };
    }).sort((a, b) => {
      // Sort collected to bottom, then by distance
      if (a.collected && !b.collected) return 1;
      if (!a.collected && b.collected) return -1;
      return a.distance - b.distance;
    });
  }, [lat, lng, checkpoints]);

  // Start Game Handler
  const handleStartMission = () => {
    if (lat && lng) {
      const count = settingsQuery.data?.checkpointCount ?? 5;
      const radius = settingsQuery.data?.radius ?? 500;
      generateGameMutation.mutate(
        { lat, lng, radius, count },
        {
          onSuccess: (data) => {
            setCheckpoints(data);
            setGameMode("ar");
            setScore(0);
            const minutes = settingsQuery.data?.timeLimit ?? 30;
            setTimeRemaining(minutes * 60);
          }
        }
      );
    }
  };

  // Timer countdown effect
  useEffect(() => {
    if (gameMode !== "ar" || timeRemaining === null || gameOver) return;

    if (timeRemaining <= 0) {
      setGameOver(true);
      return;
    }

    const interval = setInterval(() => {
      setTimeRemaining(prev => prev !== null ? prev - 1 : null);
    }, 1000);

    return () => clearInterval(interval);
  }, [gameMode, timeRemaining, gameOver]);

  // Handle AR checkpoint tap
  const handleARCheckpointTap = (checkpoint: Checkpoint) => {
    setActiveQuestion(checkpoint);
  };

  const completeHuntMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/stats/complete-hunt", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Quest Completed!",
        description: "You've finished your mission and earned a Streak Freeze!",
      });
    }
  });

  useEffect(() => {
    if (checkpoints.length > 0 && checkpoints.every(cp => cp.collected) && !gameOver) {
      completeHuntMutation.mutate();
      setGameOver(true);
    }
  }, [checkpoints, gameOver]);

  // Handle Answer Verification
  const handleVerify = async (answer: string): Promise<boolean> => {
    if (!activeQuestion) return false;

    try {
      const result = await verifyAnswerMutation.mutateAsync({
        questionId: activeQuestion.id,
        answer
      });

      if (result.correct) {
        setScore(prev => prev + result.points);
        setCheckpoints(prev => prev.map(cp => 
          cp.id === activeQuestion.id ? { ...cp, collected: true } : cp
        ));
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  if (geoLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-green-50">
        <Loader2 className="w-12 h-12 text-green-600 animate-spin mb-4" />
        <h2 className="text-xl font-bold text-green-800 font-display">Sensing the Forest...</h2>
      </div>
    );
  }

  if (geoError || !lat || !lng) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center bg-red-50/50">
        <div className="bg-red-100 p-4 rounded-full mb-4">
          <AlertCircle className="w-12 h-12 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-foreground font-display mb-2">Location Required</h1>
        <p className="text-muted-foreground max-w-xs mx-auto">
          We need your GPS coordinates to guide your forest adventure. Please enable location access.
        </p>
      </div>
    );
  }

  if (gameMode === "menu") {
    const stats = statsQuery.data as any;
    const todayPoints = stats?.pointsHistory?.find((h: any) => h.date === new Date().toISOString().split('T')[0])?.points ?? 0;

    return (
      <div className="min-h-screen flex flex-col p-6 bg-gradient-to-b from-green-50 to-green-100 relative overflow-hidden">
        <LeafBackground />
        <div className="max-w-md mx-auto w-full space-y-6 relative z-10">
          <div className="flex justify-between items-start pt-4">
            <div>
              <h1 className="text-4xl font-black text-green-900 leading-none flex items-center gap-2">
                Forest <Leaf className="text-green-600" />
              </h1>
              <p className="text-green-700 font-medium">Nature Explorer</p>
            </div>
            <Link href="/settings">
              <Button variant="outline" size="icon" className="rounded-full bg-white/50 backdrop-blur-sm border-green-200">
                <Settings className="w-5 h-5 text-green-700" />
              </Button>
            </Link>
          </div>

          <Card className="p-6 border-none shadow-xl bg-white/80 backdrop-blur-md">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs font-bold text-green-600 uppercase tracking-wider">Today's Points</p>
                <p className="text-3xl font-black text-green-900">{todayPoints}</p>
              </div>
              <div className="space-y-1 text-right">
                <p className="text-xs font-bold text-orange-600 uppercase tracking-wider">Current Streak</p>
                <div className="flex items-center justify-end gap-1">
                  <Flame className="w-5 h-5 text-orange-500 fill-orange-500" />
                  <p className="text-3xl font-black text-orange-600">{stats?.currentStreak ?? 0}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-2 border-t border-green-100 pt-6">
              <div className="text-center">
                <p className="text-[10px] font-bold text-gray-400 uppercase">Total</p>
                <p className="text-lg font-black text-gray-700">{stats?.totalPoints ?? 0}</p>
              </div>
              <div className="text-center border-x border-green-50">
                <p className="text-[10px] font-bold text-gray-400 uppercase">Best</p>
                <p className="text-lg font-black text-gray-700">{stats?.longestStreak ?? 0}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-bold text-gray-400 uppercase">Hunts</p>
                <p className="text-lg font-black text-gray-700">{stats?.huntsCompleted ?? 0}</p>
              </div>
            </div>
          </Card>

          <div className="space-y-4">
            <Button 
              onClick={handleStartMission}
              className="w-full h-24 bg-green-600 hover:bg-green-700 text-white rounded-3xl shadow-lg shadow-green-200 group relative overflow-hidden transition-all active:scale-95"
            >
              <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:scale-110 transition-transform">
                <MapIcon size={64} />
              </div>
              <div className="flex flex-col items-start px-4">
                <span className="text-2xl font-black flex items-center gap-2">
                  Forest Quest <Sparkles size={20} className="animate-pulse" />
                </span>
                <span className="text-green-100 text-sm font-medium">Find hidden relics in the wild</span>
              </div>
            </Button>

            <Button 
              onClick={() => setGameMode("nature")}
              className="w-full h-24 bg-white hover:bg-green-50 text-green-800 rounded-3xl shadow-lg shadow-green-100 border-2 border-green-100 group relative overflow-hidden transition-all active:scale-95"
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform text-green-900">
                <Camera size={64} />
              </div>
              <div className="flex flex-col items-start px-4">
                <span className="text-2xl font-black flex items-center gap-2">
                  Nature Finder <Leaf size={20} />
                </span>
                <span className="text-green-600 text-sm font-medium">Identify flora and fauna</span>
              </div>
            </Button>
          </div>

          <div className="text-center text-[10px] text-green-800/40 font-mono uppercase tracking-widest pt-4">
            Stationed: {lat.toFixed(4)}, {lng.toFixed(4)}
          </div>
        </div>
      </div>
    );
  }

  if (gameMode === "nature") {
    return (
      <div className="min-h-screen bg-green-50 p-6 relative overflow-hidden">
        <LeafBackground />
        <div className="max-w-md mx-auto space-y-6 relative z-10">
          <Button 
            variant="ghost" 
            onClick={() => setGameMode("menu")}
            className="text-green-700 font-bold hover:bg-green-100 -ml-2"
          >
            ← Back to Base
          </Button>
          <NatureScavengerHunt onComplete={() => setGameMode("menu")} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black overflow-hidden">
      <ARView
        checkpoints={sortedCheckpoints}
        userLat={lat}
        userLng={lng}
        score={score}
        timeRemaining={timeRemaining}
        onCheckpointTap={handleARCheckpointTap}
        onClose={() => setGameMode("menu")}
      />

      <QuestionDialog 
        open={!!activeQuestion} 
        onOpenChange={(open) => !open && setActiveQuestion(null)}
        checkpoint={activeQuestion}
        onVerify={handleVerify}
      />
    </div>
  );
}
