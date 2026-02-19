/**
 * Nunjucks template engine for prompt generation.
 *
 * Creates a configured Nunjucks environment with plain-text settings
 * (no HTML escaping) and custom filters for prompt template rendering.
 *
 * Keep minimal — the research explicitly warns against over-engineering
 * the template system (pitfall #6).
 */
import nunjucks from 'nunjucks';

/**
 * Create a configured Nunjucks Environment for rendering prompt templates.
 *
 * @param templateDir - Absolute path to the directory containing .njk templates
 * @returns Configured Nunjucks Environment
 */
export function createPromptEngine(templateDir: string): nunjucks.Environment {
  const env = new nunjucks.Environment(
    new nunjucks.FileSystemLoader(templateDir),
    {
      autoescape: false,       // Prompts are plain text, not HTML
      throwOnUndefined: true,  // Catch missing variables immediately
      trimBlocks: true,        // Remove newline after block tags
      lstripBlocks: true,      // Strip leading whitespace before block tags
    }
  );

  // Custom filters
  env.addFilter('upper', (str: string) => str.toUpperCase());

  return env;
}
