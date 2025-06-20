import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useChat } from '../contexts/ChatContext';

import ServerList from '../components/ServerList';
import Sidebar from '../components/Sidebar';
import DirectChat from '../components/DirectChat';
import DirectMessages from '../components/DirectMessages';

import '../styles/Dashboard.css';

const DirectMessagesPage = () => {
  const { userId } = useParams();
  const { 
    activeDirectChat, 
    setActiveDirectChat,
    fetchContacts
  } = useChat();
  
  // Загружаем контакты при монтировании компонента
  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);
  
  // Получаем данные пользователя при наличии userId
  useEffect(() => {
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
          }
        } catch (err) {
          console.error('Error fetching user:', err);
        }
      };
      
      fetchUser();
    }
  }, [userId, setActiveDirectChat]);
  
  // Отображаем основной контент
  const renderMainContent = () => {
    // Если выбран пользователь для чата
    if (activeDirectChat) {
      return <DirectChat />;
    }
    
    // Если пользователь не выбран, показываем приветственное сообщение
    return (
      <div className="welcome-direct-messages">
        <h2>Выберите контакт для общения</h2>
        <p>Нажмите на любого пользователя слева, чтобы начать чат</p>
      </div>
    );
  };
  
  return (
    <div className="dashboard">
      <ServerList />
      
      <Sidebar>
        <DirectMessages />
      </Sidebar>
      
      {renderMainContent()}
    </div>
  );
};

export default DirectMessagesPage;
