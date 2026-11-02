import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(process.argv.length!==2)throw Error('This behavioral fixture accepts no extra arguments.');
const allow=/^(SystemRoot|WINDIR|ComSpec|PATH|PATHEXT|TEMP|TMP|USERPROFILE|LOCALAPPDATA|APPDATA|ProgramFiles|ProgramFiles\(x86\)|NUMBER_OF_PROCESSORS|PROCESSOR_ARCHITECTURE|HOME|TMPDIR|LANG|LC_ALL|TZ)$/i;
const env={...Object.fromEntries(Object.entries(process.env).filter(([key])=>allow.test(key))),NODE_ENV:'test',CI:'1'};
if (JSON.parse((await import('node:fs')).readFileSync(new URL('../node_modules/typescript/package.json',import.meta.url),'utf8')).version !== '5.9.3') {
 console.error('The reviewed export check requires TypeScript 5.9.3.');process.exit(1);
}
const result=spawnSync(process.execPath,['--require','./scripts/terminal-no-network.cjs','--test','tests/behavior/design-canvas-export.test.cjs'],
 {cwd:root,env,stdio:'inherit',windowsHide:true,timeout:30000});
if(result.error)console.error('The isolated canvas behavior check could not complete.');
process.exitCode=result.status??1;
