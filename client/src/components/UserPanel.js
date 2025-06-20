import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import ProfileModal from './modals/ProfileModal';
import '../styles/UserPanel.css';
import '../styles/CompactUserPanel.css';

const UserPanel = () => {
  const { currentUser, logout } = useAuth();
  const [showProfileModal, setShowProfileModal] = useState(false);
  
  if (!currentUser) return null;
  
  const handleLogout = () => {
    if (window.confirm('Are you sure you want to log out?')) {
      logout();
    }
  };
  
  // Определяем, является ли пользователь тестовым
  const isTestUser = currentUser.username && 
    (currentUser.username === 'testuser1' || 
     currentUser.username === 'testuser2' || 
     currentUser.username === 'testuser3');
  
  // Определяем аватар в зависимости от имени пользователя
  const userAvatar = isTestUser ? 
    `/images/avatar${currentUser.username.replace('testuser', '')}.svg` : 
    currentUser.avatar;
    
  return (
    <div className="user-panel">
      <div 
        className="user-info" 
        onClick={() => setShowProfileModal(true)}
      >
        <div className="user-avatar">
          {userAvatar ? (
            <img src={userAvatar} alt={currentUser.username} className="avatar-image" />
          ) : (
            <div className="avatar-placeholder">{currentUser.username[0]}</div>
          )}
          <div className={`status-indicator ${currentUser.status || 'online'}`}></div>
        </div>
        
        <div className="user-details">
          <h3 className="username">{currentUser.username}</h3>
          <span className="user-id">#{currentUser.id.substring(0, 4)}</span>
        </div>
      </div>
      
      <div className="user-controls">
        <button 
          className="control-button" 
          onClick={handleLogout}
          title="Logout"
        >
          <i className="fas fa-sign-out-alt"></i>
        </button>
      </div>
      
      {showProfileModal && (
        <ProfileModal onClose={() => setShowProfileModal(false)} />
      )}
    </div>
  );
};

export default UserPanel;
