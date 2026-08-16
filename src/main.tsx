import React from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider, createTheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@fontsource-variable/inter';
import './styles.css';
import App from './App';

const theme = createTheme({
  fontFamily: 'Inter Variable, Inter, sans-serif',
  primaryColor: 'indigo',
  defaultRadius: 'md',
  headings: { fontFamily: 'Inter Variable, Inter, sans-serif' },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="light">
      <Notifications
        position="bottom-right"
        zIndex={4000}
        autoClose={4500}
        limit={4}
        className="app-toasts"
      />
      <App />
    </MantineProvider>
  </React.StrictMode>,
);
