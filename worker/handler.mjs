/** Worker HTTP adapter. Runtime secrets are supplied by Sites, never bundled. */
export function createWorker(handleApi, assets) {
 const buckets = new Map()
 return { async fetch(request, env) {
  const url = new URL(request.url)
  const headers = {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}
  if (url.pathname.startsWith('/api/')) {
   if (!['/api/analyze','/api/generate-vacancy'].includes(url.pathname)) return Response.json({error:'Маршрут не найден.'},{status:404,headers})
   if(request.method!=='POST') return Response.json({error:'Нужен POST-запрос.'},{status:405,headers:{...headers,Allow:'POST'}})
   if(request.headers.get('Origin') && request.headers.get('Origin')!==url.origin) return Response.json({error:'Запрос разрешён только с сайта приложения.'},{status:403,headers})
   const identity=request.headers.get('oai-authenticated-user-id') || request.headers.get('CF-Connecting-IP') || 'anonymous'
   const now=Date.now(); const previous=buckets.get(identity)
   const bucket=previous && previous.until>now ? previous : {count:0,until:now+60000}
   if(bucket.count>=4)return Response.json({error:'Слишком много запросов. Подождите минуту.'},{status:429,headers:{...headers,'Retry-After':'60'}})
   bucket.count++;buckets.set(identity,bucket)
   if(buckets.size>2000)for(const [key,b] of buckets)if(b.until<=now)buckets.delete(key)
   try {
    if(Number(request.headers.get('Content-Length')||0)>131072)return Response.json({error:'Запрос слишком большой.'},{status:413,headers})
    const reader=request.body?.getReader();let size=0;const chunks=[]
    if(reader)while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>131072){await reader.cancel();return Response.json({error:'Запрос слишком большой.'},{status:413,headers})}chunks.push(part.value)}
    const buffer=new Uint8Array(size);let offset=0;for(const c of chunks){buffer.set(c,offset);offset+=c.length}
    const result=await handleApi(url.pathname,JSON.parse(new TextDecoder().decode(buffer)),env)
    return Response.json(result,{headers})
   }catch{return Response.json({error:'Проверьте ответы и повторите запрос.'},{status:400,headers})}
  }
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405})
  const asset=assets[url.pathname] || (url.pathname==='/' ? assets['/index.html'] : null)
  if(!asset)return new Response('Not found',{status:404})
  return new Response(request.method==='HEAD'?null:Uint8Array.from(atob(asset.data),c=>c.charCodeAt(0)),{headers:{'Content-Type':asset.type,'X-Content-Type-Options':'nosniff','Cache-Control':url.pathname.startsWith('/assets/')?'public,max-age=31536000,immutable':'no-cache','Referrer-Policy':'strict-origin-when-cross-origin','Permissions-Policy':'microphone=(self), camera=(), geolocation=()'}})
 }}
}
