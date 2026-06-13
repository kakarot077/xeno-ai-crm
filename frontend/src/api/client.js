import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

client.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message =
      error?.response?.data?.error ||
      error?.response?.data?.message ||
      error?.message ||
      'Something went wrong';
    return Promise.reject(new Error(message));
  }
);

export const customersApi = {
  getAll: (params = {}) => client.get('/customers', { params }),
};

export const segmentsApi = {
  getAll:  ()        => client.get('/segments'),
  getById: (id)      => client.get(`/segments/${id}`),
  create:  (data)    => client.post('/segments', data),
  preview: (filters) => client.post('/segments/preview', { filters }),
};

export const campaignsApi = {
  getAll:       ()           => client.get('/campaigns'),
  getById:      (id)         => client.get(`/campaigns/${id}`),
  create:       (data)       => client.post('/campaigns', data),
  send:         (id)         => client.post(`/campaigns/${id}/send`),
  updateStatus: (id, status) => client.patch(`/campaigns/${id}/status`, { status }),
};

export const analyticsApi = {
  getSummary:       ()   => client.get('/analytics/summary'),
  getCampaignStats: (id) => client.get(`/analytics/campaigns/${id}/stats`),
};

 export const aiApi = {
  generateMessage: (goal, segmentName) =>
    client.post('/ai/generate-message', {
      goal,
      segmentName,
    }),
  generateSegment: (description) =>
    client.post('/ai/generate-segment', {
      description,
    }),
  generateCampaign: (prompt) =>
    client.post('/ai/generate-campaign', {
      prompt,
    }),
};

export default client;
