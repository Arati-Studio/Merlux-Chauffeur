import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import BookingsTab from './BookingsTab';
import AnalyticsTab from './AnalyticsTab';
import CalendarTab from './CalendarTab';
import ProfileTab from './ProfileTab';
import UsersTab from './UsersTab';
import ManagementTab from './ManagementTab';

interface DashboardTabsMapperProps {
  activeTab: string;
  props: any; // All the props passed from AppDashboard
}

const DashboardTabsMapper: React.FC<DashboardTabsMapperProps> = ({ activeTab, props }) => {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
      >
        {(() => {
          switch (activeTab) {
            case 'bookings':
              return <BookingsTab {...props} />;
            case 'analytics':
              return <AnalyticsTab {...props} />;
            case 'calendar':
              return <CalendarTab {...props} />;
            case 'users':
              return <UsersTab {...props} />;
            case 'management':
              return <ManagementTab {...props} />;
            case 'profile':
              return <ProfileTab {...props} />;
            default:
              return null;
          }
        })()}
      </motion.div>
    </AnimatePresence>
  );
};

export default DashboardTabsMapper;
