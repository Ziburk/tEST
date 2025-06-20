import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useServer } from '../contexts/ServerContext';
import { useVoice } from '../contexts/VoiceContext';
import CreateChannelModal from './modals/CreateChannelModal';
import '../styles/ChannelList.css';

const ChannelList = () => {
  const { currentServer, channels, currentChannel } = useServer();
  const { inVoiceChannel, joinVoiceChannel, leaveVoiceChannel } = useVoice();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [channelType, setChannelType] = useState('text');
  const navigate = useNavigate();
  
  if (!currentServer) {
    return <div className="channel-list empty">Select a server to view channels</div>;
  }
  
  // Split channels by type
  const textChannels = channels.filter(channel => channel.type === 'text');
  const voiceChannels = channels.filter(channel => channel.type === 'voice');
  
  const handleChannelClick = (channel) => {
    if (channel.type === 'text') {
      navigate(`/channels/${currentServer.id}/${channel.id}`);
    } else if (channel.type === 'voice') {
      // If already in a voice channel, leave it first
      if (inVoiceChannel && currentChannel?.id !== channel.id) {
        leaveVoiceChannel();
      }
      
      // Join the selected voice channel
      if (!inVoiceChannel || currentChannel?.id !== channel.id) {
        joinVoiceChannel(channel.id);
      }
      
      navigate(`/channels/${currentServer.id}/${channel.id}`);
    }
  };
  
  return (
    <div className="channel-list">
      <div className="channel-category">
        <div className="category-header">
          <span>TEXT CHANNELS</span>
          {currentServer && (
            <button 
              className="add-channel-btn" 
              onClick={() => {
                setChannelType('text');
                setShowCreateModal(true);
              }} 
              title="Create Text Channel"
            >
              <img src="/images/add-channel.svg" alt="Add Text Channel" className="add-channel-icon" />
            </button>
          )}
        </div>
        
        {textChannels.length > 0 ? (
          <ul className="channels">
            {textChannels.map(channel => (
              <li 
                key={channel.id} 
                className={`channel ${currentChannel?.id === channel.id ? 'active' : ''}`}
                onClick={() => handleChannelClick(channel)}
              >
                <i className="fas fa-hashtag"></i>
                <span>{channel.name}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="no-channels">No text channels</div>
        )}
      </div>
      
      <div className="channel-category">
        <div className="category-header">
          <span>VOICE CHANNELS</span>
          {currentServer && (
            <button 
              className="add-channel-btn" 
              onClick={() => {
                setChannelType('voice');
                setShowCreateModal(true);
              }} 
              title="Create Voice Channel"
            >
              <img src="/images/add-channel.svg" alt="Add Voice Channel" className="add-channel-icon" />
            </button>
          )}
        </div>
        
        {voiceChannels.length > 0 ? (
          <ul className="channels">
            {voiceChannels.map(channel => (
              <li 
                key={channel.id} 
                className={`channel ${currentChannel?.id === channel.id ? 'active' : ''}`}
                onClick={() => handleChannelClick(channel)}
              >
                <i className={`fas ${inVoiceChannel && currentChannel?.id === channel.id ? 'fa-volume-up' : 'fa-volume-off'}`}></i>
                <span>{channel.name}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="no-channels">No voice channels</div>
        )}
      </div>
      
      {showCreateModal && (
        <CreateChannelModal 
          serverId={currentServer.id}
          channelType={channelType}
          onClose={() => setShowCreateModal(false)} 
        />
      )}
    </div>
  );
};

export default ChannelList;
