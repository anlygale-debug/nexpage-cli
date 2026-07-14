// Storybook emitter — turns extracted componentAnatomy + design tokens into
// a runnable CSF3 Storybook project. Writes stories/*, .storybook/*, and a
// README showing the install + run steps. Zero Storybook dependency in
// nexpage itself; the emitted project installs its own.
//
// Consumer wiring (bin):
//   if (merged.storybook && (design.componentAnatomy || []).length) {
//     const { formatStorybook } = await import('../src/formatters/storybook.js');
//     const files = formatStorybook(design);
//     for (const [rel, content] of Object.entries(files)) {
//       writeFileSync(join(outDir, 'storybook', rel), content);
//     }
//   }

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function htmlTagFor(kind) {
  return kind === 'input' ? 'input'
    : kind === 'link' ? 'a'
    : kind === 'card' ? 'div'
    : 'button';
}

function storyFor(anatomy, tokenVars) {
  const Name = cap(anatomy.kind);
  const variants = anatomy.props.variant.length ? anatomy.props.variant : ['default'];
  const sizes = anatomy.props.size.length ? anatomy.props.size : ['md'];
  const tag = htmlTagFor(anatomy.kind);
  const hasIcon = !!anatomy.slots?.icon;
  const hasBadge = !!anatomy.slots?.badge;

  const sampleLabel = anatomy.kind === 'card' ? 'Card content'
    : anatomy.kind === 'input' ? ''
    : anatomy.kind === 'link' ? 'Read more'
    : 'Button';

  // Render via inline React to keep the emitted project dependency-light.
  const render = `(args) => {
    const style = {
      fontFamily: 'var(--font-sans, inherit)',
      padding: args.size === 'sm' ? '6px 12px' : args.size === 'lg' ? '14px 22px' : '10px 16px',
      borderRadius: 'var(--radius, 8px)',
      background: args.variant === 'secondary' ? 'transparent'
        : args.variant === 'outline' ? 'transparent'
        : 'var(--color-primary, #3b82f6)',
      color: args.variant === 'secondary' || args.variant === 'outline' ? 'var(--color-foreground, #111)' : '#fff',
      border: args.variant === 'outline' ? '1px solid var(--color-foreground, #111)' : 'none',
      fontWeight: 500,
      cursor: 'pointer',
    };
    return React.createElement('${tag}', { style, 'data-variant': args.variant, 'data-size': args.size },
      '${sampleLabel}'${hasIcon ? ", React.createElement('span', { style: { marginLeft: 8 } }, '→')" : ''}${hasBadge ? ", React.createElement('span', { style: { marginLeft: 6, padding: '2px 6px', background: '#f59e0b', borderRadius: 99, color: '#fff', fontSize: 11 } }, '3')" : ''}
    );
  }`;

  return `import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

// Extracted from a live site by \`nexpage\`. No runtime library —
// these stories render inline to stay dependency-free.
const ${Name}: React.FC<{ variant?: string; size?: string }> = ${render};

const meta: Meta<typeof ${Name}> = {
  title: 'Extracted/${Name}',
  component: ${Name},
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: [${variants.map(v => `'${v}'`).join(', ')}] },
    size:    { control: 'select', options: [${sizes.map(s => `'${s}'`).join(', ')}] },
  },
  parameters: {
    docs: {
      description: {
        component: '${anatomy.kind} — ${anatomy.totalInstances || 0} instances detected across the page.',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof ${Name}>;

${variants.map(v => `export const ${cap(v)}: Story = { args: { variant: '${v}', size: '${sizes[0]}' } };`).join('\n')}

export const Sizes: Story = {
  render: () => React.createElement('div', { style: { display: 'flex', gap: 12, alignItems: 'center' } },
    ${sizes.map(s => `React.createElement(${Name}, { key: '${s}', variant: '${variants[0]}', size: '${s}' })`).join(',\n    ')}
  ),
};
`;
}

function tokensCss(design) {
  const colors = design.colors || {};
  const primary = colors.primary?.hex || '#3b82f6';
  const secondary = colors.secondary?.hex || '#8b5cf6';
  const accent = colors.accent?.hex || '#f59e0b';
  const bg = colors.backgrounds?.[0] || '#ffffff';
  const fg = colors.text?.[0] || '#171717';
  const radii = design.borders?.radii || [];
  const radius = radii.find(r => r.label === 'md')?.value ?? 8;
  const shadow = design.shadows?.values?.find(s => s.label === 'md')?.raw || '0 4px 6px rgba(0,0,0,0.1)';
  const font = design.typography?.families?.[0]?.name || 'Inter';
  return `:root {
  --color-primary: ${primary};
  --color-secondary: ${secondary};
  --color-accent: ${accent};
  --color-background: ${bg};
  --color-foreground: ${fg};
  --radius: ${radius}px;
  --shadow: ${shadow};
  --font-sans: '${font}', system-ui, sans-serif;
}
body { background: var(--color-background); color: var(--color-foreground); font-family: var(--font-sans); }
`;
}

export function formatStorybook(design) {
  const anatomies = design.componentAnatomy || [];
  const files = {};

  // Story files (one per kind).
  for (const a of anatomies) {
    const Name = cap(a.kind);
    files[`stories/${Name}.stories.tsx`] = storyFor(a, design);
  }

  // A tokens page so people can see the palette/scale inline.
  files['stories/Tokens.mdx'] = `import { Meta, ColorPalette, ColorItem, Typeset } from '@storybook/blocks';

<Meta title="Extracted/Tokens" />

# Design tokens

Extracted from ${design.meta?.url || 'the target site'} by [nexpage](https://github.com/nexpage-tool/nexpage).

<ColorPalette>
  <ColorItem title="primary"    colors={{ primary: '${design.colors?.primary?.hex || '#3b82f6'}' }} />
  <ColorItem title="secondary"  colors={{ secondary: '${design.colors?.secondary?.hex || '#8b5cf6'}' }} />
  <ColorItem title="accent"     colors={{ accent: '${design.colors?.accent?.hex || '#f59e0b'}' }} />
  <ColorItem title="background" colors={{ background: '${design.colors?.backgrounds?.[0] || '#ffffff'}' }} />
  <ColorItem title="foreground" colors={{ foreground: '${design.colors?.text?.[0] || '#171717'}' }} />
</ColorPalette>
`;

  files['stories/tokens.css'] = tokensCss(design);

  files['.storybook/main.ts'] = `import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../stories/**/*.mdx', '../stories/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-essentials', '@storybook/addon-docs'],
  framework: { name: '@storybook/react-vite', options: {} },
};
export default config;
`;

  files['.storybook/preview.ts'] = `import type { Preview } from '@storybook/react';
import './../stories/tokens.css';

const preview: Preview = {
  parameters: {
    backgrounds: { default: 'paper' },
    controls: { matchers: { color: /(background|color)$/i } },
  },
};
export default preview;
`;

  files['package.json'] = JSON.stringify({
    name: `${(design.meta?.title || 'extracted').toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 40) || 'extracted'}-storybook`,
    private: true,
    version: '0.1.0',
    type: 'module',
    scripts: {
      storybook: 'storybook dev -p 6006',
      'build-storybook': 'storybook build',
    },
    dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0' },
    devDependencies: {
      '@storybook/addon-essentials': '^8.0.0',
      '@storybook/addon-docs': '^8.0.0',
      '@storybook/blocks': '^8.0.0',
      '@storybook/react': '^8.0.0',
      '@storybook/react-vite': '^8.0.0',
      '@types/react': '^19.0.0',
      '@types/react-dom': '^19.0.0',
      storybook: '^8.0.0',
      typescript: '^5.0.0',
      vite: '^5.0.0',
    },
  }, null, 2);

  files['tsconfig.json'] = JSON.stringify({
    compilerOptions: {
      target: 'ES2020',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      jsx: 'react-jsx',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
    },
    include: ['stories/**/*', '.storybook/**/*'],
  }, null, 2);

  files['README.md'] = `# ${design.meta?.title || 'Extracted'} · Storybook

Auto-generated by \`nexpage <url> --storybook\`.

## Stories
${anatomies.map(a => `- **${cap(a.kind)}** — ${a.props.variant.length || 1} variant(s), ${a.props.size.length || 1} size(s), ${a.totalInstances || 0} detected`).join('\n') || '_No anatomy detected on the source page._'}

## Run

\`\`\`
npm install
npm run storybook
\`\`\`

Opens at http://localhost:6006.
`;

  return files;
}
