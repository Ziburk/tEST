import React from 'react';
import ReactDOM from 'react-dom/client';
import 'react-app-polyfill/stable';
import 'react-app-polyfill/ie11';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Polyfill for process
if (typeof window !== 'undefined') {
  window.process = window.process || {};
  window.process.env = window.process.env || {};
  window.process.nextTick = window.process.nextTick || ((fn) => setTimeout(fn, 0));
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
