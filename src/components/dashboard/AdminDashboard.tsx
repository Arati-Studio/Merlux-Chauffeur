import React from 'react';
import { 
  BarChart3, Calendar, Shield, Users, 
  Map as MapIcon, Settings, Globe, Tag, MessageCircle, 
  Image as ImageIcon, BookOpen, FileText, HelpCircle, LayoutGrid, LogOut, User
} from 'lucide-react';
import { cn } from '../../lib/utils';
import BookingsTab from './BookingsTab';
import UsersTab from './UsersTab';
import SettingsTab from './SettingsTab';
import AnalyticsTab from './AnalyticsTab';
import CalendarTab from './CalendarTab';
import ManagementTab from './ManagementTab';
import ProfileTab from './ProfileTab';
import DashboardTabsMapper from './DashboardTabsMapper';

interface AdminDashboardProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: any;
  userProfile: any;
  isAdmin: boolean;
  isDriver: boolean;
  mainScrollRef: React.RefObject<HTMLDivElement>;
  handleLogout: () => void;
  // All other state/handlers needed by tabs
  [key: string]: any;
}

const AdminDashboard: React.FC<AdminDashboardProps> = (props) => {
  const { activeTab, mainScrollRef } = props;

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto custom-scrollbar bg-[#020202] relative" ref={mainScrollRef}>

        <div className="p-4 lg:p-10 max-w-7xl mx-auto w-full min-h-full pb-32">
          {props.dashboardNotice && (
            <div className="mb-8">
              {props.renderNotice()}
            </div>
          )}
          <DashboardTabsMapper activeTab={activeTab} props={props} />
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
