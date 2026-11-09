import { config } from 'dotenv';
import { cities } from '../src/lib/cities';
import { createMemoryClient, profileNamespace, recallRecords } from '../src/lib/memory';
config({ path: '.env.local', quiet: true });
const client = createMemoryClient();
if (!client)
  console.log('Recall not captured: set MEMWAL_PRIVATE_KEY and MEMWAL_ACCOUNT_ID in .env.local.');
else {
  try {
    const queries = process.argv.slice(2);
    for (const query of queries.length
      ? queries
      : cities.map((c) => `Which forecast source was most accurate for ${c.name} rain?`))
      console.log(JSON.stringify(await recallRecords(client, query), null, 2));
    if (!queries.length)
      console.log(
        JSON.stringify(
          await recallRecords(client, 'Demo profile and demo pick journal', profileNamespace),
          null,
          2,
        ),
      );
  } finally {
    client.destroy();
  }
}
