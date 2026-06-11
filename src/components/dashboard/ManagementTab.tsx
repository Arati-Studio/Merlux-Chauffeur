import React from 'react';
import { motion } from 'motion/react';
import { 
  Globe, Settings, Tag, MessageCircle, Image as ImageIcon, 
  BookOpen, FileText, HelpCircle, Layout, Plus, Search, 
  Trash2, Edit2, List, Grid, LayoutGrid, Eye, EyeOff, Save,
  Search as SearchIcon, Filter, RefreshCw, X, ChevronDown, CheckCircle,
  MoreVertical, Share2, Copy, AppWindow
} from 'lucide-react';
import { cn } from '../../lib/utils';

import SeoTab from './SeoTab';
import SettingsTab from './SettingsTab';
import OffersToursTab from './OffersToursTab';
import FloatingTab from './FloatingTab';
import MediaTab from './MediaTab';

interface ManagementTabProps {
  isAdmin: boolean;
  activeSubTab: string;
  setActiveSubTab: (tab: string) => void;
  // Sub-tab content props passed from AppDashboard via Mapper
  props: any;
}

const ManagementTab: React.FC<any> = (allProps) => {
  const {
    isAdmin,
    activeSubTab,
    setActiveSubTab
  } = allProps;

  if (!isAdmin) return null;

  const renderContent = () => {
    switch (activeSubTab) {
      case 'seo':
        return (
          <SeoTab
            {...allProps}
          />
        );
      case 'settings':
        return (
          <SettingsTab
            {...allProps}
          />
        );
      case 'offers-tours':
        return (
          <OffersToursTab
            {...allProps}
          />
        );
      case 'floatui':
        return (
          <FloatingTab
            {...allProps}
          />
        );
      case 'media':
        return (
          <MediaTab
            {...allProps}
          />
        );
      default:
        return null;
    }
  };

  const subTabs = [
    { id: 'seo', label: 'CMS', icon: AppWindow },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'offers-tours', label: 'Products', icon: Tag },
    { id: 'floatui', label: 'FloatUI', icon: MessageCircle },
    { id: 'media', label: 'Media', icon: ImageIcon },
  ];

  return (
    <div className="space-y-8">
      {/* Sub-navigation */}
      <div className="flex w-full items-center justify-between bg-white/5 p-1.5 rounded-2xl border border-white/5">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap",
              activeSubTab === tab.id
                ? "bg-gold text-black shadow-lg"
                : "text-white/40 hover:text-white hover:bg-white/5"
            )}
          >
            <tab.icon size={14} />
            <span className="hidden sm:block">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        {renderContent()}
      </div>
    </div>
  );
};

export default ManagementTab;
