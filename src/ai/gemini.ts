import {TOOL_DECLARATIONS,modelStep,type ModelContent} from './contracts.ts';
import {TOOL_PERSONA,PROMPT_VERSION} from './persona.ts';
export class ModelError extends Error {}
export class Gemini {
 private options:{apiKey:string;model:string;transport?:typeof fetch;timeoutMs?:number};
 constructor(options:{apiKey:string;model:string;transport?:typeof fetch;timeoutMs?:number}){
  if(!options.apiKey.trim()||!/^[a-zA-Z0-9._-]+$/.test(options.model))throw new ModelError('INVALID_CONFIG');
  if(options.timeoutMs!==undefined&&(!Number.isFinite(options.timeoutMs)||options.timeoutMs<1||options.timeoutMs>25000))throw new ModelError('INVALID_TIMEOUT');
  this.options=options;
 }
 async generateTools(contents:ModelContent[],systemInstruction=TOOL_PERSONA,allowTools=true){
  if(!contents.length||contents.length>24||contents.at(-1)?.role!=='user'||contents.some(c=>!['user','model'].includes(c.role)||!Array.isArray(c.parts)||!c.parts.length)
    ||JSON.stringify(contents).length+systemInstruction.length>48000)throw new ModelError('INVALID_INPUT');
  const controller=new AbortController(),started=Date.now(),timer=setTimeout(()=>controller.abort(),this.options.timeoutMs??5000);
  try{
   const transport=this.options.transport??fetch;
   const response=await transport(`https://generativelanguage.googleapis.com/v1beta/models/${this.options.model}:generateContent`,{
    method:'POST',redirect:'manual',signal:controller.signal,headers:{'Content-Type':'application/json','x-goog-api-key':this.options.apiKey},
    body:JSON.stringify({systemInstruction:{parts:[{text:systemInstruction}]},contents,tools:[{functionDeclarations:TOOL_DECLARATIONS}],
      toolConfig:{functionCallingConfig:{mode:allowTools?'AUTO':'NONE'}},generationConfig:{maxOutputTokens:2048}})
   });
   if(!response.ok){await response.body?.cancel();throw new ModelError(response.status===429?'PROVIDER_RATE_LIMIT':`PROVIDER_HTTP_${response.status}`);}
   const raw=await response.text();if(raw.length>200000)throw new ModelError('PROVIDER_RESPONSE_TOO_LARGE');
   const output=modelStep(JSON.parse(raw));
   return {output,metrics:{model:this.options.model,promptVersion:PROMPT_VERSION,latencyMs:Date.now()-started}};
  }catch(error){
   if(error instanceof ModelError)throw error;
   throw new ModelError(controller.signal.aborted?'PROVIDER_TIMEOUT':'PROVIDER_TRANSPORT_OR_RESPONSE_ERROR');
  }finally{clearTimeout(timer);}
 }
}
