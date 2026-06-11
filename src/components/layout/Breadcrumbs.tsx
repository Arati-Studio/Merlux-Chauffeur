import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { motion } from "motion/react";

export default function Breadcrumbs() {
  const location = useLocation();
  const pathnames = location.pathname.split("/").filter((x) => x);

  if (location.pathname === "/" || location.pathname === "/app" || location.pathname === "/login") return null;

  return (
    <nav 
      aria-label="Breadcrumb" 
      className="w-full bg-[#030303]/40 border-b border-white/[0.05] relative z-40 overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-3 md:py-4 flex items-center">
        <ol className="flex items-center space-x-2 md:space-x-4 overflow-x-auto no-scrollbar scroll-smooth">
          <li>
            <Link 
              to="/" 
              className="flex items-center text-white/40 hover:text-gold transition-colors duration-300 group"
              title="Home"
            >
              <Home size={14} className="group-hover:scale-110 transition-transform" />
              <span className="sr-only">Home</span>
            </Link>
          </li>
          
          {pathnames.map((value, index) => {
            const last = index === pathnames.length - 1;
            const to = `/${pathnames.slice(0, index + 1).join("/")}`;
            
            // Format the label: slug-to-title case
            const label = value
              .split("-")
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(" ");

            return (
              <li key={to} className="flex items-center shrink-0">
                <ChevronRight size={12} className="text-white/20 mx-1 md:mx-2" />
                {last ? (
                  <motion.span 
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-gold text-[10px] md:text-xs font-black uppercase tracking-[0.2em]"
                  >
                    {label}
                  </motion.span>
                ) : (
                  <Link 
                    to={to} 
                    className="text-white/40 hover:text-white transition-colors duration-300 text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] whitespace-nowrap"
                  >
                    {label}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </div>
      
      {/* Decorative gradient overlay for scroll indication if needed */}
      <div className="absolute top-0 right-0 h-full w-20 bg-gradient-to-l from-black/50 to-transparent pointer-events-none md:hidden" />
    </nav>
  );
}
