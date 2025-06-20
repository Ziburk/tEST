import React, { useState } from 'react';
import { useServer } from '../../contexts/ServerContext';
import '../../styles/Modal.css';

const JoinServerModal = ({ onClose }) => {
  const { joinServer, error, loading } = useServer();
  const [inviteCode, setInviteCode] = useState('');
  const [serverName, setServerName] = useState('');
  const [joinMethod, setJoinMethod] = useState('name');
  const [localError, setLocalError] = useState('');
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (joinMethod === 'code' && !inviteCode.trim()) {
      setLocalError('Invite code is required');
      return;
    }
    
    if (joinMethod === 'name' && !serverName.trim()) {
      setLocalError('Server name is required');
      return;
    }
    
    try {
      if (joinMethod === 'code') {
        await joinServer({ inviteCode: inviteCode.trim() });
      } else {
        await joinServer({ serverName: serverName.trim() });
      }
      onClose();
    } catch (err) {
      setLocalError(err.message || 'Failed to join server');
    }
  };
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Join a Server</h2>
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
            <div className="join-method-selector" style={{ marginBottom: '15px' }}>
              <label>
                <input 
                  type="radio" 
                  name="joinMethod" 
                  value="name" 
                  checked={joinMethod === 'name'} 
                  onChange={() => setJoinMethod('name')} 
                />
                Join by Server Name
              </label>
              <label style={{ marginLeft: '15px' }}>
                <input 
                  type="radio" 
                  name="joinMethod" 
                  value="code" 
                  checked={joinMethod === 'code'} 
                  onChange={() => setJoinMethod('code')} 
                />
                Join by Invite Code
              </label>
            </div>
            
            {joinMethod === 'name' ? (
              <div className="form-group">
                <label htmlFor="server-name">Server Name</label>
                <input
                  type="text"
                  id="server-name"
                  value={serverName}
                  onChange={(e) => setServerName(e.target.value)}
                  placeholder="Enter the server name"
                  required={joinMethod === 'name'}
                />
              </div>
            ) : (
              <div className="form-group">
                <label htmlFor="invite-code">Invite Code</label>
                <input
                  type="text"
                  id="invite-code"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="Enter an invite code"
                  required={joinMethod === 'code'}
                />
                <small>Invite codes are 8 characters long</small>
              </div>
            )}
          </div>
          
          <div className="form-actions">
            <button type="button" className="button secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="button primary" disabled={loading}>
              {loading ? 'Joining...' : 'Join Server'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default JoinServerModal;
