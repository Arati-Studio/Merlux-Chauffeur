import React from 'react';
import { LayoutGrid, User, LogOut, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';

import DashboardTabsMapper from './DashboardTabsMapper';

interface CustomerDashboardProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: any;
  userProfile: any;
  handleLogout: () => void;
  mainScrollRef: React.RefObject<HTMLDivElement>;
  [key: string]: any;
}

const CustomerDashboard: React.FC<CustomerDashboardProps> = (props) => {
  const { activeTab, mainScrollRef } = props;
  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto no-scrollbar bg-[#020202] relative" ref={mainScrollRef}>
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

export default CustomerDashboard;
