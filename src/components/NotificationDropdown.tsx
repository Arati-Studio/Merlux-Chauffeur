import React from 'react';
import { Bell, Check, Trash2, X } from 'lucide-react';

const NotificationDropdown = ({
  notifications,
  onClose,
  markAsRead,
  markAllAsRead,
  clearAll
}: {
  notifications: any[];
  onClose: () => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
}) => {
  return (
    <div className="absolute right-0 top-full mt-2 w-80 bg-black border border-white/10 rounded-2xl shadow-2xl z-[1000] overflow-hidden">
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Bell size={16} className="text-gold" /> Notifications
        </h3>
        <div className="flex gap-2">
          <button onClick={markAllAsRead} className="text-[10px] text-gold hover:text-white uppercase tracking-widest">Read All</button>
          <button onClick={clearAll} className="text-[10px] text-red-500 hover:text-white uppercase tracking-widest">Clear</button>
        </div>
      </div>
      <div className="max-h-96 overflow-y-auto custom-scrollbar">
        {notifications.length === 0 ? (
          <div className="p-8 text-center text-white/30 text-xs">No notifications</div>
        ) : (
          notifications.map((n, idx) => (
            <div key={n.id || `notif-${idx}`} className={`p-4 border-b border-white/5 ${n.read ? 'opacity-50' : ''}`}>
              <div className="flex justify-between items-start">
                <span className="text-xs font-bold text-white">{n.title}</span>
                {!n.read && <button onClick={() => markAsRead(n.id)}><Check size={14} className="text-gold" /></button>}
              </div>
              <p className="text-[10px] text-white/60 mt-1">{n.message}</p>
              <p className="text-[8px] text-white/30 mt-2">
                {n.createdAt?.toDate 
                  ? new Date(n.createdAt.toDate()).toLocaleString() 
                  : n.createdAt?.seconds 
                    ? new Date(n.createdAt.seconds * 1000).toLocaleString()
                    : n.createdAt ? new Date(n.createdAt).toLocaleString() : 'Just now'}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NotificationDropdown;
