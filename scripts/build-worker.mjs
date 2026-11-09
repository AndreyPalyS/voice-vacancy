import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises'
import path from 'node:path'
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'}
const assets={}
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){if(['server','.openai'].includes(entry.name))continue;const file=path.join(dir,entry.name);if(entry.isDirectory())await walk(file);else assets['/'+path.relative('dist',file).replaceAll('\\','/') ]={type:types[path.extname(file)]||'application/octet-stream',data:(await readFile(file)).toString('base64')}}}
await walk('dist')
const domain=await readFile('shared/domain.mjs','utf8')
const service=(await readFile('shared/service.mjs','utf8')).replace(/^import .*from '.\/domain.mjs'\r?\n/,'')
const handler=await readFile('worker/handler.mjs','utf8')
await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true})
await writeFile('dist/server/index.js',domain+'\n'+service+'\n'+handler+'\nexport default createWorker(handleApi,'+JSON.stringify(assets)+');\n')
await writeFile('dist/.openai/hosting.json',await readFile('.openai/hosting.json','utf8'))
console.log('Worker built with '+Object.keys(assets).length+' embedded assets; no environment files included.')
