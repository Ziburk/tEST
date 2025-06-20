import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/apiService';
import '../styles/UserList.css';

const UserList = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await apiService.get('/users');
        // Filter out the current user
        const filteredUsers = response.data.users.filter(
          user => user.id !== currentUser?.id
        );
        setUsers(filteredUsers);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching users:', err);
        setError('Failed to load users');
        setLoading(false);
      }
    };
    
    fetchUsers();
  }, [currentUser]);
  
  const startDirectMessage = (userId) => {
    navigate(`/channels/@me/${userId}`);
  };
  
  if (loading) {
    return <div className="user-list loading">Loading users...</div>;
  }
  
  if (error) {
    return <div className="user-list error">{error}</div>;
  }
  
  // Hardcode test users with avatars
  const testUsers = [
    { 
      id: 'ba05f051-4e73-4e45-83f9-146faf362be2', 
      username: 'testuser1', 
      status: 'online',
      avatar: '/images/avatar1.svg' 
    },
    { 
      id: '4737f46b-9c51-44a9-a461-cff5d8376838', 
      username: 'testuser2', 
      status: 'idle',
      avatar: '/images/avatar2.svg' 
    },
    { 
      id: '3eb819fb-8ab9-4cba-866b-a334383d49e8', 
      username: 'testuser3', 
      status: 'offline',
      avatar: '/images/avatar3.svg' 
    }
  ];
  
  // Always use test users for demo purposes
  const displayUsers = testUsers;
  
  return (
    <div className="user-list">
      <div className="section-title">
        <h3>DIRECT MESSAGES</h3>
      </div>
      
      <ul className="users">
        {displayUsers.map(user => (
          <li 
            key={user.id} 
            className="user-item"
            onClick={() => startDirectMessage(user.id)}
          >
            <div className={`user-avatar ${user.status || 'offline'}`}>
              {user.avatar ? (
                <img src={user.avatar} alt={user.username} className="avatar-image" />
              ) : (
                user.username ? user.username.charAt(0).toUpperCase() : '?'
              )}
            </div>
            <div className="user-info">
              <span className="username">{user.username}</span>
              <span className="status">{user.status || 'offline'}</span>
            </div>
          </li>
        ))}
      </ul>
      
      {displayUsers.length === 0 && (
        <div className="no-users">No users available</div>
      )}
    </div>
  );
};

export default UserList;
