import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useServer } from '../contexts/ServerContext';
import { useAuth } from '../contexts/AuthContext';
import CreateServerModal from './modals/CreateServerModal';
import JoinServerModal from './modals/JoinServerModal';
import ProfileModal from './modals/ProfileModal';
import '../styles/ServerList.css';

const ServerList = () => {
  const { servers, currentServer } = useServer();
  const { currentUser, logout } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const navigate = useNavigate();
  
  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };
  
  const handleServerClick = (serverId) => {
    navigate(`/channels/${serverId}`);
  };
  
  const getServerInitials = (serverName) => {
    return serverName
      .split(' ')
      .map(word => word[0])
      .join('')
      .substring(0, 2);
  };
  
  return (
    <div className="server-list">
      <Link to="/direct" className="server-icon direct-messages" title="Личные сообщения">
        <img src="/images/dm-icon-square.svg" alt="Личные сообщения" className="server-image" />
      </Link>
      
      <div className="server-separator"></div>
      
      {servers.map(server => {
        // Для тестового сервера используем специальную иконку
        const isTestServer = server.name === 'Test Server';
        const serverIcon = isTestServer ? '/images/server-building-icon.svg' : server.icon;
        
        return (
          <div 
            key={server.id} 
            className={`server-icon ${currentServer?.id === server.id ? 'active' : ''}`}
            onClick={() => handleServerClick(server.id)}
            title={server.name}
          >
            {serverIcon ? (
              <img src={serverIcon} alt={server.name} className="server-image" />
            ) : (
              <div className="server-initials">
                {getServerInitials(server.name)}
              </div>
            )}
          </div>
        );
      })}
      
      <div 
        className="server-icon add-server" 
        onClick={() => setShowCreateModal(true)}
        title="Add a Server"
      >
        <img src="/images/add-server.svg" alt="Add Server" className="add-server-icon" />
      </div>
      
      <div 
        className="server-icon join-server" 
        onClick={() => setShowJoinModal(true)}
        title="Join a Server"
      >
        <img src="/images/join-server.svg" alt="Join Server" className="join-server-icon" />
      </div>
      
      {/* Компактная UserPanel внизу списка */}
      <div className="server-separator"></div>
      
      <div 
        className="server-icon user-server-icon" 
        onClick={() => setShowProfileModal(true)}
        title={currentUser?.username || 'User'}
        data-component-name="UserPanel"
      >
        {currentUser?.id?.startsWith('test') ? (
          <img 
            src={`/images/avatar${currentUser.id.slice(-1)}.svg`}
            alt={currentUser?.username} 
            className="avatar-image"
            data-component-name="UserPanel"
          />
        ) : currentUser?.avatar ? (
          <img 
            src={currentUser.avatar} 
            alt={currentUser?.username} 
            className="avatar-image"
            data-component-name="UserPanel"
          />
        ) : (
          <div className="server-initials">
            {currentUser?.username ? currentUser.username.charAt(0).toUpperCase() : '?'}
          </div>
        )}
        <div className="status-indicator online"></div>
      </div>
      
      <div 
        className="server-icon logout-button" 
        onClick={handleLogout}
        title="Log Out"
      >
        <img src="/images/logout.svg" alt="Log Out" className="logout-icon" />
      </div>
      
      {showCreateModal && (
        <CreateServerModal onClose={() => setShowCreateModal(false)} />
      )}
      
      {showJoinModal && (
        <JoinServerModal onClose={() => setShowJoinModal(false)} />
      )}
      
      {showProfileModal && (
        <ProfileModal onClose={() => setShowProfileModal(false)} />
      )}
    </div>
  );
};

export default ServerList;
