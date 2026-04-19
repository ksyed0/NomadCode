export interface SnippetDefinition {
  prefix: string;
  body: string;
  description: string;
  language: string | 'all';
}

export const BUILTIN_SNIPPETS: SnippetDefinition[] = [
  // ── Universal ─────────────────────────────────────────────────────────────
  { prefix: 'clg',    body: 'console.log($1)',                                    description: 'console.log',              language: 'all' },
  { prefix: 'uef',    body: 'useEffect(() => {\n\t$1\n}, [$2])',                  description: 'useEffect hook',           language: 'all' },
  { prefix: 'ust',    body: 'const [$1, set$2] = useState($3)',                   description: 'useState hook',            language: 'all' },
  // ── JavaScript ────────────────────────────────────────────────────────────
  { prefix: 'afn',    body: 'const $1 = ($2) => {\n\t$3\n}',                     description: 'Arrow function',           language: 'javascript' },
  // ── TypeScript React ──────────────────────────────────────────────────────
  {
    prefix: 'rfc',
    body: "import React from 'react';\n\ninterface ${1:Props} {}\n\nexport function ${2:Component}({}: ${1:Props}) {\n\treturn (\n\t\t<$3 />\n\t);\n}",
    description: 'React functional component',
    language: 'typescriptreact',
  },
  // ── Python ────────────────────────────────────────────────────────────────
  { prefix: 'def',    body: 'def $1($2):\n\t$3',                                  description: 'Python function',          language: 'python' },
  { prefix: 'cls',    body: 'class $1:\n\tdef __init__(self$2):\n\t\t$3',         description: 'Python class',             language: 'python' },
  { prefix: 'ifmain', body: "if __name__ == '__main__':\n\t$1",                   description: 'if __name__ == main',      language: 'python' },
  // ── Rust ──────────────────────────────────────────────────────────────────
  { prefix: 'fn',     body: 'fn $1($2) -> $3 {\n\t$4\n}',                        description: 'Rust function',            language: 'rust' },
  { prefix: 'impl',   body: 'impl $1 {\n\t$2\n}',                                 description: 'Rust impl block',          language: 'rust' },
  // ── Go ────────────────────────────────────────────────────────────────────
  { prefix: 'pr',     body: 'fmt.Println($1)',                                    description: 'fmt.Println',              language: 'go' },
  { prefix: 'func',   body: 'func $1($2) $3 {\n\t$4\n}',                         description: 'Go function',              language: 'go' },
];
