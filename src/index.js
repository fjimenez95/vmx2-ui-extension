import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { Amplify } from 'aws-amplify'
import config from './aws-exports'
import '@aws-amplify/ui-react/styles.css'
import { ThemeProvider } from '@aws-amplify/ui-react'

Amplify.configure(config)

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);

reportWebVitals();
