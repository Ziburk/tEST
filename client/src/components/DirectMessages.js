import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChat } from '../contexts/ChatContext';
import UserList from './UserList';
import '../styles/DirectMessages.css';

const DirectMessages = () => {
  const { contacts, activeDirectChat, setActiveDirectChat, fetchContacts } = useChat();
  const navigate = useNavigate();
  
  // Fetch contacts on component mount
  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);
  
  const handleContactClick = (contact) => {
    setActiveDirectChat(contact);
    navigate(`/direct/${contact.id}`);
  };
  
  return (
    <div className="direct-messages">
      <div className="dm-header">
        <h3>DIRECT MESSAGES</h3>
      </div>
      
      {/* Show existing contacts if any */}
      {contacts.length > 0 && (
        <div className="section">
          <h4 className="section-title">Recent Conversations</h4>
          <ul className="contact-list">
            {contacts.map(contact => (
              <li
                key={contact.id}
                className={`contact ${activeDirectChat?.id === contact.id ? 'active' : ''}`}
                onClick={() => handleContactClick(contact)}
              >
                <div className="contact-avatar">
                  {contact.avatar ? (
                    <img src={contact.avatar} alt={contact.username} />
                  ) : (
                    <div className="avatar-placeholder">{contact.username[0]}</div>
                  )}
                  <div className={`status-indicator ${contact.status || 'offline'}`}></div>
                </div>
                
                <div className="contact-info">
                  <span className="contact-name">{contact.username}</span>
                  <span className="contact-status">
                    {contact.status === 'online' ? 'Online' : 'Offline'}
                  </span>
                </div>
                
                {contact.unread_count > 0 && (
                  <div className="unread-badge">
                    {contact.unread_count}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Always show the UserList with test users */}
      <div className="section">
        <UserList />
      </div>
    </div>
  );
};

export default DirectMessages;
