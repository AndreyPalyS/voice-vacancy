import {execFileSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
const files=execFileSync('git',['ls-files','-z']).toString().split('\0').filter(Boolean)
let count=0
for(const file of files){
 if((/(^|\/)(\.env($|\.)|node_modules\/|test-results\/)/.test(file)&&!file.endsWith('.env.example'))||/\.log$/.test(file))throw new Error('Forbidden tracked file: '+file)
 const bytes=readFileSync(file);const text=bytes.toString('utf8')
 if(/gsk_[a-zA-Z0-9]{20,}|gh[pousr]_[a-zA-Z0-9]{20,}|github_pat_[a-zA-Z0-9_]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text))throw new Error('Possible credential in '+file)
 count++
}
console.log('PASS: '+count+' tracked files checked; no environment files, logs or recognizable credentials.')
