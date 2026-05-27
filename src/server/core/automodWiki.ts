import { reddit } from '@devvit/web/server';

/** AutoModerator stores rules on the subreddit wiki at this path. */
export const AUTOMOD_WIKI_PAGE = 'config/automoderator';

export type AutomodWikiState = {
  yaml: string;
  wikiExists: boolean;
};

export const getAutomodWikiState = async (
  subredditName: string
): Promise<AutomodWikiState> => {
  try {
    const page = await reddit.getWikiPage(subredditName, AUTOMOD_WIKI_PAGE);
    return {
      yaml: page.content.trim(),
      wikiExists: true,
    };
  } catch (error: unknown) {
    console.warn(
      `Wiki page r/${subredditName}/${AUTOMOD_WIKI_PAGE} not found:`,
      error
    );
    return {
      yaml: '',
      wikiExists: false,
    };
  }
};

export const getAutomodWikiYaml = async (
  subredditName: string
): Promise<string> => {
  const state = await getAutomodWikiState(subredditName);
  return state.yaml;
};

export const saveAutomodWikiYaml = async (
  subredditName: string,
  yaml: string
): Promise<{ created: boolean }> => {
  const content = yaml.trim();
  const reason = 'Updated via AutoModFlow';

  try {
    const page = await reddit.getWikiPage(subredditName, AUTOMOD_WIKI_PAGE);
    await page.update(content, reason);
    return { created: false };
  } catch (error: unknown) {
    console.info(
      `Creating wiki page r/${subredditName}/${AUTOMOD_WIKI_PAGE}`,
      error
    );
  }

  await reddit.createWikiPage({
    subredditName,
    page: AUTOMOD_WIKI_PAGE,
    content,
    reason,
  });

  return { created: true };
};
