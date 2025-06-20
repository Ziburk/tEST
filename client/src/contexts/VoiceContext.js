import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useChat } from './ChatContext';
import { useServer } from './ServerContext';

// SimplePeer will be dynamically imported when needed
let SimplePeer;

// Check for WebRTC support
if (typeof window !== 'undefined') {
  if (!('RTCPeerConnection' in window)) {
    console.error('WebRTC is not supported in your browser');
  } else {
    // Dynamically import simple-peer when needed
    import('simple-peer').then(module => {
      SimplePeer = module.default || module;
    }).catch(err => {
      console.error('Failed to load simple-peer:', err);
    });
  }
}

// WebRTC support is now checked in the dynamic import section above

const VoiceContext = createContext();

export const useVoice = () => useContext(VoiceContext);

export const VoiceProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const { socket } = useChat();
  const { currentServer, currentChannel } = useServer();
  const [inVoiceChannel, setInVoiceChannel] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [error, setError] = useState(null);
  
  // Keep track of peer connections
  const peersRef = useRef({});
  // Keep track of audio streams from peers
  const streamsRef = useRef({});

  // Cleanup streams when unmounting
  useEffect(() => {
    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      
      // Close all peer connections
      Object.values(peersRef.current).forEach(peer => {
        if (peer && peer.destroy) {
          peer.destroy();
        }
      });
    };
  }, []);

  // Set up socket listeners when socket is available
  useEffect(() => {
    if (!socket || !currentUser) return;

    // Handle new user joining the voice channel
    socket.on('voice:user-joined', async ({ userId, username }) => {
      console.log(`User joined voice: ${username} (${userId})`);
      
      if (userId === currentUser.id) return; // Don't create connection to self
      
      // Add user to connected users list
      setConnectedUsers(prev => {
        if (!prev.find(user => user.id === userId)) {
          return [...prev, { id: userId, username }];
        }
        return prev;
      });
      
      // Get our local stream if we don't have it yet
      if (!localStream) {
        await startLocalStream();
      }
      
      // Create a new peer connection as the initiator
      const peer = createPeer(userId, true);
      peersRef.current[userId] = peer;
    });
    
    // Handle user leaving voice channel
    socket.on('voice:user-left', ({ userId }) => {
      console.log(`User left voice: ${userId}`);
      
      // Remove user from connected users list
      setConnectedUsers(prev => prev.filter(user => user.id !== userId));
      
      // Close and remove peer connection
      if (peersRef.current[userId]) {
        peersRef.current[userId].destroy();
        delete peersRef.current[userId];
      }
      
      // Remove audio stream
      if (streamsRef.current[userId]) {
        delete streamsRef.current[userId];
      }

      // Remove from remote streams
      setRemoteStreams(prev => {
        const newState = { ...prev };
        delete newState[userId];
        return newState;
      });
    });
    
    // Handle list of connected users when joining
    socket.on('voice:connected-users', (users) => {
      console.log('Connected voice users:', users);
      setConnectedUsers(users);
      
      // Initialize peer connections to each user
      users.forEach(async (user) => {
        if (user.id === currentUser.id) return; // Skip self
        
        // Get our local stream if we don't have it yet
        if (!localStream) {
          await startLocalStream();
        }
        
        // Create a new peer connection as the initiator
        const peer = createPeer(user.id, true);
        peersRef.current[user.id] = peer;
      });
    });
    
    // Handle WebRTC signaling
    socket.on('signal', async ({ userId, signal }) => {
      console.log(`Received signal from ${userId}`);
      
      // If we don't have a peer for this user yet, create one
      if (!peersRef.current[userId]) {
        // Get local stream if we don't have it
        if (!localStream) {
          await startLocalStream();
        }
        
        // Create peer as non-initiator
        const peer = createPeer(userId, false);
        peersRef.current[userId] = peer;
      }
      
      // Signal the peer
      peersRef.current[userId].signal(signal);
    });
    
    // Handle user mute/unmute
    socket.on('voice:mute-update', ({ userId, muted }) => {
      console.log(`User ${userId} ${muted ? 'muted' : 'unmuted'}`);
      
      // Update connected users list with mute status
      setConnectedUsers(prev => 
        prev.map(user => 
          user.id === userId 
            ? { ...user, muted } 
            : user
        )
      );
    });
    
    // Handle user camera toggle
    socket.on('voice:video-update', ({ userId, videoOff }) => {
      console.log(`User ${userId} ${videoOff ? 'turned off' : 'turned on'} camera`);
      
      // Update connected users list with video status
      setConnectedUsers(prev => 
        prev.map(user => 
          user.id === userId 
            ? { ...user, videoOff } 
            : user
        )
      );
    });
    
    return () => {
      socket.off('voice:user-joined');
      socket.off('voice:user-left');
      socket.off('voice:connected-users');
      socket.off('signal');
      socket.off('voice:mute-update');
      socket.off('voice:video-update');
    };
  }, [socket, currentUser, localStream]);

  // Create a peer connection
  const createPeer = (userId, isInitiator) => {
    console.log(`Creating peer with ${userId}, initiator: ${isInitiator}`);
    
    if (!SimplePeer) {
      console.error('SimplePeer is not loaded yet');
      return null;
    }
    
    const peer = new SimplePeer({
      initiator: isInitiator,
      trickle: false,
      stream: localStream
    });
    
    peer.on('signal', signal => {
      console.log(`Sending signal to ${userId}`);
      socket.emit('signal', { userId, signal });
    });
    
    peer.on('stream', stream => {
      console.log(`Received stream from ${userId}`);
      handleRemoteStream(userId, stream);
    });
    
    peer.on('error', err => {
      console.error(`Peer error with ${userId}:`, err);
      setError(`WebRTC error: ${err.message}`);
    });
    
    peer.on('close', () => {
      console.log(`Peer connection with ${userId} closed`);
      delete peersRef.current[userId];
    });
    
    return peer;
  };

  // Start local audio and video stream
  const startLocalStream = async () => {
    try {
      // Проверяем доступность медиа-устройств перед запросом
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasAudio = devices.some(device => device.kind === 'audioinput');
      const hasVideo = devices.some(device => device.kind === 'videoinput');
      
      console.log('Available devices:', { hasAudio, hasVideo });
      
      // Настраиваем ограничения в зависимости от доступных устройств
      const constraints = {
        audio: hasAudio,
        video: hasVideo ? {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user"
        } : false
      };
      
      console.log('Requesting media with constraints:', constraints);
      
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('Got local stream:', stream);
        
        // Apply state settings to tracks
        if (isMuted) {
          stream.getAudioTracks().forEach(track => {
            track.enabled = false;
          });
        }
        
        if (isVideoOff) {
          stream.getVideoTracks().forEach(track => {
            track.enabled = false;
          });
        }
        
        setLocalStream(stream);
        return stream;
      } catch (mediaErr) {
        console.error('Media error:', mediaErr);
        
        // Fallback: попробуем получить только аудио, если видео недоступно
        if (hasAudio && constraints.video) {
          try {
            console.log('Falling back to audio only');
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            setLocalStream(audioStream);
            setIsVideoOff(true);
            return audioStream;
          } catch (audioErr) {
            console.error('Audio-only fallback failed:', audioErr);
          }
        }
        
        // Если всё еще не удалось - создаем пустой поток
        console.log('Creating empty stream as final fallback');
        const emptyStream = new MediaStream();
        setLocalStream(emptyStream);
        setIsVideoOff(true);
        setIsMuted(true);
        return emptyStream;
      }
    } catch (err) {
      console.error('Fatal error in startLocalStream:', err);
      const emptyStream = new MediaStream();
      setLocalStream(emptyStream);
      setIsVideoOff(true);
      setIsMuted(true);
      return emptyStream;
    }
  };
  
  // Store remote stream for UI rendering
  const handleRemoteStream = (userId, stream) => {
    console.log(`Received stream from ${userId}:`, stream);
    
    // Create an audio element for backward compatibility
    let audioElement = document.getElementById(`audio-${userId}`);
    
    if (!audioElement) {
      audioElement = document.createElement('audio');
      audioElement.id = `audio-${userId}`;
      audioElement.autoplay = true;
      audioElement.controls = false;
      audioElement.style.display = 'none'; // Hidden audio element
      document.body.appendChild(audioElement);
    }
    
    audioElement.srcObject = stream;
    
    // Store stream in state for UI rendering
    setRemoteStreams(prev => ({
      ...prev,
      [userId]: stream
    }));
  };
  
  // Join a voice channel
  const joinVoiceChannel = async (channelId) => {
    if (inVoiceChannel) {
      console.log('Already in a voice channel');
      return false;
    }
    
    if (!socket) {
      console.error('Socket not connected');
      setError('Chat service not connected');
      return false;
    }
    
    try {
      // Получаем медиа-поток если его еще нет
      let stream = localStream;
      if (!stream) {
        try {
          stream = await startLocalStream();
          // Небольшая пауза для инициализации потока
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (mediaErr) {
          console.warn('Continuing with empty stream:', mediaErr);
          // Создаем пустой поток если не удалось получить медиа
          stream = new MediaStream();
          setLocalStream(stream);
          setIsVideoOff(true);
          setIsMuted(true);
        }
      }
      
      // Присоединяемся к голосовому каналу
      socket.emit('voice:join', { 
        channelId, 
        userId: currentUser.id, 
        username: currentUser.username,
        hasAudio: stream.getAudioTracks().length > 0,
        hasVideo: stream.getVideoTracks().length > 0
      });
      
      socket.emit('channel:join', channelId);
      
      // Отправляем начальные состояния микрофона и камеры
      socket.emit('voice:mute', { channelId, muted: isMuted });
      socket.emit('voice:video', { channelId, videoOff: isVideoOff });
      
      setInVoiceChannel(true);
      return true;
    } catch (err) {
      console.error('Error joining voice channel:', err);
      setError(`Ошибка подключения к голосовому каналу: ${err.message || 'Неизвестная ошибка'}`);
      return false;
    }
  };
  
  // Leave the voice channel
  const leaveVoiceChannel = async () => {
    if (!inVoiceChannel || !currentChannel) return;
    
    try {
      // Notify server about leaving
      socket.emit('channel:leave', currentChannel.id);
      
      // Stop local stream
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        setLocalStream(null);
      }
      
      // Close all peer connections
      Object.values(peersRef.current).forEach(peer => {
        if (peer && peer.destroy) {
          peer.destroy();
        }
      });
      
      peersRef.current = {};
      streamsRef.current = {};
      
      // Remove audio elements
      connectedUsers.forEach(user => {
        const audioElement = document.getElementById(`audio-${user.id}`);
        if (audioElement) {
          audioElement.remove();
        }
      });
      
      // Clear remote streams
      setRemoteStreams({});
      setConnectedUsers([]);
      setInVoiceChannel(false);
      return true;
    } catch (err) {
      console.error('Error leaving voice channel:', err);
      setError(`Failed to leave voice channel: ${err.message}`);
      return false;
    }
  };
  
  // Toggle mute
  const toggleMute = () => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      
      audioTracks.forEach(track => {
        track.enabled = isMuted; // toggle the state
      });
      
      setIsMuted(!isMuted);
      
      // Notify others about mute status
      if (socket && currentChannel) {
        socket.emit('voice:mute', { channelId: currentChannel.id, muted: !isMuted });
      }
    }
  };
  
  // Toggle video
  const toggleVideo = () => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      
      if (videoTracks.length > 0) {
        videoTracks.forEach(track => {
          track.enabled = isVideoOff; // toggle the state
        });
        
        setIsVideoOff(!isVideoOff);
        
        // Notify others about video status
        if (socket && currentChannel) {
          socket.emit('voice:video', { channelId: currentChannel.id, videoOff: !isVideoOff });
        }
      } else if (!isVideoOff) {
        // If we want to turn on video but don't have video tracks,
        // we need to re-acquire the stream with video
        navigator.mediaDevices.getUserMedia({ 
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: "user"
          } 
        })
        .then(videoStream => {
          // Add video tracks to existing stream
          videoStream.getVideoTracks().forEach(track => {
            localStream.addTrack(track);
          });
          
          // Update all peers with the new stream
          Object.values(peersRef.current).forEach(peer => {
            if (peer && peer.replaceTrack) {
              const videoTrack = localStream.getVideoTracks()[0];
              const sender = peer.getSenders().find(s => s.track.kind === 'video');
              if (sender) {
                sender.replaceTrack(videoTrack);
              } else {
                peer.addTrack(videoTrack, localStream);
              }
            }
          });
          
          setIsVideoOff(false);
        })
        .catch(err => {
          console.error('Error turning on camera:', err);
          setError(`Camera access error: ${err.message}`);
        });
      }
    }
  };

  const value = {
    inVoiceChannel,
    connectedUsers,
    localStream,
    remoteStreams,
    isMuted,
    isVideoOff,
    error,
    joinVoiceChannel,
    leaveVoiceChannel,
    toggleMute,
    toggleVideo
  };

  return (
    <VoiceContext.Provider value={value}>
      {children}
    </VoiceContext.Provider>
  );
};

export default VoiceContext;
