# OAuth Deployment Checklist

Quick reference for deploying the FreeAgent MCP Server with OAuth authentication.

## ✅ Pre-Deployment Checklist

### 1. FreeAgent Developer Setup
- [ ] Created FreeAgent Developer account at https://dev.freeagent.com
- [ ] Created a new OAuth application
- [ ] Noted OAuth Client ID
- [ ] Noted OAuth Client Secret
- [ ] Added redirect URI: Your Vercel URL (e.g., `https://your-project.vercel.app`)

### 2. Vercel Environment Variables
Set these in Vercel Dashboard → Settings → Environment Variables:

- [ ] `FREEAGENT_CLIENT_ID` = Your OAuth Client ID
- [ ] `FREEAGENT_CLIENT_SECRET` = Your OAuth Client Secret
- [ ] `FREEAGENT_USE_SANDBOX` = `true` (for testing) or `false` (for production)

### 3. Code Ready
- [ ] Dependencies installed: `npm install`
- [ ] Build successful: `npm run build`
- [ ] Express and express-rate-limit dependencies added

## 🚀 Deployment Steps

1. **Deploy to Vercel**
   ```bash
   vercel --prod
   ```

2. **Test the Health Endpoint**
   ```bash
   curl https://your-project.vercel.app/health
   ```

   Should return:
   ```json
   {
     "status": "ok",
     "oauth_enabled": true,
     "client_id_configured": true
   }
   ```

3. **Test OAuth Metadata**
   ```bash
   curl https://your-project.vercel.app/.well-known/oauth-protected-resource
   ```

4. **Connect in Claude**
   - Go to Claude settings → Integrations
   - Add MCP server with URL: `https://your-project.vercel.app`
   - You should be redirected to FreeAgent login
   - Authorize the app
   - Verify connection works

## 🔧 Troubleshooting

### Build fails with TypeScript errors
```bash
npm run build
```
Check the error messages and ensure all dependencies are installed.

### OAuth not starting
- Check that environment variables are set in Vercel
- Verify redirect URI matches exactly in FreeAgent app settings
- Test the `/.well-known/oauth-protected-resource` endpoint

### "Invalid token" errors
- Ensure you're using the correct environment (sandbox vs production)
- Tokens expire after 1 hour - reconnect if needed
- Check that `FREEAGENT_USE_SANDBOX` matches your FreeAgent environment

## 📝 Quick Commands Reference

```bash
# Install dependencies
npm install

# Build project
npm run build

# Deploy to Vercel
vercel --prod

# Test locally
vercel dev

# Check health
curl https://your-project.vercel.app/health

# View logs
vercel logs
```

## 🔐 Security Notes

- Never commit `FREEAGENT_CLIENT_SECRET` to git
- Use sandbox for development/testing
- Only use production for live deployments
- Rotate secrets periodically in FreeAgent dashboard

## 📚 Documentation Links

- [Full OAuth Setup Guide](./OAUTH_SETUP.md)
- [Vercel Deployment Guide](./VERCEL_DEPLOYMENT.md)
- [FreeAgent OAuth Docs](https://dev.freeagent.com/docs/oauth)
- [MCP Authorization Spec](https://modelcontextprotocol.io/docs/concepts/authorization)
