import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Proxy API route to bypass CORS
  app.post("/api/proxy", async (req, res) => {
    const { method, url, headers, body } = req.body;

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    const startTime = Date.now();

    try {
      const fetchOptions: RequestInit = {
        method,
        headers: headers || {},
      };

      if (method !== 'GET' && method !== 'HEAD' && body) {
        fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
      }

      const response = await fetch(url, fetchOptions);
      const endTime = Date.now();
      const time = endTime - startTime;

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      let responseData;
      const contentType = response.headers.get("content-type") || "";
      
      const arrayBuffer = await response.arrayBuffer();
      const size = arrayBuffer.byteLength;
      
      if (contentType.includes("application/json")) {
        try {
          const text = new TextDecoder().decode(arrayBuffer);
          responseData = JSON.parse(text);
        } catch (e) {
          responseData = new TextDecoder().decode(arrayBuffer);
        }
      } else if (contentType.includes("text/") || contentType.includes("application/xml")) {
        responseData = new TextDecoder().decode(arrayBuffer);
      } else {
        responseData = `Binary data (${size} bytes)`;
      }

      res.json({
        status: response.status,
        statusText: response.statusText,
        time,
        size,
        headers: responseHeaders,
        data: responseData
      });

    } catch (error: any) {
      const endTime = Date.now();
      res.status(500).json({
        error: error.message || "Failed to fetch",
        time: endTime - startTime,
        status: 0,
        statusText: "Error",
        headers: {},
        data: null,
        size: 0
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
