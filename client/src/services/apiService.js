// Base URL for API requests
const BASE_URL = 'http://localhost:5000/api';

// Helper for making API requests with fetch
const api = {
  // Generic request function
  async request(url, options = {}) {
    // Set default headers
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    // Add auth token if available
    const token = localStorage.getItem('token');
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    // Prepare fetch options
    const fetchOptions = {
      ...options,
      headers
    };

    try {
      console.log(`Making API request to ${BASE_URL}${url}`);
      const response = await fetch(`${BASE_URL}${url}`, fetchOptions);
      
      // Handle unauthorized errors (token expired, etc.)
      if (response.status === 401) {
        console.error('Authentication error: Unauthorized (401)');
        localStorage.removeItem('token');
        // You could redirect to login page here if needed
        throw new Error('Unauthorized - Please log in again');
      }

      // Check if response can be parsed as JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error(`Response is not JSON: ${contentType}`);
        const text = await response.text();
        console.error(`Response body: ${text.substring(0, 200)}...`);
        throw new Error('Invalid response format - expected JSON');
      }

      // Parse JSON response
      const data = await response.json();
      console.log(`API response status: ${response.status}`);

      // Throw error if response is not ok
      if (!response.ok) {
        const error = { 
          status: response.status, 
          message: data.message || 'Something went wrong',
          response: { data }
        };
        console.error('API request error:', error);
        throw error;
      }

      // Return in Axios-like format for compatibility with existing code
      return { data };
    } catch (error) {
      console.error(`API request to ${url} failed:`, error.message || error);
      throw error;
    }
  },

  // GET request
  get(url, options = {}) {
    return this.request(url, { ...options, method: 'GET' });
  },

  // POST request
  post(url, body, options = {}) {
    return this.request(url, { 
      ...options, 
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  // PUT request
  put(url, body, options = {}) {
    return this.request(url, { 
      ...options, 
      method: 'PUT',
      body: JSON.stringify(body)
    });
  },

  // DELETE request
  delete(url, options = {}) {
    return this.request(url, { ...options, method: 'DELETE' });
  }
};

// Export the API service for use in components
export default api;
