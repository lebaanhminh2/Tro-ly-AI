import {TOOL_DECLARATIONS,modelStep,type ModelContent} from './contracts.ts';
import {TOOL_PERSONA,PROMPT_VERSION} from './persona.ts';
export class ModelError extends Error {}
function tokenUsage(response: unknown) {
 if(!response||typeof response!=='object'||Array.isArray(response))return {};
 const usage=(response as Record<string,unknown>).usageMetadata;
 if(!usage||typeof usage!=='object'||Array.isArray(usage))return {};
 const tokens:Partial<Record<'promptTokens'|'outputTokens'|'thinkingTokens'|'cachedTokens'|'totalTokens',number>>={};
 for(const [source,target] of [['promptTokenCount','promptTokens'],['candidatesTokenCount','outputTokens'],['thoughtsTokenCount','thinkingTokens'],['cachedContentTokenCount','cachedTokens'],['totalTokenCount','totalTokens']] as const){
  const value=(usage as Record<string,unknown>)[source];
  if(typeof value==='number'&&Number.isSafeInteger(value)&&value>=0&&value<=1000000000)tokens[target]=value;
 }
 return tokens;
}
export class Gemini {
 private options:{apiKey:string;model:string;transport?:typeof fetch;timeoutMs?:number};
 constructor(options:{apiKey:string;model:string;transport?:typeof fetch;timeoutMs?:number}){
  if(!options.apiKey.trim()||!/^[a-zA-Z0-9._-]+$/.test(options.model))throw new ModelError('INVALID_CONFIG');
  if(options.timeoutMs!==undefined&&(!Number.isFinite(options.timeoutMs)||options.timeoutMs<1||options.timeoutMs>25000))throw new ModelError('INVALID_TIMEOUT');
  this.options=options;
 }
 async generateTools(contents:ModelContent[],systemInstruction=TOOL_PERSONA,allowTools=true,allowedNames?:string[]){
  if(!contents.length||contents.length>32||contents.at(-1)?.role!=='user'||contents.some(c=>!['user','model'].includes(c.role)||!Array.isArray(c.parts)||!c.parts.length)
    ||JSON.stringify(contents).length+systemInstruction.length>48000)throw new ModelError('INVALID_INPUT');
  const controller=new AbortController(),started=Date.now(),timer=setTimeout(()=>controller.abort(),this.options.timeoutMs??5000);
  try{
   const transport=this.options.transport??fetch;
   const response=await transport(`https://generativelanguage.googleapis.com/v1beta/models/${this.options.model}:generateContent`,{
    method:'POST',redirect:'manual',signal:controller.signal,headers:{'Content-Type':'application/json','x-goog-api-key':this.options.apiKey},
    body:JSON.stringify({systemInstruction:{parts:[{text:systemInstruction}]},contents,tools:[{functionDeclarations:allowedNames?TOOL_DECLARATIONS.filter(t=>allowedNames.includes(t.name)):TOOL_DECLARATIONS}],
      toolConfig:{functionCallingConfig:{mode:allowTools?'AUTO':'NONE'}},generationConfig:{maxOutputTokens:2048}})
   });
   if(controller.signal.aborted)throw new ModelError('PROVIDER_TIMEOUT');
   if(!response.ok){await response.body?.cancel().catch(()=>{});throw new ModelError(response.status===429?'PROVIDER_RATE_LIMIT':`PROVIDER_HTTP_${response.status}`);}
   const raw=await response.text();if(raw.length>200000)throw new ModelError('PROVIDER_RESPONSE_TOO_LARGE');
   if(controller.signal.aborted)throw new ModelError('PROVIDER_TIMEOUT');
   let output:ReturnType<typeof modelStep>,parsed:unknown;
   try{parsed=JSON.parse(raw);output=modelStep(parsed);}catch{throw new ModelError('PROVIDER_INVALID_RESPONSE');}
   return {output,metrics:{model:this.options.model,promptVersion:PROMPT_VERSION,latencyMs:Date.now()-started,tokens:tokenUsage(parsed)}};
  }catch(error){
   if(controller.signal.aborted)throw new ModelError('PROVIDER_TIMEOUT');
   if(error instanceof ModelError)throw error;
   throw new ModelError('PROVIDER_TRANSPORT_ERROR');
  }finally{clearTimeout(timer);}
 }
}
