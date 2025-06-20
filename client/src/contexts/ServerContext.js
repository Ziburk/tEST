import React, { createContext, useState, useEffect, useContext } from 'react';
import { useAuth } from './AuthContext';
import apiService from '../services/apiService';

const ServerContext = createContext();

export const useServer = () => useContext(ServerContext);

export const ServerProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [servers, setServers] = useState([]);
  const [currentServer, setCurrentServer] = useState(null);
  const [channels, setChannels] = useState([]);
  const [currentChannel, setCurrentChannel] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch user's servers when user is authenticated
  useEffect(() => {
    if (currentUser) {
      fetchUserServers();
    } else {
      setServers([]);
      setCurrentServer(null);
      setChannels([]);
      setCurrentChannel(null);
      setMembers([]);
    }
  }, [currentUser]);

  // When current server changes, fetch its channels and members
  useEffect(() => {
    if (currentServer) {
      fetchServerDetails(currentServer.id);
    }
  }, [currentServer]);

  const fetchUserServers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.get('/servers', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setServers(response.data.servers || []);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching servers:', err);
      setError('Failed to load servers');
      setLoading(false);
    }
  };

  const fetchServerDetails = async (serverId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.get(`/servers/${serverId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      setChannels(response.data.channels || []);
      setMembers(response.data.members || []);
      
      // Set first channel as active if none is selected
      if (!currentChannel && response.data.channels && response.data.channels.length > 0) {
        setCurrentChannel(response.data.channels[0]);
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Error fetching server details:', err);
      setError('Failed to load server details');
      setLoading(false);
    }
  };

  const createServer = async (serverData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.post('/servers', serverData, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      const newServer = response.data.server;
      
      setServers(prevServers => [...prevServers, newServer]);
      setCurrentServer(newServer);
      setChannels(newServer.channels || []);
      
      if (newServer.channels && newServer.channels.length > 0) {
        setCurrentChannel(newServer.channels[0]);
      }
      
      setLoading(false);
      return newServer;
    } catch (err) {
      console.error('Error creating server:', err);
      setError(err.response?.data?.message || 'Failed to create server');
      setLoading(false);
      throw err;
    }
  };

  const joinServer = async (joinData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.post('/servers/join', joinData, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      const joinedServer = response.data.server;
      
      // Only add the server if it's not already in the list
      setServers(prevServers => {
        if (!prevServers.find(s => s.id === joinedServer.id)) {
          return [...prevServers, joinedServer];
        }
        return prevServers;
      });
      
      setCurrentServer(joinedServer);
      fetchServerDetails(joinedServer.id);
      
      setLoading(false);
      return joinedServer;
    } catch (err) {
      console.error('Error joining server:', err);
      setError(err.response?.data?.message || 'Failed to join server');
      setLoading(false);
      throw err;
    }
  };

  const leaveServer = async (serverId) => {
    setLoading(true);
    setError(null);
    try {
      await apiService.post(`/servers/${serverId}/leave`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      setServers(prevServers => prevServers.filter(server => server.id !== serverId));
      
      if (currentServer && currentServer.id === serverId) {
        setCurrentServer(null);
        setChannels([]);
        setCurrentChannel(null);
        setMembers([]);
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Error leaving server:', err);
      setError(err.response?.data?.message || 'Failed to leave server');
      setLoading(false);
      throw err;
    }
  };

  const createChannel = async (channelData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.post('/channels', {
        ...channelData,
        serverId: currentServer.id
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      const newChannel = response.data.channel;
      
      setChannels(prevChannels => [...prevChannels, newChannel]);
      setCurrentChannel(newChannel);
      
      setLoading(false);
      return newChannel;
    } catch (err) {
      console.error('Error creating channel:', err);
      setError(err.response?.data?.message || 'Failed to create channel');
      setLoading(false);
      throw err;
    }
  };

  const deleteChannel = async (channelId) => {
    setLoading(true);
    setError(null);
    try {
      await apiService.delete(`/channels/${channelId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      setChannels(prevChannels => prevChannels.filter(channel => channel.id !== channelId));
      
      if (currentChannel && currentChannel.id === channelId) {
        setCurrentChannel(channels.length > 0 ? channels[0] : null);
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Error deleting channel:', err);
      setError(err.response?.data?.message || 'Failed to delete channel');
      setLoading(false);
      throw err;
    }
  };

  const value = {
    servers,
    currentServer,
    setCurrentServer,
    channels,
    currentChannel,
    setCurrentChannel,
    members,
    loading,
    error,
    fetchUserServers,
    createServer,
    joinServer,
    leaveServer,
    createChannel,
    deleteChannel
  };

  return (
    <ServerContext.Provider value={value}>
      {children}
    </ServerContext.Provider>
  );
};

export default ServerContext;
