import React from "react";
import { motion } from "motion/react";

interface AnimatedPageProps {
  children: React.ReactNode;
}

export default function AnimatedPage({ children }: AnimatedPageProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{
        duration: 0.35,
        ease: [0.25, 1, 0.5, 1], // smooth, premium custom cubic-bezier
      }}
      className="w-full flex-1 flex flex-col"
    >
      {children}
    </motion.div>
  );
}
