import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGeolocation } from "@/hooks/use-geolocation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Clock, MapPin, Plus, Loader2, Target, Move, Sparkles, Map as MapIcon } from "lucide-react";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Question } from "@shared/schema";

import { MapSelector } from "@/components/MapSelector";
import { LeafBackground } from "@/components/layout/LeafBackground";

export default function Settings() {
  const { lat: geoLat, lng: geoLng } = useGeolocation();
  const { toast } = useToast();
  
  const [timeLimit, setTimeLimit] = useState(30);
  const [checkpointCount, setCheckpointCount] = useState(5);
  const [rovingCount, setRovingCount] = useState(2);
  const [radius, setRadius] = useState(500);
  const [mapTheme, setMapTheme] = useState("standard");
  const [zenMode, setZenMode] = useState(false);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>("");
  const [customLat, setCustomLat] = useState<number | null>(null);
  const [customLng, setCustomLng] = useState<number | null>(null);

  useEffect(() => {
    if (geoLat && geoLng && customLat === null) {
      setCustomLat(geoLat);
      setCustomLng(geoLng);
    }
  }, [geoLat, geoLng]);

  const settingsQuery = useQuery<{ timeLimit: number; checkpointCount: number; rovingCount: number; radius: number }>({
    queryKey: ["/api/settings"],
  });

  const questionsQuery = useQuery<Question[]>({
    queryKey: ["/api/questions"],
  });

  const checkpointsQuery = useQuery<any[]>({
    queryKey: ["/api/checkpoints/all"],
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: { timeLimit: number; checkpointCount: number; rovingCount: number; radius: number }) => {
      return apiRequest("POST", "/api/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/checkpoints/all"] });
      toast({ title: "Settings saved", description: "Your game settings have been updated." });
    },
  });

  const moveCheckpointMutation = useMutation({
    mutationFn: async ({ id, lat, lng }: { id: number; lat: number; lng: number }) => {
      return apiRequest("PATCH", `/api/checkpoints/${id}`, { lat, lng });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/checkpoints/all"] });
      toast({ title: "Checkpoint moved", description: "The checkpoint location has been updated." });
    },
  });

  const addCheckpointMutation = useMutation({
    mutationFn: async (data: { lat: number; lng: number; questionId: number }) => {
      return apiRequest("POST", "/api/checkpoints/custom", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/checkpoints/all"] });
      toast({ title: "Checkpoint added", description: "Custom checkpoint created at selected location." });
      setSelectedQuestionId("");
    },
  });

  useEffect(() => {
    if (settingsQuery.data) {
      setTimeLimit(settingsQuery.data.timeLimit);
      setCheckpointCount(settingsQuery.data.checkpointCount ?? 5);
      setRovingCount(settingsQuery.data.rovingCount ?? 2);
      setRadius(settingsQuery.data.radius ?? 500);
      setMapTheme((settingsQuery.data as any).mapTheme ?? "standard");
      setZenMode((settingsQuery.data as any).zenMode ?? false);
    }
  }, [settingsQuery.data]);

  const handleSaveSettings = () => {
    updateSettingsMutation.mutate({ timeLimit, checkpointCount, rovingCount, radius, mapTheme, zenMode } as any);
  };

  const handleAddCheckpoint = () => {
    if (!customLat || !customLng) {
      toast({ title: "Location required", description: "Please select a location on the map.", variant: "destructive" });
      return;
    }
    if (!selectedQuestionId) {
      toast({ title: "Select a question", description: "Please choose a science question for this checkpoint.", variant: "destructive" });
      return;
    }
    addCheckpointMutation.mutate({
      lat: customLat,
      lng: customLng,
      questionId: parseInt(selectedQuestionId),
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-purple-50 to-blue-50 p-4 relative overflow-hidden">
      <LeafBackground />
      <div className="max-w-md mx-auto space-y-6 relative z-20">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold font-display">Settings</h1>
        </div>

        <Card className="p-6 space-y-6 bg-white dark:bg-card relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-lg font-bold">Game Rules</h2>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Time Limit: {timeLimit} min</Label>
              </div>
              <Slider
                value={[timeLimit]}
                min={5}
                max={120}
                step={5}
                onValueChange={(val) => setTimeLimit(val[0])}
                data-testid="slider-time-limit"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Checkpoints: {checkpointCount}
                </Label>
              </div>
              <Slider
                value={[checkpointCount]}
                min={1}
                max={20}
                step={1}
                onValueChange={(val) => setCheckpointCount(val[0])}
                data-testid="slider-checkpoint-count"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="flex items-center gap-2">
                  <Move className="w-4 h-4" />
                  Spawn Radius: {radius}m
                </Label>
              </div>
              <Slider
                value={[radius]}
                min={10}
                max={2000}
                step={10}
                onValueChange={(val) => setRadius(val[0])}
                data-testid="slider-radius"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="flex items-center gap-2">
                  <Move className="w-4 h-4 text-orange-500" />
                  Roving Checkpoints: {rovingCount}
                </Label>
              </div>
              <Slider
                value={[rovingCount]}
                min={0}
                max={10}
                step={1}
                onValueChange={(val) => setRovingCount(val[0])}
                data-testid="slider-roving-count"
              />
            </div>

            <div className="pt-4 border-t border-purple-100 space-y-4 relative z-40">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base font-bold flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    Zen Mode
                  </Label>
                  <p className="text-xs text-muted-foreground">Relaxed exploration without timers</p>
                </div>
                <Switch
                  checked={zenMode}
                  onCheckedChange={setZenMode}
                  data-testid="switch-zen-mode"
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MapIcon className="w-4 h-4 text-blue-600" />
                  Map Theme
                </Label>
                <Select value={mapTheme} onValueChange={setMapTheme}>
                  <SelectTrigger data-testid="select-map-theme">
                    <SelectValue placeholder="Select theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Forest Standard</SelectItem>
                    <SelectItem value="satellite">Satellite View</SelectItem>
                    <SelectItem value="terrain">Outdoor Terrain</SelectItem>
                    <SelectItem value="dark">Midnight Explorer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Button
            onClick={handleSaveSettings}
            disabled={updateSettingsMutation.isPending}
            className="w-full h-12 text-lg font-bold"
            data-testid="button-save-settings"
          >
            {updateSettingsMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            Save Game Configuration
          </Button>
        </Card>

        <Card className="p-6 space-y-4 bg-white dark:bg-card relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-accent/10 rounded-lg">
              <MapPin className="w-5 h-5 text-accent" />
            </div>
            <h2 className="text-lg font-bold">Manage Checkpoints</h2>
          </div>

          <p className="text-sm text-muted-foreground">
            Drag markers to move checkpoints or click the map to set a new custom one.
          </p>

          {(customLat && customLng) ? (
            <MapSelector 
              lat={customLat} 
              lng={customLng} 
              onLocationSelect={(lat, lng) => {
                setCustomLat(lat);
                setCustomLng(lng);
              }}
              onCheckpointMove={(id, lat, lng) => {
                moveCheckpointMutation.mutate({ id, lat, lng });
              }}
              radius={radius}
              existingCheckpoints={checkpointsQuery.data}
              playerLocation={geoLat && geoLng ? { lat: geoLat, lng: geoLng } : undefined}
            />
          ) : (
            <div className="h-[300px] bg-muted flex items-center justify-center rounded-lg">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}

          <div className="space-y-2">
            <Label>Select Question</Label>
            <Select value={selectedQuestionId} onValueChange={setSelectedQuestionId}>
              <SelectTrigger data-testid="select-question">
                <SelectValue placeholder="Choose a question..." />
              </SelectTrigger>
              <SelectContent className="max-h-[300px] overflow-y-auto">
                {questionsQuery.data?.map((q) => (
                  <SelectItem key={q.id} value={String(q.id)}>
                    {q.question}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleAddCheckpoint}
            disabled={addCheckpointMutation.isPending || !customLat || !customLng}
            variant="secondary"
            className="w-full"
            data-testid="button-add-checkpoint"
          >
            {addCheckpointMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            Add Checkpoint at Selection
          </Button>
        </Card>
      </div>
    </div>
  );
}

