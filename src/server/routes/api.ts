import { Hono } from 'hono';
import YAML from 'js-yaml';
import { reddit } from '@devvit/web/server';
import {
  AUTOMOD_WIKI_PAGE,
  getAutomodWikiState,
  saveAutomodWikiYaml,
} from '../core/automodWiki';

export const api = new Hono();

type AutomodConfigResponse = {
  subredditName: string;
  yaml: string;
  wikiPage: string;
  wikiExists: boolean;
  ruleCount: number;
};

const isCurrentUserModerator = async (subredditName: string) => {
  const username = await reddit.getCurrentUsername();
  if (!username) {
    return false;
  }

  const moderators = await reddit
    .getModerators({
      subredditName,
      username,
      limit: 1,
    })
    .all();

  return moderators.some(
    (moderator) => moderator.username.toLowerCase() === username.toLowerCase()
  );
};

const countAutomodRules = (yaml: string): number => {
  if (!yaml.trim()) {
    return 0;
  }

  try {
    return YAML.loadAll(yaml).filter(
      (doc) => doc && typeof doc === 'object' && Object.keys(doc).length > 0
    ).length;
  } catch {
    return 0;
  }
};

api.get('/automod-config', async (c) => {
  const subredditName = c.req.query('subredditName')?.trim();
  if (!subredditName) {
    return c.json({ error: 'Missing subredditName.' }, 400);
  }

  if (!(await isCurrentUserModerator(subredditName))) {
    return c.json({ error: 'Moderator access required.' }, 403);
  }

  const { yaml, wikiExists } = await getAutomodWikiState(subredditName);

  return c.json<AutomodConfigResponse>(
    {
      subredditName,
      yaml,
      wikiPage: AUTOMOD_WIKI_PAGE,
      wikiExists,
      ruleCount: countAutomodRules(yaml),
    },
    200
  );
});

api.post('/automod-config', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    subredditName?: string;
    yaml?: string;
  };
  const subredditName = body.subredditName?.trim();
  const yaml = body.yaml;

  if (!subredditName || typeof yaml !== 'string') {
    return c.json({ error: 'Missing subredditName or yaml.' }, 400);
  }

  if (!(await isCurrentUserModerator(subredditName))) {
    return c.json({ error: 'Moderator access required.' }, 403);
  }

  if (yaml.trim()) {
    try {
      YAML.loadAll(yaml);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Invalid YAML syntax.';
      return c.json({ error: `Invalid AutoModerator YAML: ${message}` }, 400);
    }
  }

  const { created } = await saveAutomodWikiYaml(subredditName, yaml);

  return c.json<AutomodConfigResponse & { wikiCreated?: boolean }>(
    {
      subredditName,
      yaml: yaml.trim(),
      wikiPage: AUTOMOD_WIKI_PAGE,
      wikiExists: true,
      ruleCount: countAutomodRules(yaml),
      wikiCreated: created,
    },
    200
  );
});
