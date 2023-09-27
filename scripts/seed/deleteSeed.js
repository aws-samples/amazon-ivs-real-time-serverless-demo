const querystring = require('querystring');
const { getCustomerCode, retryWithConstantBackoff } = require('../utils');

async function getDemoItems(cid, apiKey) {
  const url = `https://${cid}.cloudfront.net`;
  const searchParams = querystring.stringify({ createdFor: 'demo' });

  const result = await fetch(`${url}?${searchParams}`, {
    headers: { 'x-api-key': apiKey }
  });
  const { stages } = await result.json();

  return stages;
}

async function deleteDemoItem(cid, apiKey, hostId) {
  await fetch(`https://${cid}.cloudfront.net`, {
    method: 'DELETE',
    headers: { 'x-api-key': apiKey },
    body: JSON.stringify({ hostId })
  });
}

async function deleteSeed() {
  const { cid, apiKey } = await getCustomerCode();
  const demoItems = await getDemoItems(cid, apiKey);

  await Promise.all(
    demoItems.map(({ hostId }) =>
      retryWithConstantBackoff(() => deleteDemoItem(cid, apiKey, hostId))
    )
  );
}

deleteSeed();
