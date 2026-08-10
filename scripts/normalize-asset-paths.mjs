import { readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const assetsDir = join(root, 'public', 'assets');
const configPath = join(root, 'src', 'data', 'config.json');

const SANITIZE = (s) => s.replace(/[ ()]/g, '_');

function collect(dir, out) {
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        const st = statSync(p);
        if (st.isDirectory()) { collect(p, out); out.push(p); }
        else out.push(p);
    }
}

let renamed = 0;
if (statSync(assetsDir, { throwIfNoEntry: false })) {
    const entries = [];
    collect(assetsDir, entries);
    for (const p of entries) {
        const base = p.split(/[\\/]/).pop();
        const next = SANITIZE(base);
        if (next !== base) { renameSync(p, join(p, '..', next)); renamed++; }
    }
}

const cfg = readFileSync(configPath, 'utf8');
const hits = (cfg.match(/%20|%28|%29|\(|\)/g) || []).length;
const nextCfg = cfg
    .replace(/%20/g, '_')
    .replace(/%28/g, '_')
    .replace(/%29/g, '_')
    .replace(/\(/g, '_')
    .replace(/\)/g, '_');
writeFileSync(configPath, nextCfg);

console.log(`renamed ${renamed} paths; config.json tokens replaced: ${hits}`);
