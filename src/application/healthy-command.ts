// Parsing command boundaries is deterministic; conversational text after /ngu
// must not delay the stop-reminding transition.
export function healthyCommand(text:string):{kind:'sleep';message:string}|null{
 const match=/^\/ngu(?:@[A-Za-z0-9_]+)?(?:\s+([\s\S]*))?$/i.exec(text.trim());
 return match?{kind:'sleep',message:(match[1]??'').trim()}:null;
}
