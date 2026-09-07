import test from 'node:test';
import assert from 'node:assert/strict';
import {isAllowedMutation} from '../src/lib/request-security.ts';
import {sessionMaxAge, hasSessionCredential} from '../src/lib/session-policy.ts';
import {readBoundedBody} from '../src/lib/bounded-body.ts';
import {safeInternalStorageUrl} from '../src/lib/image-source.ts';
for(const [name,headers,allowed] of [
 ['same origin',{origin:'https://imanjo.com'},true],
 ['external',{origin:'https://attacker.example'},false],
 ['null origin',{origin:'null'},false],
 ['forged proxy',{origin:'https://attacker.example','x-forwarded-host':'attacker.example'},false],
 ['missing',{},false],
 ['legacy referer',{referer:'https://imanjo.com/dashboard'},true],
]) test(`POST origin: ${name}`,()=>assert.equal(isAllowedMutation(new Request('http://localhost/api/auth/login',{method:'POST',headers}),'https://imanjo.com'),allowed));
test('refresh credential survives absent access cookie',()=>assert.equal(hasSessionCredential(undefined,'refresh'),true));
test('cookie lifetime follows server JWT expiry',()=>{const token='a.'+Buffer.from(JSON.stringify({exp:2000})).toString('base64url')+'.s';assert.equal(sessionMaxAge(token,86400,1000000),1000);assert.equal(sessionMaxAge(token,86400,3000000),0);});
test('bounded body reads valid data',async()=>assert.equal((await readBoundedBody(new Response('abc'),3)).toString(),'abc'));
test('bounded body rejects oversized streamed body',async()=>{await assert.rejects(readBoundedBody(new Response('abcd'),3));});
test('bounded body rejects oversized declared length',async()=>{await assert.rejects(readBoundedBody(new Response('a',{headers:{'content-length':'999'}}),3));});
for(const src of ['../secret','%2e%2e/secret','a/%252e%252e/b','https://evil.example/x','a\\b'])test(`reject image source ${src}`,()=>assert.equal(safeInternalStorageUrl(src,'http://localhost'),null));
test('accept internal image',()=>assert.equal(safeInternalStorageUrl('images/test.png','http://localhost'),'http://localhost/storage/images/test.png'));
