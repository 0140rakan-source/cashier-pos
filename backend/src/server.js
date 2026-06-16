require('dotenv').config();

const createApp = require('./app');
const config = require('./config');

const app = createApp();
const server = app.listen(config.port, () => {
  console.log('\n🐾 Cashier POS Backend');
  console.log(`   Port: ${config.port}`);
  console.log(`   Env: ${config.env}`);
  console.log(`   Ready at http://localhost:${config.port}\n`);
});

process.on('SIGTERM', () => server.close());
process.on('SIGINT', () => server.close());
