import { reddit, redis } from '@devvit/web/server';
import { T3 as toPostThingId } from '@devvit/shared-types/tid.js';

const CONFIG_POST_TITLE = 'AutoModFlow Mod Editor';
const configPostKey = (subredditName: string) =>
  `automodflow:${subredditName.toLowerCase()}:config-post`;

const hideConfigPostFromPublicFeed = async (
  post: Awaited<ReturnType<typeof reddit.getPostById>>
) => {
  try {
    if (!post.locked) {
      await post.lock();
    }
  } catch (error: unknown) {
    console.warn('Could not lock AutoModFlow config post.', error);
  }

  try {
    if (!post.removed) {
      await post.remove(false);
    }
  } catch (error: unknown) {
    console.warn(
      'Could not remove AutoModFlow config post from public feed.',
      error
    );
  }
};

export const getOrCreateConfigPost = async (subredditName: string) => {
  const key = configPostKey(subredditName);
  const existingPostId = await redis.get(key);

  if (existingPostId) {
    try {
      const post = await reddit.getPostById(toPostThingId(existingPostId));
      await hideConfigPostFromPublicFeed(post);
      return post;
    } catch {
      await redis.del(key);
    }
  }

  const post = await reddit.submitCustomPost({
    subredditName,
    title: CONFIG_POST_TITLE,
    entry: 'default',
    sendreplies: false,
    spoiler: true,
    postData: {
      kind: 'automodflow-editor',
    },
    textFallback: {
      text: 'AutoModFlow visual editor for AutoModerator rules.',
    },
  });

  await hideConfigPostFromPublicFeed(post);
  await redis.set(key, post.id);

  return post;
};
