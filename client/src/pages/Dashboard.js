import React, { useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useServer } from '../contexts/ServerContext';
import { useChat } from '../contexts/ChatContext';
import { useVoice } from '../contexts/VoiceContext';

import Sidebar from '../components/Sidebar';
import ServerList from '../components/ServerList';
import ChannelList from '../components/ChannelList';
import Chat from '../components/Chat';
import DirectChat from '../components/DirectChat';
import UserPanel from '../components/UserPanel';
import DirectMessages from '../components/DirectMessages';
import VoiceChannel from '../components/VoiceChannel';

import '../styles/Dashboard.css';

const Dashboard = () => {
  const { serverId, channelId, userId } = useParams();
  const { currentUser } = useAuth();
  const { 
    servers, 
    currentServer, 
    setCurrentServer, 
    channels, 
    currentChannel, 
    setCurrentChannel 
  } = useServer();
  const { 
    activeDirectChat, 
    setActiveDirectChat 
  } = useChat();
  const navigate = useNavigate();
  
  // Определяем текущий маршрут с помощью useLocation (обновляется при изменении URL)
  const location = useLocation();
  // Определяем, находимся ли мы на странице личных сообщений
  const isInDirectMessages = location.pathname.startsWith('/direct');
  
  // Set current server based on URL parameter
  useEffect(() => {
    // Skip if we're in direct messages section or no servers loaded yet
    if (isInDirectMessages || servers.length === 0) {
      return;
    }
    
    // If we have a serverId in URL
    if (serverId) {
      const server = servers.find(s => s.id === serverId);
      if (server) {
        // Only update if different from current server to prevent unnecessary updates
        if (!currentServer || currentServer.id !== server.id) {
          setCurrentServer(server);
        }
        return; // Don't navigate, let the channel effect handle it
      } else {
        // If server ID is invalid, redirect to first server
        navigate(`/channels/${servers[0].id}`);
      }
    } else if (!userId && !activeDirectChat) {
      // If no server or direct chat is active and we're not in DMs, navigate to first server
      navigate(`/channels/${servers[0].id}`);
    }
  }, [servers, serverId, userId, navigate, setCurrentServer, activeDirectChat, isInDirectMessages, currentServer]);
  
  // Set current channel based on URL parameter
  useEffect(() => {
    // Skip if we're in direct messages, no current server, or no channels
    if (isInDirectMessages || !currentServer || channels.length === 0) {
      return;
    }
    
    // If we have a channelId in URL
    if (channelId) {
      const channel = channels.find(c => c.id === channelId);
      if (channel) {
        // Only update if different from current channel to prevent unnecessary updates
        if (!currentChannel || currentChannel.id !== channel.id) {
          setCurrentChannel(channel);
        }
      } else {
        // If channel ID is invalid, find first text channel
        const firstTextChannel = channels.find(c => c.type === 'text');
        if (firstTextChannel) {
          // Only navigate if we're not already on this channel
          if (!currentChannel || currentChannel.id !== firstTextChannel.id) {
            navigate(`/channels/${currentServer.id}/${firstTextChannel.id}`, { replace: true });
          }
        }
      }
    } else {
      // If no channel is specified, find first text channel
      const firstTextChannel = channels.find(c => c.type === 'text');
      if (firstTextChannel) {
        // Only navigate if we're not already on this channel
        if (!currentChannel || currentChannel.id !== firstTextChannel.id) {
          navigate(`/channels/${currentServer.id}/${firstTextChannel.id}`, { replace: true });
        }
      }
    }
  }, [currentServer, channels, channelId, navigate, setCurrentChannel, isInDirectMessages, currentChannel]);
  
  // Handle direct message route
  useEffect(() => {
    console.log('Location changed:', location.pathname);
    
    // Если мы на странице личных сообщений
    if (isInDirectMessages) {
      // Если у нас есть конкретный пользователь (userId)
      if (userId) {
        const fetchUser = async () => {
          try {
            // Fetch user from API
            const response = await fetch(`http://localhost:5000/api/users/${userId}`, {
              headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            
            if (response.ok) {
              const { user } = await response.json();
              setActiveDirectChat(user);
            } else {
              console.error('Error fetching user: API response not ok');
              // Не перенаправляем на главную, а остаемся на странице личных сообщений
            }
          } catch (err) {
            console.error('Error fetching user:', err);
            // Не перенаправляем на главную, а остаемся на странице личных сообщений
          }
        };
        
        fetchUser();
      }
      // Если мы на странице личных сообщений без userId, оставляем все как есть
    } else if (serverId && activeDirectChat) {
      // Только очищаем активный чат, если переходим на сервер
      setActiveDirectChat(null);
    }
  }, [userId, navigate, setActiveDirectChat, serverId, activeDirectChat, isInDirectMessages, location]);
  
  // Determine if we are in a voice channel
  const { inVoiceChannel } = useVoice();
  
  // Render different content based on channel type
  const renderMainContent = () => {
    // If we're in a direct message
    if (isInDirectMessages && activeDirectChat) {
      return <DirectChat />;
    }
    
    // If we're in direct messages section but no active chat yet
    if (isInDirectMessages && !activeDirectChat) {
      return (
        <div className="welcome-direct-messages">
          <h2>Выберите контакт для общения</h2>
          <p>Нажмите на любого пользователя слева, чтобы начать чат</p>
        </div>
      );
    }
    
    // If we're in a voice channel and the voice call is active
    if (currentChannel?.type === 'voice' && inVoiceChannel) {
      return <VoiceChannel />;
    }
    
    // Default to text chat
    return <Chat />;
  };
  
  return (
    <div className="dashboard">
      <ServerList />
      
      <Sidebar>
        {isInDirectMessages ? (
          <DirectMessages />
        ) : (
          <ChannelList />
        )}
      </Sidebar>
      
      {renderMainContent()}
    </div>
  );
};

export default Dashboard;
