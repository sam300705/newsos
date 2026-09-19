import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { assertSafePublicUrl } from "@/core/url";
import { resolveSafeRedirect } from "@/lib/security/network-core";

function ipv4Parts(value:string){const p=value.split('.').map(Number); return p.length===4&&p.every(n=>Number.isInteger(n)&&n>=0&&n<=255)?p:null;}
export function isPrivateIp(address:string):boolean{
  if(isIP(address)===4){const p=ipv4Parts(address)!; const a=p[0]!,b=p[1]!; return a===0||a===10||a===127||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||(a===100&&b>=64&&b<=127)||(a>=224);}
  if(isIP(address)===6){const v=address.toLowerCase(); if(v==='::1'||v==='::')return true; if(v.startsWith('fc')||v.startsWith('fd')||v.startsWith('fe8')||v.startsWith('fe9')||v.startsWith('fea')||v.startsWith('feb'))return true; const mapped=v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/); if(mapped)return isPrivateIp(mapped[1]!);}
  return false;
}
export async function assertPublicDns(rawUrl:string):Promise<URL>{const url=assertSafePublicUrl(rawUrl); const addresses=await lookup(url.hostname,{all:true,verbatim:true}); if(!addresses.length)throw new Error('Host resolved to no addresses'); if(addresses.some(a=>isPrivateIp(a.address)))throw new Error('Host resolves to a private or reserved address'); return url;}

export async function fetchPublicResource(rawUrl:string, init:RequestInit={}, maxRedirects=5):Promise<Response>{
  let current=await assertPublicDns(rawUrl);
  for(let redirectCount=0; redirectCount<=maxRedirects; redirectCount++){
    const response=await fetch(current,{...init,redirect:'manual'});
    if(![301,302,303,307,308].includes(response.status))return response;
    const location=response.headers.get('location');
    if(!location)throw new Error('Redirect response did not include Location');
    if(redirectCount===maxRedirects)throw new Error('Too many redirects');
    const next=resolveSafeRedirect(current,location);
    current=await assertPublicDns(next.toString());
  }
  throw new Error('Too many redirects');
}
