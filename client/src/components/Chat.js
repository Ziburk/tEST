import React, { useState, useRef, useEffect } from 'react';
import { useServer } from '../contexts/ServerContext';
import { useChat } from '../contexts/ChatContext';
import { useAuth } from '../contexts/AuthContext';
import { useVoice } from '../contexts/VoiceContext';
import Message from './Message';
import '../styles/Chat.css';

const Chat = () => {
  const { currentUser } = useAuth();
  const { currentServer, currentChannel, members } = useServer();
  const { 
    messages, 
    directMessages, 
    activeDirectChat, 
    sendChannelMessage, 
    sendDirectMessage,
    startTyping,
    stopTyping,
    typing
  } = useChat();
  const { inVoiceChannel, isMuted, toggleMute, connectedUsers } = useVoice();
  
  const [messageInput, setMessageInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messageEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  
  // Determine which messages to display
  const displayMessages = activeDirectChat 
    ? (directMessages[activeDirectChat.id] || [])
    : messages;
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [displayMessages]);
  
  const scrollToBottom = () => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  const handleSendMessage = (e) => {
    e.preventDefault();
    
    if (!messageInput.trim()) return;
    
    if (activeDirectChat) {
      sendDirectMessage(activeDirectChat.id, messageInput);
    } else if (currentChannel && currentChannel.type === 'text') {
      sendChannelMessage(messageInput);
    }
    
    setMessageInput('');
    stopTypingIndicator();
  };
  
  const handleInputChange = (e) => {
    setMessageInput(e.target.value);
    
    // Handle typing indicator
    if (!isTyping && e.target.value.trim()) {
      setIsTyping(true);
      startTyping();
    }
    
    // Reset typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(stopTypingIndicator, 3000);
  };
  
  const stopTypingIndicator = () => {
    if (isTyping) {
      setIsTyping(false);
      stopTyping();
    }
  };
  
  // Render functions
  const renderHeader = () => {
    if (activeDirectChat) {
      // Определяем аватар для тестовых пользователей
      const isTestUser = activeDirectChat.username && 
        (activeDirectChat.username === 'testuser1' || 
         activeDirectChat.username === 'testuser2' || 
         activeDirectChat.username === 'testuser3');
      
      const userAvatar = isTestUser ? 
        `/images/avatar${activeDirectChat.username.replace('testuser', '')}.svg` : 
        activeDirectChat.avatar;
      
      return (
        <div className="chat-header">
          <div className="header-icon">
            {userAvatar ? (
              <img src={userAvatar} alt={activeDirectChat.username} className="avatar-image" />
            ) : (
              <div className="avatar-placeholder">{activeDirectChat.username[0]}</div>
            )}
          </div>
          <div className="header-info">
            <h3>{activeDirectChat.username}</h3>
            <span className={`user-status ${activeDirectChat.status}`}>
              {activeDirectChat.status || 'offline'}
            </span>
          </div>
        </div>
      );
    } else if (currentChannel) {
      return (
        <div className="chat-header">
          <div className="header-icon">
            {currentChannel.type === 'text' ? (
              <i className="fas fa-hashtag"></i>
            ) : (
              <i className="fas fa-volume-up"></i>
            )}
          </div>
          <div className="header-info">
            <h3>{currentChannel.name}</h3>
            <span className="channel-topic">
              {currentChannel.type === 'voice' ? (
                <span className="voice-users">
                  {connectedUsers.length} user{connectedUsers.length !== 1 ? 's' : ''} connected
                </span>
              ) : (
                <span>Text channel in {currentServer?.name}</span>
              )}
            </span>
          </div>
        </div>
      );
    }
    
    return <div className="chat-header empty">Select a channel to start chatting</div>;
  };
  
  const renderVoiceControls = () => {
    if (currentChannel?.type === 'voice' && inVoiceChannel) {
      return (
        <div className="voice-controls">
          <button 
            className={`voice-button ${isMuted ? 'muted' : ''}`} 
            onClick={toggleMute}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            <i className={`fas ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'}`}></i>
          </button>
          
          <div className="connected-users">
            {connectedUsers.map(user => (
              <div key={user.id} className="voice-user">
                <span>{user.username}</span>
                {user.muted && <i className="fas fa-microphone-slash"></i>}
              </div>
            ))}
          </div>
        </div>
      );
    }
    
    return null;
  };
  
  const renderMessages = () => {
    if (displayMessages.length === 0) {
      return (
        <div className="empty-chat">
          {activeDirectChat ? (
            <>
              <h3>No messages yet with {activeDirectChat.username}</h3>
              <p>Start the conversation by sending a message!</p>
            </>
          ) : currentChannel ? (
            <>
              <h3>Welcome to #{currentChannel.name}!</h3>
              <p>This is the beginning of the channel.</p>
            </>
          ) : (
            <h3>Select a channel to start chatting</h3>
          )}
        </div>
      );
    }
    
    // Group messages by sender and date
    const groupedMessages = [];
    let lastSender = null;
    let lastDate = null;
    
    displayMessages.forEach((message, index) => {
      const messageDate = new Date(message.created_at).toLocaleDateString();
      
      // Add date separator if this is a new day
      if (messageDate !== lastDate) {
        groupedMessages.push({
          type: 'date',
          date: messageDate,
          id: `date-${index}`
        });
        lastDate = messageDate;
        lastSender = null; // Reset sender grouping on new date
      }
      
      // If same sender and within 5 minutes, group with previous message
      if (message.sender_id === lastSender?.sender_id && 
          Math.abs(new Date(message.created_at) - new Date(lastSender.created_at)) < 300000) {
        const lastGroup = groupedMessages[groupedMessages.length - 1];
        if (lastGroup.type === 'messages') {
          lastGroup.messages.push(message);
        }
      } else {
        // Start a new message group
        groupedMessages.push({
          type: 'messages',
          sender_id: message.sender_id,
          messages: [message]
        });
      }
      
      lastSender = message;
    });
    
    return (
      <div className="messages">
        {groupedMessages.map((group, index) => {
          if (group.type === 'date') {
            return (
              <div key={group.id} className="date-separator">
                <span>{group.date}</span>
              </div>
            );
          } else {
            const sender = members?.find(m => m.id === group.sender_id) || 
                          { username: group.messages[0].username, avatar: group.messages[0].avatar };
            
            return (
              <Message 
                key={group.messages[0].id} 
                messages={group.messages}
                sender={sender}
                isOwnMessage={group.sender_id === currentUser?.id}
              />
            );
          }
        })}
        
        {/* Typing indicators */}
        {typing && Object.keys(typing).length > 0 && currentChannel && typing[currentChannel.id] && (
          <div className="typing-indicator">
            {Object.values(typing[currentChannel.id]).join(', ')} {Object.values(typing[currentChannel.id]).length === 1 ? 'is' : 'are'} typing...
          </div>
        )}
        
        <div ref={messageEndRef} />
      </div>
    );
  };
  
  const renderMessageInput = () => {
    if (currentChannel?.type === 'text' || activeDirectChat) {
      return (
        <form className="message-form" onSubmit={handleSendMessage}>
          <div className="message-input-actions">
            <button 
              type="button" 
              className="action-button" 
              title="Add attachment">
              <i className="fas fa-paperclip"></i>
            </button>
            <button 
              type="button" 
              className="action-button" 
              title="Add emoji">
              <i className="fas fa-smile"></i>
            </button>
          </div>
          
          <input
            type="text"
            value={messageInput}
            onChange={handleInputChange}
            placeholder={`Message ${activeDirectChat ? activeDirectChat.username : `#${currentChannel?.name}`}`}
          />
          
          <button 
            type="submit" 
            className="send-button" 
            disabled={!messageInput.trim()}
          >
            <img src="/images/send-message.svg" alt="Send" className="send-icon" />
          </button>
        </form>
      );
    }
    
    return null;
  };
  
  return (
    <div className="chat">
      {renderHeader()}
      
      <div className="chat-content">
        {renderVoiceControls()}
        {renderMessages()}
      </div>
      
      {renderMessageInput()}
    </div>
  );
};

export default Chat;
