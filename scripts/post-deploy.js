const qrcode = require('qrcode-terminal');

const { getCustomerCode } = require('./utils');

async function runPostDeploy() {
  const { cid, apiKey } = await getCustomerCode();

  console.info(`\n ⭐️ Customer ID: ${cid}`);
  console.info(`\n 🔑 API key: ${apiKey}`);
  console.info('\n 🔎 Authentication QR code:');
  qrcode.generate(`${cid}-${apiKey}`, { small: true });
}

runPostDeploy();
