import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { useServer } from './ServerContext';
import apiService from '../services/apiService';

const ChatContext = createContext();

export const useChat = () => useContext(ChatContext);

export const ChatProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const { currentServer, currentChannel } = useServer();
  const [messages, setMessages] = useState([]);
  const [directMessages, setDirectMessages] = useState({});
  const [activeDirectChat, setActiveDirectChat] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [typing, setTyping] = useState({});
  const socketRef = useRef(null);
  const [contacts, setContacts] = useState([]);

  // Initialize Socket.io connection when user is authenticated
  useEffect(() => {
    if (currentUser) {
      const token = localStorage.getItem('token');
      
      // Connect to the Socket.io server
      socketRef.current = io('http://localhost:5000', {
        auth: { token }
      });
      
      // Setup socket event listeners
      setupSocketListeners();
      
      // Fetch user's direct message contacts
      fetchContacts();
      
      return () => {
        // Disconnect socket on cleanup
        if (socketRef.current) {
          socketRef.current.disconnect();
        }
      };
    }
  }, [currentUser]);

  // Join server and channel rooms when they change
  useEffect(() => {
    if (socketRef.current && currentServer) {
      // Join server room
      socketRef.current.emit('server:join', currentServer.id);
      
      return () => {
        socketRef.current.emit('server:leave', currentServer.id);
      };
    }
  }, [currentServer]);

  useEffect(() => {
    if (socketRef.current && currentChannel) {
      // Join channel room and fetch messages
      socketRef.current.emit('channel:join', currentChannel.id);
      fetchChannelMessages(currentChannel.id);
      
      return () => {
        socketRef.current.emit('channel:leave', currentChannel.id);
      };
    } else {
      setMessages([]);
    }
  }, [currentChannel]);

  // Load direct messages when active direct chat changes
  useEffect(() => {
    if (activeDirectChat) {
      fetchDirectMessages(activeDirectChat.id);
    }
  }, [activeDirectChat]);

  const setupSocketListeners = () => {
    const socket = socketRef.current;
    
    // Listen for channel messages
    socket.on('message:channel', (messageData) => {
      if (currentChannel && messageData.channelId === currentChannel.id) {
        setMessages(prev => [...prev, {
          id: messageData.id,
          channel_id: messageData.channelId,
          sender_id: messageData.senderId,
          content: messageData.content,
          username: messageData.senderName,
          created_at: messageData.timestamp
        }]);
      }
    });
    
    // Listen for direct messages
    socket.on('direct_message', (messageData) => {
      const otherUserId = messageData.sender_id === currentUser.id ? messageData.receiver_id : messageData.sender_id;
      
      // Update direct messages for this user
      setDirectMessages(prev => {
        const existingMessages = prev[otherUserId] || [];
        return {
          ...prev,
          [otherUserId]: [...existingMessages, messageData]
        };
      });
      
      // Update unread count in contacts if the message is received (not sent by current user)
      // and the message is not in the active direct chat
      if (messageData.sender_id !== currentUser.id && (!activeDirectChat || activeDirectChat.id !== messageData.sender_id)) {
        setContacts(prev => prev.map(contact => {
          if (contact.id === messageData.sender_id) {
            return {
              ...contact,
              unread_count: (contact.unread_count || 0) + 1
            };
          }
          return contact;
        }));
      }
    });
    
    // Listen for direct messages
    socket.on('message:direct', (messageData) => {
      const otherUserId = messageData.senderId;
      
      // Update direct messages for this user
      setDirectMessages(prev => {
        const existingMessages = prev[otherUserId] || [];
        return {
          ...prev,
          [otherUserId]: [...existingMessages, {
            id: messageData.id,
            sender_id: messageData.senderId,
            content: messageData.content,
            username: messageData.senderName,
            created_at: messageData.timestamp,
            read: false
          }]
        };
      });
      
      // Update unread count in contacts
      setContacts(prev => prev.map(contact => {
        if (contact.id === otherUserId) {
          return {
            ...contact,
            unread_count: (contact.unread_count || 0) + 1
          };
        }
        return contact;
      }));
    });
    
    // Listen for user status updates
    socket.on('user:status', ({ userId, status }) => {
      // Update contacts status
      setContacts(prev => prev.map(contact => {
        if (contact.id === userId) {
          return { ...contact, status };
        }
        return contact;
      }));
    });
    
    // Listen for typing indicators
    socket.on('typing:start', ({ userId, username }) => {
      setTyping(prev => ({
        ...prev,
        [currentChannel?.id || activeDirectChat?.id]: {
          ...prev[currentChannel?.id || activeDirectChat?.id],
          [userId]: username
        }
      }));
    });
    
    socket.on('typing:stop', ({ userId }) => {
      setTyping(prev => {
        const channelTyping = { ...prev[currentChannel?.id || activeDirectChat?.id] };
        delete channelTyping[userId];
        return {
          ...prev,
          [currentChannel?.id || activeDirectChat?.id]: channelTyping
        };
      });
    });
  };

  const fetchChannelMessages = async (channelId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.get(`/messages/channel/${channelId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      setMessages(response.data.messages || []);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching channel messages:', err);
      setError('Failed to load messages');
      setLoading(false);
    }
  };

  const fetchDirectMessages = async (userId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.get(`/direct-messages/${userId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      // Store messages in state
      setDirectMessages(prev => ({
        ...prev,
        [userId]: response.data.messages || []
      }));
      
      // Mark messages as read
      markDirectMessagesAsRead(userId);
      
      setLoading(false);
    } catch (err) {
      console.error('Error fetching direct messages:', err);
      setError('Failed to load messages');
      setLoading(false);
    }
  };

  // Функция fetchDirectMessages перемещена выше, чтобы избежать дублирования

  const fetchContacts = async () => {
    try {
      const response = await apiService.get('/direct-messages', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      setContacts(response.data.contacts || []);
    } catch (err) {
      console.error('Error fetching contacts:', err);
    }
  };
  
  // Mark direct messages as read
  const markDirectMessagesAsRead = (userId) => {
    // Update contact unread count
    setContacts(prev => prev.map(contact => {
      if (contact.id === userId) {
        return {
          ...contact,
          unread_count: 0
        };
      }
      return contact;
    }));
  };

  const sendChannelMessage = async (content) => {
    if (!currentChannel || !content.trim()) return;
    
    try {
      const response = await apiService.post(`/messages/channel/${currentChannel.id}`, { content }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      const newMessage = response.data.messageData;
      
      // Add message to local state
      setMessages(prev => [...prev, newMessage]);
      
      // Emit the message to other users in the channel
      socketRef.current.emit('message:channel', {
        id: newMessage.id,
        channelId: newMessage.channel_id,
        content: newMessage.content
      });
      
      return newMessage;
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message');
      throw err;
    }
  };
  
  const sendDirectMessage = async (userId, content) => {
    if (!userId || !content.trim()) return;
    
    try {
      const response = await apiService.post(`/messages/direct/${userId}`, { content }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      const newMessage = response.data.messageData;
      
      // Add message to local state
      setDirectMessages(prev => {
        const existingMessages = prev[userId] || [];
        return {
          ...prev,
          [userId]: [...existingMessages, newMessage]
        };
      });
      
      // Emit the message to the recipient
      socketRef.current.emit('message:direct', {
        id: newMessage.id,
        receiverId: userId,
        content: newMessage.content
      });
      
      // Add user to contacts if not already there
      if (!contacts.find(contact => contact.id === userId)) {
        fetchContacts();
      }
      
      return newMessage;
    } catch (err) {
      console.error('Error sending direct message:', err);
      setError('Failed to send direct message');
      throw err;
    }
  };

  const startTyping = () => {
    if (currentChannel) {
      socketRef.current.emit('typing:start', { channelId: currentChannel.id });
    } else if (activeDirectChat) {
      socketRef.current.emit('direct:typing:start', { userId: activeDirectChat.id });
    }
  };

  const stopTyping = () => {
    if (currentChannel) {
      socketRef.current.emit('typing:stop', { channelId: currentChannel.id });
    } else if (activeDirectChat) {
      socketRef.current.emit('direct:typing:stop', { userId: activeDirectChat.id });
    }
  };
  
  // Get list of users who are currently typing
  const getTypingUsers = (channelId) => {
    const channelTyping = typing[channelId] || {};
    return Object.values(channelTyping);
  };

  const deleteMessage = async (messageId, isDirect = false) => {
    try {
      if (isDirect) {
        await apiService.delete(`/messages/direct/${messageId}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        
        // Remove from local state
        if (activeDirectChat) {
          setDirectMessages(prev => {
            const existingMessages = prev[activeDirectChat.id] || [];
            return {
              ...prev,
              [activeDirectChat.id]: existingMessages.filter(msg => msg.id !== messageId)
            };
          });
        }
      } else {
        await apiService.delete(`/messages/${messageId}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        
        // Remove from local state
        setMessages(prev => prev.filter(msg => msg.id !== messageId));
      }
    } catch (err) {
      console.error('Error deleting message:', err);
      setError('Failed to delete message');
      throw err;
    }
  };

  const value = {
    messages,
    directMessages,
    loading,
    error,
    typing,
    contacts,
    activeDirectChat,
    setActiveDirectChat,
    sendChannelMessage,
    sendDirectMessage,
    fetchChannelMessages,
    fetchDirectMessages,
    fetchContacts,
    markDirectMessagesAsRead,
    getTypingUsers,
    startTyping,
    stopTyping,
    deleteMessage,
    socket: socketRef.current
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};

export default ChatContext;
