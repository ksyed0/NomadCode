export interface SnippetDefinition {
  prefix: string;
  body: string;
  description: string;
  language: string | 'all';
}

export const BUILTIN_SNIPPETS: SnippetDefinition[] = [];
// Filled in Task 15
