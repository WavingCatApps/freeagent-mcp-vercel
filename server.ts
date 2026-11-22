/**
 * Long-running HTTP entry for Docker / Apple Container (and local) use.
 * Vercel continues to import api/index.ts as a serverless default export.
 */
import app from "./api/index.ts";

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || "0.0.0.0";

app.listen(port, host, () => {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "info",
      message: "FreeAgent MCP HTTP server listening",
      data: { host, port },
    }),
  );
});
