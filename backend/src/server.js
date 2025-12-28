import 'dotenv/config';
import { createApp } from './app.js';

const port = process.env.PORT ? Number(process.env.PORT) : 5050;
const { app } = await createApp();

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] listening on http://localhost:${port}`);
  console.log(`[server] serving frontend and API from same origin`);
});
