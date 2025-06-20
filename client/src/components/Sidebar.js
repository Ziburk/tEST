import React from 'react';
import { useServer } from '../contexts/ServerContext';
import { useChat } from '../contexts/ChatContext';
import '../styles/Sidebar.css';

const Sidebar = ({ children }) => {
  const { currentServer } = useServer();
  const { activeDirectChat } = useChat();
  
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-header-content">
          {activeDirectChat ? (
            <>
              <img src="/logo.svg" alt="VidTalk" className="sidebar-logo" />
              <h2 className="sidebar-title">Direct Message</h2>
            </>
          ) : (
            <>
              <img src="/logo.svg" alt="VidTalk" className="sidebar-logo" />
              <h2 className="sidebar-title">{currentServer?.name || 'Select a Server'}</h2>
            </>
          )}
        </div>
      </div>
      
      <div className="sidebar-content">
        {children}
      </div>
    </div>
  );
};

export default Sidebar;
