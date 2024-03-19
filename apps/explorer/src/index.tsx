// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import '@fontsource-variable/inter';
import '@fontsource-variable/red-hat-mono';
import { QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

import { router } from './pages';
import { initAmplitude } from './utils/analytics/amplitude';
import { queryClient } from './utils/queryClient';
import './utils/sentry';

import '@mysten/dapp-kit/dist/index.css';
import './index.css';

// Load Amplitude as early as we can:
initAmplitude();

ReactDOM.createRoot(document.getElementById('root')!).render(
	<React.StrictMode>
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} />
		</QueryClientProvider>
	</React.StrictMode>,
);
