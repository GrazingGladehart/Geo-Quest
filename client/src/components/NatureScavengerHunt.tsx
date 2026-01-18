import { useState, useEffect } from "react";
import { Camera, Check, X, Upload, Sparkles, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { natureItems } from "@/lib/nature-items";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function NatureScavengerHunt({ onComplete }: { onComplete: () => void }) {
  const [dailyItems, setDailyItems] = useState<any[]>([]);
  const [completedItems, setCompletedItems] = useState<number[]>([]);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const shuffled = [...natureItems].sort(() => Math.random() - 0.5);
    setDailyItems(shuffled.slice(0, 3));
  }, []);

  const handleNotFound = (itemId: number) => {
    setDailyItems(prev => {
      const remaining = natureItems.filter(ni => !prev.find(pi => pi.id === ni.id) && !completedItems.includes(ni.id));
      if (remaining.length === 0) return prev;
      const newItem = remaining[Math.floor(Math.random() * remaining.length)];
      return prev.map(item => item.id === itemId ? newItem : item);
    });
    setSelectedItem(null);
  };

  const verifyMutation = useMutation({
    mutationFn: async ({ itemName, image }: { itemName: string; image: string }) => {
      const res = await apiRequest("POST", "/api/verify-photo", { itemName, image });
      return res.json();
    },
    onSuccess: async (data) => {
      if (data.verified) {
        const newCompleted = [...completedItems, selectedItem.id];
        setCompletedItems(newCompleted);
        queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
        toast({
          title: "Item Verified!",
          description: data.feedback,
        });
        
        if (newCompleted.length >= 3) {
          await apiRequest("POST", "/api/stats/complete-hunt", {});
          toast({
            title: "Daily Goal Reached!",
            description: "You've found 3 items! Daily streak increased!",
          });
          onComplete();
        }
      } else {
        toast({
          title: "Verification Failed",
          description: data.feedback,
          variant: "destructive"
        });
      }
      setSelectedItem(null);
    }
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && selectedItem) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        setIsVerifying(true);
        await verifyMutation.mutateAsync({
          itemName: selectedItem.name,
          image: event.target?.result as string
        });
        setIsVerifying(false);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-green-800 flex items-center gap-2">
          <Sparkles className="text-green-600" />
          Nature Finds
        </h2>
        <span className="text-sm font-medium text-green-600">
          {completedItems.length}/{dailyItems.length} Found
        </span>
      </div>

      <div className="grid gap-3">
        {dailyItems.map((item) => {
          const isCompleted = completedItems.includes(item.id);
          return (
            <Card
              key={item.id}
              className={`p-4 transition-all border-2 ${
                isCompleted 
                  ? "bg-green-50 border-green-200" 
                  : "hover:border-green-300 cursor-pointer"
              }`}
              onClick={() => !isCompleted && !isVerifying && setSelectedItem(item)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-800">{item.name}</h3>
                  <div className="flex gap-2 mt-1">
                    <span className="text-[10px] bg-white px-2 py-0.5 rounded-full border border-gray-100">
                      {item.category}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize ${
                      item.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                      item.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {item.difficulty}
                    </span>
                  </div>
                </div>
                {isCompleted ? (
                  <div className="bg-green-500 rounded-full p-2 text-white">
                    <Check size={18} />
                  </div>
                ) : (
                  <div className="bg-green-100 rounded-full p-2 text-green-600">
                    <Camera size={18} />
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {selectedItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-sm p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold">Find: {selectedItem.name}</h3>
              <Button variant="ghost" size="icon" onClick={() => setSelectedItem(null)}>
                <X size={20} />
              </Button>
            </div>
            
            <div className="aspect-square bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-center p-8">
              {isVerifying ? (
                <>
                  <Loader2 className="w-10 h-10 text-green-600 animate-spin mb-2" />
                  <p className="text-sm text-gray-500 font-medium">Analyzing photo...</p>
                </>
              ) : (
                <>
                  <Upload className="w-10 h-10 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500 mb-4">Take a photo of the {selectedItem.name} in its natural habitat</p>
                  <div className="flex flex-col gap-2 w-full">
                    <label className="cursor-pointer w-full">
                      <Button asChild className="w-full">
                        <span>Choose Photo</span>
                      </Button>
                      <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                    </label>
                    <Button 
                      variant="outline" 
                      className="w-full text-red-600 border-red-100 hover:bg-red-50"
                      onClick={() => handleNotFound(selectedItem.id)}
                    >
                      <X size={16} className="mr-2" />
                      Not Found
                    </Button>
                  </div>
                </>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
