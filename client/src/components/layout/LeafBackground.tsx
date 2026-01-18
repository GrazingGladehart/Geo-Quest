import { motion } from "framer-motion";
import { Leaf } from "lucide-react";

const LeafIcon = ({ delay, x, y, rotate }: { delay: number; x: string; y: string; rotate: number }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0 }}
    animate={{ 
      opacity: [0.3, 0.5, 0.3],
      scale: [1, 1.15, 1],
      rotate: [rotate, rotate + 15, rotate],
      x: ["0%", "1%", "0%"],
      y: ["0%", "2%", "0%"]
    }}
    transition={{ 
      duration: 7, 
      repeat: Infinity, 
      delay,
      ease: "easeInOut"
    }}
    className="absolute text-green-600/30 pointer-events-none"
    style={{ left: x, top: y }}
  >
    <Leaf size={140} style={{ transform: `rotate(${rotate}deg)` }} />
  </motion.div>
);

export function LeafBackground() {
  const leaves = [
    { delay: 0, x: "5%", y: "10%", rotate: -45 },
    { delay: 1, x: "85%", y: "15%", rotate: 45 },
    { delay: 2, x: "10%", y: "45%", rotate: -15 },
    { delay: 0.5, x: "90%", y: "55%", rotate: 160 },
    { delay: 1.5, x: "15%", y: "85%", rotate: -120 },
    { delay: 2.5, x: "80%", y: "80%", rotate: 30 },
  ];

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-[-1]">
      {leaves.map((leaf, i) => (
        <LeafIcon key={i} {...leaf} />
      ))}
    </div>
  );
}
