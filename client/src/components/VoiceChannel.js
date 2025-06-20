import React, { useEffect, useRef, useCallback } from 'react';
import { useVoice } from '../contexts/VoiceContext';
import { useAuth } from '../contexts/AuthContext';
import '../styles/VoiceChannel.css';

const VoiceChannel = () => {
  const { 
    inVoiceChannel, 
    connectedUsers, 
    localStream, 
    remoteStreams, 
    isMuted, 
    isVideoOff, 
    toggleMute, 
    toggleVideo,
    leaveVoiceChannel 
  } = useVoice();
  
  const { currentUser } = useAuth();
  const localVideoRef = useRef(null);
  
  // Настройка локального видеопотока
  const setupLocalVideo = useCallback(async (videoElement, stream) => {
    if (!videoElement) {
      console.log('Video element not found');
      return;
    }

    if (!stream) {
      videoElement.srcObject = null;
      videoElement.style.display = 'none';
      return;
    }

    const videoTracks = stream.getVideoTracks();
    const hasVideo = videoTracks.length > 0;
    
    console.log('Setting up local video:', {
      hasVideo,
      isVideoOff,
      streamState: stream.readyState
    });

    try {
      videoElement.srcObject = stream;
      
      // Set video element visibility based on track state
      videoElement.style.display = hasVideo && !isVideoOff ? 'block' : 'none';
      
      // Try to play video if it's enabled
      if (hasVideo && !isVideoOff) {
        await videoElement.play().catch(err => {
          console.warn('Error playing video:', err);
        });
      }
      
      console.log('Local video setup complete');
    } catch (err) {
      console.error('Error setting up local video:', err);
      videoElement.srcObject = null;
      videoElement.style.display = 'none';
    }
  }, [isVideoOff]);

  useEffect(() => {
    if (!localStream) {
      console.log('Нет локального потока');
      return;
    }

    const videoElement = localVideoRef.current;
    if (!videoElement) {
      console.log('Видеоэлемент не найден');
      return;
    }

    setupLocalVideo(videoElement, localStream);

    return () => {
      if (videoElement.srcObject) {
        console.log('Очистка локального видео при размонтировании');
        videoElement.srcObject = null;
      }
    };
  }, [localStream, setupLocalVideo]);
  
  // Если не в голосовом канале, не рендерим
  if (!inVoiceChannel) {
    return null;
  }
  
  // Компонент для отображения видеопотока
  const VideoStream = ({ userId, stream, username, isLocal = false }) => {
    const videoRef = useRef(null);
    
    const setupVideo = useCallback(async () => {
      const videoElement = videoRef.current;
      if (!videoElement || !stream) {
        console.log(`No video element or stream for ${username}`);
        return;
      }

      try {
        const videoTracks = stream.getVideoTracks();
        const hasVideoTrack = videoTracks.length > 0;
        const isVideoEnabled = hasVideoTrack && videoTracks[0].enabled;  // Убираем проверку isVideoOff, так как она уже учитывается в enabled

        console.log(`Setting up video for ${username}:`, {
          hasVideoTrack,
          isVideoEnabled,
          trackEnabled: hasVideoTrack ? videoTracks[0].enabled : false,
          isVideoOff
        });

        // Always set srcObject to ensure stream is attached
        if (videoElement.srcObject !== stream) {
          videoElement.srcObject = stream;
          console.log(`Set new stream for ${username}`);
        }

        // Show/hide video element based on track state
        if (videoElement.srcObject) {
          videoElement.style.display = isVideoEnabled ? 'block' : 'none';
          console.log(`Video display for ${username} set to: ${isVideoEnabled ? 'block' : 'none'}`);
        } else {
          console.log(`No srcObject for ${username}`);
        }
        videoElement.style.display = isVideoEnabled ? 'block' : 'none';

        if (isVideoEnabled) {
          try {
            // Only call play() if not already playing
            if (videoElement.paused) {
              await videoElement.play();
              console.log(`Started playback for ${username}`);
            }
          } catch (playError) {
            console.error(`Playback error for ${username}:`, playError);
          }
        }

        // Update track event listeners
        videoTracks.forEach(track => {
          track.onended = () => {
            console.log(`Video track ended for ${username}`);
            setupVideo();
          };
          track.onmute = () => {
            console.log(`Video track muted for ${username}`);
            setupVideo();
          };
          track.onunmute = () => {
            console.log(`Video track unmuted for ${username}`);
            setupVideo();
          };
        });

      } catch (err) {
        console.error(`Error setting up video for ${username}:`, err);
      }
    }, [stream, username, isVideoOff]);

    useEffect(() => {
      let mounted = true;

      const setup = async () => {
        if (mounted) {
          await setupVideo();
        }
      };

      setup();

      // Track stream changes
      const handleStreamChange = () => {
        if (mounted) {
          console.log(`Stream changed for ${username}`);
          setup();
        }
      };

      if (stream) {
        stream.addEventListener('addtrack', handleStreamChange);
        stream.addEventListener('removetrack', handleStreamChange);
      }

      return () => {
        mounted = false;
        const videoElement = videoRef.current;
        if (videoElement) {
          videoElement.srcObject = null;
          videoElement.load();
        }
        if (stream) {
          stream.removeEventListener('addtrack', handleStreamChange);
          stream.removeEventListener('removetrack', handleStreamChange);
        }
      // Check if stream has video tracks
      const hasVideoTracks = stream?.getVideoTracks().length > 0;
      // Check if video tracks are enabled
      const hasVideo = hasVideoTracks && stream?.getVideoTracks().some(track => track.enabled);
      // Check if microphone is muted
      const isMicMuted = stream?.getAudioTracks().length === 0 || 
                        stream?.getAudioTracks().every(track => !track.enabled);
    
      // Check if there's no media access
      const hasNoMediaAccess = isLocal && stream && stream.getTracks().length === 0;
      
      // Log media state
      console.log(`Media state for ${username} (${userId}):`, {
        hasVideoTracks,
        hasVideo,
        isMicMuted,
        hasNoMediaAccess,
        videoTracks: hasVideoTracks ? stream.getVideoTracks().map(t => ({
          id: t.id,
          enabled: t.enabled,
          muted: t.muted,
          label: t.label
        })) : 'No video tracks'
      });
      };
    }, [stream, setupVideo, username]);

    const hasVideoTrack = stream?.getVideoTracks().length > 0;
    const isVideoEnabled = hasVideoTrack && stream.getVideoTracks()[0].enabled && !isVideoOff;
    const hasAudioTrack = stream?.getAudioTracks().length > 0;
    const isAudioEnabled = hasAudioTrack && stream.getAudioTracks()[0].enabled && !isMuted;

    return (
      <div className={`video-container ${isLocal ? 'local' : ''}`}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
        />
        
        {(!stream || !isVideoEnabled) && (
          <div className="video-placeholder">
            <div className="avatar">
              {username ? username[0].toUpperCase() : '?'}
            </div>
            <div className="username">{username || 'Unknown'}</div>
            {hasVideoTrack && !isVideoEnabled && (
              <div className="video-status">Камера выключена</div>
            )}
          </div>
        )}

        <div className="video-overlay">
          <div className="user-info">
            <span className="username">{username}</span>
            <div className="status-indicators">
              {hasAudioTrack && (
                <i className={`fas fa-microphone${isAudioEnabled ? '' : '-slash'}`} 
                   title={isAudioEnabled ? 'Микрофон включен' : 'Микрофон выключен'} />
              )}
              {hasVideoTrack && (
                <i className={`fas fa-video${isVideoEnabled ? '' : '-slash'}`}
                   title={isVideoEnabled ? 'Камера включена' : 'Камера выключена'} />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  return (
    <div className="voice-channel-container">
      <div className="voice-header">
        <div className="voice-title">
          <h2>Голосовой канал</h2>
        </div>
        <div className="voice-controls">
          <button 
            className={`control-button ${isMuted ? 'active' : ''}`} 
            onClick={toggleMute}
            title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
          >
            <i className={`fas ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'}`}></i>
            <span className="control-label">
              {isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
            </span>
          </button>
          <button 
            className={`control-button ${isVideoOff ? 'active' : ''}`} 
            onClick={toggleVideo}
            title={isVideoOff ? 'Включить камеру' : 'Выключить камеру'}
          >
            <i className={`fas ${isVideoOff ? 'fa-video-slash' : 'fa-video'}`}></i>
            <span className="control-label">
              {isVideoOff ? 'Включить камеру' : 'Выключить камеру'}
            </span>
          </button>
          <button 
            className="control-button leave" 
            onClick={leaveVoiceChannel}
            title="Отключиться"
          >
            <i className="fas fa-phone-slash"></i>
            <span className="control-label">Отключиться</span>
          </button>
        </div>
      </div>
      
      <div className="video-grid">
        {/* Локальное видео */}
        <VideoStream 
          userId={currentUser?.id} 
          stream={localStream} 
          username={currentUser?.username} 
          isLocal={true} 
        />
        
        {/* Удаленные видео */}
        {connectedUsers
          .filter(user => user.id !== currentUser?.id)
          .map(user => (
            <VideoStream 
              key={user.id} 
              userId={user.id} 
              stream={remoteStreams[user.id]} 
              username={user.username} 
            />
          ))
        }
      </div>
    </div>
  );
};

export default VoiceChannel;
