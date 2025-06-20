import React, { useState } from 'react';
import { useServer } from '../../contexts/ServerContext';
import '../../styles/Modal.css';

const CreateServerModal = ({ onClose }) => {
  const { createServer, error, loading } = useServer();
  const [serverName, setServerName] = useState('');
  const [serverIcon, setServerIcon] = useState('');
  const [localError, setLocalError] = useState('');
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!serverName.trim()) {
      setLocalError('Server name is required');
      return;
    }
    
    try {
      await createServer({ name: serverName, icon: serverIcon });
      onClose();
    } catch (err) {
      setLocalError(err.message || 'Failed to create server');
    }
  };
  
  // Handle icon upload (in a real app, this would upload to a storage service)
  const handleIconChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setServerIcon(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create a New Server</h2>
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
            <label htmlFor="server-name">Server Name</label>
            <input
              type="text"
              id="server-name"
              value={serverName}
              onChange={(e) => setServerName(e.target.value)}
              placeholder="Enter server name"
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="server-icon">Server Icon (Optional)</label>
            <div className="icon-preview">
              {serverIcon ? (
                <img src={serverIcon} alt="Server icon" />
              ) : (
                <div className="placeholder">
                  {serverName ? serverName[0].toUpperCase() : 'S'}
                </div>
              )}
            </div>
            <input
              type="file"
              id="server-icon"
              onChange={handleIconChange}
              accept="image/*"
            />
          </div>
          
          <div className="form-actions">
            <button type="button" className="button secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="button primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Server'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateServerModal;
