const { parseArgs } = require('util');
const { writeFileSync } = require('fs');

const { getCustomerCode, retryWithConstantBackoff } = require('../utils');
const fruits = require('./fruits.json');

const MAX_SEED_COUNT = 10;
const COMMON_HOST_ATTRIBUTES = {
  avatarColLeft: '#eb5f07',
  avatarColRight: '#d91515',
  avatarColBottom: '#ff9900'
};

const { values: args } = parseArgs({
  options: {
    type: { type: 'string', default: 'video' },
    count: { type: 'string', default: '1' }
  },
  strict: false
});

function chooseRandomDistinctItems(srcArray, count) {
  if (srcArray.length < count) {
    throw new Error(
      `Cannot choose ${count} distinct items from array with length ${srcArray.length}.`
    );
  }

  const copy = srcArray.slice(0);
  const items = [];

  for (let i = 0; i < count; i++) {
    const randomIndex = Math.floor(Math.random() * copy.length);
    const randomItem = copy[randomIndex];
    items.push(randomItem);
    copy.splice(randomIndex, 1);
  }

  return items;
}

async function createDemoItem(cid, apiKey, hostId) {
  const { type } = args;
  const hostAttributes = { ...COMMON_HOST_ATTRIBUTES, username: hostId };

  const result = await fetch(`https://${cid}.cloudfront.net/create/demo`, {
    method: 'POST',
    headers: { 'x-api-key': apiKey },
    body: JSON.stringify({ cid, hostId, type, hostAttributes })
  });
  const { hostParticipantToken } = await result.json();

  return hostParticipantToken.token;
}

async function seed() {
  const { cid, apiKey } = await getCustomerCode();

  const demoItems = {};
  const count = Number(args.count);
  const boundedCount = Math.min(Math.max(count, 0), MAX_SEED_COUNT);
  const randomDemoIds = chooseRandomDistinctItems(fruits, boundedCount);

  for (let i = 0; i < boundedCount; i++) {
    const demoId = randomDemoIds[i];
    const demoIdCapitalized = demoId.charAt(0).toUpperCase() + demoId.slice(1);
    const hostId = `Demo${demoIdCapitalized}${i}`;

    demoItems[hostId] = await retryWithConstantBackoff(() =>
      createDemoItem(cid, apiKey, hostId)
    );
  }

  randomDemoIds.map((demoId, i) => {
    const demoIdCapitalized = demoId.charAt(0).toUpperCase() + demoId.slice(1);
    const hostId = `Demo${demoIdCapitalized}${i}`;

    return createDemoItem(cid, apiKey, hostId);
  });

  const outputFilename = 'scripts/seed/output.json';
  writeFileSync(outputFilename, JSON.stringify(demoItems, null, 2));

  console.info(demoItems);
  console.info('\nOutput:', outputFilename);
}

seed();
