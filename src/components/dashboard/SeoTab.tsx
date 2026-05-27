import React, { useState } from 'react';
import { 
  Globe, BookOpen, FileText, HelpCircle, LayoutGrid, 
  Settings, Search, Plus, Filter, ChevronDown, CheckCircle2
} from 'lucide-react';
import { cn } from '../../lib/utils';
import BlogTab from './BlogTab';
import DynamicPageTab from './DynamicPageTab';
import FaqTab from './FaqTab';
import CmsTab from './CmsTab';
import IndexTab from './MetaTab';

interface SeoTabProps {
  isAdmin: boolean;
  showDashboardNotice: (type: any, message: string, title?: string) => void;
  setConfirmDelete: (config: any) => void;
}

const SeoTab: React.FC<SeoTabProps> = (props) => {
  const [seoActiveTab, setSeoActiveTab] = useState<'global' | 'pages' | 'blogs' | 'faq' | 'meta'>('global');

  const tabs = [
    { id: 'global', label: 'SEO', icon: Globe },
    { id: 'meta', label: 'Metadata', icon: Search },
    { id: 'pages', label: 'Pages', icon: FileText },
    { id: 'blogs', label: 'Blogs', icon: BookOpen },
    { id: 'faq', label: 'FAQ', icon: HelpCircle },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4">
        {/* Inner Navigation */}
        <div className="flex w-full items-center justify-between bg-white/5 p-1.5 rounded-2xl border border-white/5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSeoActiveTab(tab.id as any)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] transition-all whitespace-nowrap",
                seoActiveTab === tab.id
                  ? "bg-gold text-black shadow-[0_0_15px_rgba(212,175,55,0.3)]"
                  : "text-white/40 hover:text-white hover:bg-white/5"
              )}
            >
              <tab.icon size={14} />
              <span className="hidden sm:block">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        {seoActiveTab === 'global' && (
          <CmsTab 
            showDashboardNotice={props.showDashboardNotice} 
          />
        )}
        
        {seoActiveTab === 'meta' && (
          <IndexTab 
            showDashboardNotice={props.showDashboardNotice} 
          />
        )}

        {seoActiveTab === 'pages' && (
          <DynamicPageTab 
            isAdmin={props.isAdmin}
            showDashboardNotice={props.showDashboardNotice}
            setConfirmDelete={props.setConfirmDelete}
          />
        )}

        {seoActiveTab === 'blogs' && (
          <BlogTab 
            isAdmin={props.isAdmin}
            showDashboardNotice={props.showDashboardNotice}
            setConfirmDelete={props.setConfirmDelete}
          />
        )}

        {seoActiveTab === 'faq' && (
          <FaqTab 
            isAdmin={props.isAdmin}
            showDashboardNotice={props.showDashboardNotice}
            setConfirmDelete={props.setConfirmDelete}
          />
        )}
      </div>
    </div>
  );
};

export default SeoTab;
