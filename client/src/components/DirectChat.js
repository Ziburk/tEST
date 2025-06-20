import React, { useEffect, useRef, useState } from 'react';
import { useChat } from '../contexts/ChatContext';
import { useAuth } from '../contexts/AuthContext';
import Message from './Message';
import MessageInput from './MessageInput';
import '../styles/DirectChat.css';

const DirectChat = () => {
  const { 
    directMessages, 
    activeDirectChat, 
    sendDirectMessage,
    getTypingUsers,
    fetchDirectMessages
  } = useChat();
  
  const { currentUser } = useAuth();
  const messagesEndRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasLoadedMessages, setHasLoadedMessages] = useState(false);
  
  // Загружаем сообщения только один раз при смене активного чата
  // Используем useRef для отслеживания предыдущего ID чата
  const prevChatIdRef = useRef(null);

  useEffect(() => {
    // Загружаем сообщения только при изменении активного чата
    const currentChatId = activeDirectChat?.id;
    if (!currentChatId) return;
    
    // Если ID чата изменился, загружаем новые сообщения
    if (currentChatId !== prevChatIdRef.current) {
      const loadMessages = async () => {
        try {
          setLoading(true);
          setError(null);
          await fetchDirectMessages(currentChatId);
          setHasLoadedMessages(true);
        } catch (err) {
          console.error('Error loading direct messages:', err);
          setError('Failed to load messages');
        } finally {
          setLoading(false);
        }
      };
      
      loadMessages();
      prevChatIdRef.current = currentChatId;
    }
  }, [activeDirectChat?.id]);
  
  // Скролл к последнему сообщению при получении новых сообщений
  useEffect(() => {
    if (messagesEndRef.current && !loading) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [loading, activeDirectChat?.id && directMessages[activeDirectChat.id]]);
  
  if (!activeDirectChat) {
    return (
      <div className="direct-chat empty-state">
        <div className="empty-state-content">
          <h3>Select a contact to start chatting</h3>
          <p>You can send direct messages to any user in your contacts list.</p>
        </div>
      </div>
    );
  }
  
  // Добавляем проверку на существование activeDirectChat
  const messages = activeDirectChat?.id ? (directMessages[activeDirectChat.id] || []) : [];
  const typingUsers = activeDirectChat?.id ? getTypingUsers(activeDirectChat.id) : [];
  
  const handleSendMessage = async (content) => {
    if (content.trim() && activeDirectChat?.id) {
      await sendDirectMessage(activeDirectChat.id, content);
    }
  };
  
  return (
    <div className="direct-chat">
      <div className="direct-chat-header">
        <div className="user-info">
          <div className={`avatar ${activeDirectChat?.status || 'offline'}`}>
            {activeDirectChat?.avatar ? (
              <img src={activeDirectChat.avatar} alt={activeDirectChat.username || 'User'} />
            ) : (
              (activeDirectChat?.username?.charAt(0) || '?').toUpperCase()
            )}
          </div>
          <div className="user-details">
            <span className="username">{activeDirectChat?.username || 'Unknown User'}</span>
            <span className="status">{activeDirectChat?.status || 'offline'}</span>
          </div>
        </div>
      </div>
      
      <div className="direct-chat-messages">
        {loading ? (
          <div className="loading-messages">Loading messages...</div>
        ) : error ? (
          <div className="error-messages">{error}</div>
        ) : messages.length === 0 ? (
          <div className="no-messages">
            <p>No messages yet. Start a conversation with {activeDirectChat.username}!</p>
          </div>
        ) : (
          <>
            {messages.map((message, index) => (
              <Message
                key={`${message.id}-${index}-${message.created_at}`}
                message={message}
                isCurrentUser={message.sender_id === currentUser.id}
                isDirect={true}
              />
            ))}
            {typingUsers.length > 0 && (
              <div className="typing-indicator">
                {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>
      
      <div className="message-input-wrapper">
        <MessageInput onSendMessage={handleSendMessage} />
      </div>
    </div>
  );
};

export default DirectChat;
