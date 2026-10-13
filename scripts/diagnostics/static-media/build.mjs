import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { build } from 'esbuild';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { BASE, OUTPUT, sha, ownPath, validateAssets, cssUrls } from './contract.mjs';
const root = process.cwd();
const output = ownPath(root, OUTPUT);
const require = createRequire(path.join(root, 'package.json'));
const expected = { react: '19.3.0', 'react-dom': '19.3.0', 'framer-motion': '12.43.0', esbuild: '0.25.12', '@playwright/test': '1.63.0', tailwindcss: '4.3.3' };
for (const [name, version] of Object.entries(expected)) assert.equal(require(name + '/package.json').version, version);
fs.mkdirSync(ownPath(output, 'generated'), { recursive: true });
fs.mkdirSync(ownPath(output, 'site'), { recursive: true });
const homeFile = 'client/src/pages/Home.tsx';
const original = fs.readFileSync(ownPath(root, homeFile), 'utf8');
const sf = ts.createSourceFile(homeFile, original, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const nodes = new Map();
for (const statement of sf.statements) {
  if (ts.isFunctionDeclaration(statement) && statement.name) nodes.set(statement.name.text, statement);
  if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) if (ts.isIdentifier(declaration.name)) nodes.set(declaration.name.text, statement);
}
const names = ['fadeUp', 'scaleIn', 'whatsNew', 'marqueeProviders', 'statItems', 'heroWords', 'SectionDivider', 'CyclingWord', 'useCountUp', 'StatItem'];
assert(names.every(n => nodes.has(n)));
let layout;
function find(node) { if (ts.isJsxElement(node) && node.openingElement.tagName.getText(sf) === 'PageLayout') layout = node; ts.forEachChild(node, find); }
find(nodes.get('Home')); assert(layout);
const sections = layout.children.filter(n => ts.isJsxElement(n) && n.openingElement.tagName.getText(sf) === 'section');
assert(sections.length > 4);
const prefix = original.slice(sections[0].getStart(sf), sections[3].end);
assert(prefix.includes("What's <span") && prefix.includes('{whatsNew.map'));
const sourceElement = '<source src="/video/hero-bg.mp4" type="video/mp4" />';
assert.equal(prefix.split(sourceElement).length, 2);
const controlledPrefix = prefix.replace(sourceElement, '{mediaSourcePresent && (' + sourceElement + ')}');
const iconImport = sf.statements.find(n => ts.isImportDeclaration(n) && n.moduleSpecifier.text === 'lucide-react').getText(sf);
// This presentation adapter intentionally omits Next router/viewport prefetch.
const component = `import React, {useEffect,useState,useRef} from 'react';\nimport {motion,AnimatePresence} from 'framer-motion';\n${iconImport}\nimport {Button} from '../../../client/src/components/ui/button';\nconst Link=React.forwardRef<HTMLAnchorElement, React.ComponentProps<'a'>>((props,ref)=><a {...props} ref={ref}/>);\n${names.map(n => nodes.get(n).getText(sf)).join('\n')}\nexport function StaticPage({mediaSourcePresent}:{mediaSourcePresent:boolean}) {const isAuthenticated=false; const visibleProviders=marqueeProviders; return <div className="min-h-screen flex flex-col bg-background"><main className="flex-1">${controlledPrefix}</main></div>;}\n`;
const componentFile = ownPath(output, 'generated/component.tsx'); fs.writeFileSync(componentFile, component);
const clientFile = ownPath(output, 'generated/client.tsx');
fs.writeFileSync(clientFile, `import React from 'react';import {hydrateRoot} from 'react-dom/client';import {StaticPage} from './component';const root=document.getElementById('root');if(!root)throw new Error('Missing static root');const mediaSourcePresent=root.querySelector('video > source')!==null;hydrateRoot(root,<StaticPage mediaSourcePresent={mediaSourcePresent}/>);`);
const baseOptions = { bundle: true, jsx: 'automatic', tsconfig: path.join(root, 'tsconfig.json'), absWorkingDir: root, logLevel: 'silent', metafile: true, define: { 'process.env.NODE_ENV': '"production"' } };
const server = await build({ ...baseOptions, entryPoints: [componentFile], outfile: ownPath(output, 'generated/component-server.mjs'), platform: 'node', format: 'esm', packages: 'external' });
const client = await build({ ...baseOptions, entryPoints: [clientFile], outfile: ownPath(output, 'site/client.js'), platform: 'browser', format: 'esm', minify: true });
const forbidden = /(?:next\/|next\\|_core\/|trpc|Onboarding|Navbar|Footer|Analytics|sentry|stripe|aws-sdk|neondatabase)/i;
for (const input of Object.keys(client.metafile.inputs)) assert(!forbidden.test(input));
const allowedPackages = new Set(['react', 'react-dom', 'scheduler', 'framer-motion', 'motion-dom', 'motion-utils', 'lucide-react', '@radix-ui/react-slot', '@radix-ui/react-compose-refs', 'class-variance-authority', 'clsx', 'tailwind-merge']);
const allowedLocals = new Set(['client/src/components/ui/button.tsx', 'client/src/lib/utils.ts', OUTPUT + '/generated/client.tsx', OUTPUT + '/generated/component.tsx']);
for (const input of Object.keys(client.metafile.inputs)) {
  const normalized = input.replaceAll('\\', '/');
  if (!normalized.includes('/node_modules/') && !normalized.startsWith('node_modules/')) assert(allowedLocals.has(normalized));
  else { const tail = normalized.slice(normalized.lastIndexOf('node_modules/') + 'node_modules/'.length); const parts = tail.split('/'); const name = parts[0].startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]; assert(allowedPackages.has(name)); }
}
const module = await import(pathToFileURL(ownPath(output, 'generated/component-server.mjs')).href + '?build=' + sha(Buffer.from(component)));
const assets = validateAssets(JSON.parse(fs.readFileSync(ownPath(root, 'scripts/diagnostics/static-media/assets/manifest.json'))));
for (const asset of assets.files) {
  assert(['repo', 'snapshot'].includes(asset.kind));
  if (asset.kind === 'repo') assert(/^public\/(?:showcase\/[a-z0-9-]+\.jpg|video\/hero-bg\.mp4)$/.test(asset.file));
  const file = ownPath(root, asset.kind === 'repo' ? asset.file : 'scripts/diagnostics/static-media/assets/' + asset.file);
  const buffer = fs.readFileSync(file); assert.equal(buffer.length, asset.bytes); assert.equal(sha(buffer), asset.sha256);
  if (asset.file.endsWith('.css')) for (const url of cssUrls(buffer.toString('utf8'))) { if (url.startsWith('data:')) assert(/^data:image\/svg\+xml(?:;base64)?,/.test(url)); else assert(assets.files.some(row => row.url === url && row.file.endsWith('.woff2'))); }
  const destination = ownPath(output, 'site/' + asset.url.slice(1)); fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, buffer);
}
const html = mediaSourcePresent => '<!doctype html><html lang="en" class="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=5,viewport-fit=cover">' + assets.css.map(url => `<link rel="stylesheet" href="${url}">`).join('') + '</head><body class="__variable_d8ebd1 __variable_4dc837 font-sans antialiased"><div id="root">' + renderToString(React.createElement(module.StaticPage, { mediaSourcePresent })) + '</div><script type="module" src="/client.js"></script></body></html>';
const present = html(true), absent = html(false);
assert(present.includes(sourceElement.replace(' />', '/>')) || /<source[^>]+src="\/video\/hero-bg.mp4"/.test(present));
assert(!/<source\b/.test(absent));
assert.equal(present.replace(/<source[^>]*\/>/, ''), absent);
fs.writeFileSync(ownPath(output, 'site/present.html'), present); fs.writeFileSync(ownPath(output, 'site/absent.html'), absent);
const smokeFile = 'tests/smoke/public-pages.spec.ts', smoke = fs.readFileSync(ownPath(root, smokeFile), 'utf8');
const smokeSf = ts.createSourceFile(smokeFile, smoke, ts.ScriptTarget.Latest, true);
let callback;
function inspect(n) { if (ts.isCallExpression(n) && n.expression.getText(smokeSf) === 'test' && n.arguments[0]?.text === "homepage What's New section is visible") callback = n.arguments[1]; ts.forEachChild(n, inspect); }
inspect(smokeSf); assert(callback && ts.isArrowFunction(callback));
const callbackFile = ownPath(output, 'generated/callback.ts');
fs.writeFileSync(callbackFile, `import {expect} from '@playwright/test';export const actualWhatsNew: (fixtures:{page:import('@playwright/test').Page})=>Promise<void> = ${callback.getText(smokeSf)};\n`);
const generatedCallbackText = fs.readFileSync(callbackFile, 'utf8');
const generatedCallbackSf = ts.createSourceFile('callback.ts', generatedCallbackText, ts.ScriptTarget.Latest, true);
const callbackCallsites = {};
function nativeCallsites(node) { if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'scrollIntoViewIfNeeded') { const name = node.expression.expression.getText(generatedCallbackSf); assert(['heading', 'card'].includes(name)); assert(!Object.hasOwn(callbackCallsites, name)); callbackCallsites[name] = generatedCallbackSf.getLineAndCharacterOfPosition(node.getStart(generatedCallbackSf)).line + 1; } ts.forEachChild(node, nativeCallsites); }
nativeCallsites(generatedCallbackSf); assert.deepEqual(Object.keys(callbackCallsites).sort(), ['card', 'heading']);
const manifest = { base: BASE, versions: expected, sourcePins: [homeFile, smokeFile, 'client/src/components/PageLayout.tsx', 'client/src/components/ui/button.tsx', 'client/src/lib/utils.ts', 'client/src/lib/wouter-shim.ts', 'app/globals.css', 'app/layout.tsx'].map(file => ({ file, sha256: sha(fs.readFileSync(ownPath(root, file))) })), callbackBodySha256: sha(Buffer.from(callback.body.getText(smokeSf))), callbackExpressionSha256: sha(Buffer.from(callback.getText(smokeSf))), extractedDeclarations: names.map(name => ({ name, sha256: sha(Buffer.from(nodes.get(name).getText(sf))) })), homePrefixSha256: sha(Buffer.from(prefix)), controlledPrefixSha256: sha(Buffer.from(controlledPrefix)), assetManifestSha256: sha(fs.readFileSync(ownPath(root, 'scripts/diagnostics/static-media/assets/manifest.json'))), omitted: ['Next App Router and its Link viewport prefetch/resource concurrency', 'auth/trpc/provider/onboarding/analytics effects', 'network-bearing Navbar/Footer', 'lower-page sections and full-document layout', 'Next streaming and hydration scheduling'], clientInputs: Object.keys(client.metafile.inputs).sort(), serverInputs: Object.keys(server.metafile.inputs).sort(), generated: ['generated/component.tsx', 'generated/client.tsx', 'generated/callback.ts', 'site/client.js', 'site/present.html', 'site/absent.html'].map(file => ({ file, sha256: sha(fs.readFileSync(ownPath(output, file))) })) };
manifest.callbackCallsites = callbackCallsites;
fs.writeFileSync(ownPath(output, 'BUILD-PROOF.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ buildPass: true, declarationCount: names.length, sourcePresentAbsentSsrOnlyDiff: true, fullCallbackBodyPreserved: true, assetCount: assets.files.length, noBrowserOrHttpServerStarted: true }));
