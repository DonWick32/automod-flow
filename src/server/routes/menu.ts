import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { reddit } from '@devvit/web/server';
import { getOrCreateConfigPost } from '../core/post';

export const menu = new Hono();

const toRedditUrl = (permalink: string) =>
  permalink.startsWith('http')
    ? permalink
    : `https://www.reddit.com${permalink}`;

menu.post('/config-automod', async (c) => {
  const subreddit = await reddit.getCurrentSubreddit();
  const post = await getOrCreateConfigPost(subreddit.name);

  console.info(
    `Opened AutoModFlow editor post=${post.id} subreddit=${subreddit.name}`
  );

  return c.json<UiResponse>(
    {
      navigateTo: toRedditUrl(post.permalink),
      showToast: {
        text: 'Opening AutoModFlow editor.',
        appearance: 'success',
      },
    },
    200
  );
});
