#!/usr/bin/env node
/*
 * OAuth Token Setup Script for FreeAgent API
 * 
 * Originally from: https://github.com/markpitt/freeagent-mcp
 * Author: Mark Pitt
 * License: MIT
 * 
 * Modified for Vercel deployment environment variables
 */

import express from 'express';
import axios from 'axios';
import open from 'open';

// Command line arguments
const clientId = process.argv[2];
const clientSecret = process.argv[3];
const port = 3456;
const redirectUri = `http://localhost:${port}/oauth/callback`;
const authUrl = 'https://api.freeagent.com/v2/approve_app';
const tokenUrl = 'https://api.freeagent.com/v2/token_endpoint';

if (!clientId || !clientSecret) {
    console.error('Usage: node get-oauth-tokens.js <client_id> <client_secret>');
    process.exit(1);
}

console.log('Using client ID:', clientId);

const app = express();

app.get('/oauth/callback', async (req, res) => {
    const { code } = req.query;

    if (!code) {
        res.send('Error: No code received');
        return;
    }

    try {
        const response = await axios.post(tokenUrl, {
            grant_type: 'authorization_code',
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri
        });

        const { access_token, refresh_token } = response.data;

        console.log('\nAdd these tokens to your Vercel environment variables:\n');
        console.log(`FREEAGENT_ACCESS_TOKEN=${access_token}`);
        console.log(`FREEAGENT_REFRESH_TOKEN=${refresh_token}`);

        res.send('Success! You can close this window and check the console for your tokens.');
        setTimeout(() => process.exit(0), 1000);
    } catch (error) {
        console.error('Error getting tokens:', error.response?.data || error.message);
        res.send('Error getting tokens. Check the console for details.');
    }
});

const server = app.listen(port, () => {
    const authUrlWithParams = `${authUrl}?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}`;
    console.log('Opening browser for authorization...');
    open(authUrlWithParams);
});

server.on('error', (err) => {
    console.error('Server error:', err);
    process.exit(1);
});