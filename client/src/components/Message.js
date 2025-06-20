import React, { useState } from 'react';
import { useChat } from '../contexts/ChatContext';
import '../styles/Message.css';

const Message = (props) => {
  const { deleteMessage } = useChat();
  const [showOptions, setShowOptions] = useState(false);
  
  // Проверяем, какой тип props передан - для DirectChat или для Chat
  const isDirectChatMode = props.message && props.isCurrentUser !== undefined;
  const isGroupChatMode = props.messages && props.sender && props.isOwnMessage !== undefined;
  
  // Если нет ни одного режима, значит пропсы некорректные
  if (!isDirectChatMode && !isGroupChatMode) {
    console.error('Message component received invalid props', props);
    return null;
  }
  
  // Функция форматирования времени
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  // Функция удаления сообщения
  const handleDelete = (messageId) => {
    if (window.confirm('Are you sure you want to delete this message?')) {
      deleteMessage && deleteMessage(messageId);
    }
  };
  
  // Отрисовка для режима DirectChat
  if (isDirectChatMode) {
    const { message, isCurrentUser } = props;
    
    // Безопасно получаем данные из сообщения
    if (!message) return null;
    
    const senderUsername = message.sender_name || message.username || 'Unknown';
    const content = message.content || '';
    const timestamp = message.created_at || new Date().toISOString();
    
    // Определяем аватар
    const userAvatar = message.avatar || null;
    
    return (
      <div 
        className={`message-single ${isCurrentUser ? 'own-message' : ''}`}
        onMouseEnter={() => setShowOptions(true)}
        onMouseLeave={() => setShowOptions(false)}
      >
        {!isCurrentUser && (
          <div className="message-avatar">
            {userAvatar ? (
              <img src={userAvatar} alt={senderUsername} className="avatar-image" />
            ) : (
              <div className="avatar-placeholder">{senderUsername.charAt(0).toUpperCase()}</div>
            )}
          </div>
        )}
        
        <div className="message-content">
          {!isCurrentUser && (
            <div className="message-header">
              <span className="message-author">{senderUsername}</span>
              <span className="message-time">{formatTime(timestamp)}</span>
            </div>
          )}
          
          <div className="message-text-container">
            <div className="message-text">
              <p>{content}</p>
              
              {showOptions && isCurrentUser && (
                <div className="message-options">
                  <button
                    className="delete-button"
                    onClick={() => handleDelete(message.id)}
                    title="Delete Message"
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                </div>
              )}
            </div>
            
            {isCurrentUser && (
              <div className="message-time-own">{formatTime(timestamp)}</div>
            )}
          </div>
        </div>
      </div>
    );
  }
  
  // Отрисовка для режима Chat (группировка сообщений)
  if (isGroupChatMode) {
    const { messages, sender, isOwnMessage } = props;
    
    if (!messages || !messages.length || !sender) return null;
    
    // Определяем аватар
    const userAvatar = sender.avatar || null;
    const senderUsername = sender.username || 'Unknown';
    
    return (
      <div 
        className={`message-group ${isOwnMessage ? 'own-message' : ''}`}
        onMouseEnter={() => setShowOptions(true)}
        onMouseLeave={() => setShowOptions(false)}
      >
        <div className="message-avatar">
          {userAvatar ? (
            <img src={userAvatar} alt={senderUsername} className="avatar-image" />
          ) : (
            <div className="avatar-placeholder">{senderUsername.charAt(0).toUpperCase()}</div>
          )}
        </div>
        
        <div className="message-content">
          <div className="message-header">
            <span className="message-author">{senderUsername}</span>
            <span className="message-time">{formatTime(messages[0].created_at)}</span>
          </div>
          
          <div className="message-text-container">
            {messages.map((message, index) => (
              <div key={message.id} className="message-text">
                <p>{message.content}</p>
                
                {showOptions && isOwnMessage && (
                  <div className="message-options">
                    <button
                      className="delete-button"
                      onClick={() => handleDelete(message.id)}
                      title="Delete Message"
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  
  return null; // На всякий случай
};

export default Message;
