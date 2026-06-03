import axios from 'axios';
import { API_BASE_URL, APP_TOKEN } from './config';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'x-app-token': APP_TOKEN }
});

export const getConversations = () => api.get('/conversations').then(r => r.data);
export const getMessages = (threadId) => api.get(`/conversations/${threadId}/messages`).then(r => r.data);
export const markReplied = (threadId) => api.post(`/conversations/${threadId}/mark-replied`).then(r => r.data);
export const askAI = (question, threadId, history) =>
  api.post('/ask', { question, threadId, history }).then((r) => r.data);
export const suggestReply = (messageText, threadId) => api.post('/suggest-reply', { messageText, threadId }).then(r => r.data);
export const addManualConversation = (clientName, messageText) => api.post('/conversations/manual', { clientName, messageText }).then(r => r.data);
export const getKnowledge = () => api.get('/knowledge').then(r => r.data);
export const updateKnowledge = (category, content) => api.post('/knowledge', { category, content }).then(r => r.data);
