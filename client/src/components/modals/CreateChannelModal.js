
import React, { useState } from 'react';
import { useServer } from '../../contexts/ServerContext';
import '../../styles/Modal.css';

const CreateChannelModal = ({ serverId, channelType: initialType = 'text', onClose }) => {
  const { createChannel, error, loading } = useServer();
  const [channelName, setChannelName] = useState('');
  const [channelType, setChannelType] = useState(initialType);
  const [localError, setLocalError] = useState('');
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!channelName.trim()) {
      setLocalError('Channel name is required');
      return;
    }
    
    try {
      await createChannel({ 
        name: channelName, 
        type: channelType,
        serverId
      });
      onClose();
    } catch (err) {
      setLocalError(err.message || 'Failed to create channel');
    }
  };
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create Channel</h2>
          <button className="close-button" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>
        
        {(localError || error) && (
          <div className="modal-error">
            {localError || error}
          </div>
        )}
        
        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Channel Type</label>
            <div className="channel-type-selector">
              <button
                type="button"
                className={`type-button ${channelType === 'text' ? 'active' : ''}`}
                onClick={() => setChannelType('text')}
              >
                <i className="fas fa-hashtag"></i>
                <span>Text Channel</span>
              </button>
              <button
                type="button"
                className={`type-button ${channelType === 'voice' ? 'active' : ''}`}
                onClick={() => setChannelType('voice')}
              >
                <i className="fas fa-volume-up"></i>
                <span>Voice Channel</span>
              </button>
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="channel-name">
              {channelType === 'text' ? 'Text' : 'Voice'} Channel Name
            </label>
            <div className="channel-name-input">
              {channelType === 'text' ? (
                <i className="fas fa-hashtag"></i>
              ) : (
                <i className="fas fa-volume-up"></i>
              )}
              <input
                type="text"
                id="channel-name"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                placeholder={`${channelType === 'text' ? 'new-channel' : 'New Channel'}`}
                required
              />
            </div>
            {channelType === 'text' && (
              <small>Use lowercase letters, numbers and hyphens</small>
            )}
          </div>
          
          <div className="form-actions">
            <button type="button" className="button secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="button primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Channel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateChannelModal;
