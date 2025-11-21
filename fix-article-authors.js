// Fix article authors - restore Steph's articles that were overwritten by admin edits
const Redis = require('ioredis');

// Initialize Redis client
let redis;
if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL);
} else {
  const { kv } = require('@vercel/kv');
  redis = kv;
}

async function fixAuthors() {
  try {
    const draftsJson = await redis.get('drafts');
    const drafts = draftsJson ? JSON.parse(draftsJson) : [];

    console.log(`Total drafts: ${drafts.length}`);

    // Find the two articles that need to be fixed
    const articleIds = ['1763484767950', '1763675276345'];

    let fixed = 0;
    for (const articleId of articleIds) {
      const index = drafts.findIndex(d => d.id === articleId);
      if (index >= 0) {
        const draft = drafts[index];
        console.log(`\nFound article: ${draft.title}`);
        console.log(`  Current author: ${draft.author}`);
        console.log(`  Current authorDisplayName: ${draft.authorDisplayName}`);

        // Fix the author
        drafts[index].author = 'Steph';
        drafts[index].authorDisplayName = 'Steph';

        console.log(`  ✅ Changed to: Steph / Steph`);
        fixed++;
      }
    }

    if (fixed > 0) {
      // Save back to Redis
      await redis.set('drafts', JSON.stringify(drafts));
      console.log(`\n✅ Successfully fixed ${fixed} articles!`);
    } else {
      console.log('\n⚠️ No articles found to fix');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixAuthors();
