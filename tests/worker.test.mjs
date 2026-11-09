import test from 'node:test'
import assert from 'node:assert/strict'
import {createWorker} from '../worker/handler.mjs'
const assets={'/index.html':{type:'text/html',data:Buffer.from('<h1>App</h1>').toString('base64')}}
test('worker serves embedded UI and keeps API secrets server-side',async()=>{
 const worker=createWorker(async(_route,_body,env)=>({source:env.GROQ_API_KEY?'ai':'template'}),assets)
 assert.match(await(await worker.fetch(new Request('https://app.test/'),{})).text(),/App/)
 const res=await worker.fetch(new Request('https://app.test/api/generate-vacancy',{method:'POST',body:'{}'}),{GROQ_API_KEY:'runtime-only'})
 assert.deepEqual(await res.json(),{source:'ai'})
 assert.equal((await worker.fetch(new Request('https://app.test/api/stt'),{})).status,404)
})
test('worker rejects cross-origin writes, malformed input and excessive requests',async()=>{
 const worker=createWorker(async()=>({ok:true}),assets)
 assert.equal((await worker.fetch(new Request('https://app.test/api/analyze',{method:'POST',headers:{Origin:'https://other.test'},body:'{}'}),{})).status,403)
 assert.equal((await worker.fetch(new Request('https://app.test/api/analyze',{method:'POST',body:'invalid'}),{})).status,400)
 for(let i=0;i<3;i++)await worker.fetch(new Request('https://app.test/api/analyze',{method:'POST',body:'{}'}),{})
 assert.equal((await worker.fetch(new Request('https://app.test/api/analyze',{method:'POST',body:'{}'}),{})).status,429)
})
