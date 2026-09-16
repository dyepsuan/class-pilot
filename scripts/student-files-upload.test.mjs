import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const encoded = source => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const mocks = {
  "@/lib/db/dropbox": encoded(`
    export const createDropboxFileMetadata = input => globalThis.__studentUploadTest.create(input);
    export const deleteDropboxFileMetadata = id => globalThis.__studentUploadTest.deleteMetadata(id);
  `),
  "@/lib/dropbox/storage": encoded(`
    export const putDropboxObject = input => globalThis.__studentUploadTest.put(input);
    export const deleteDropboxObject = key => globalThis.__studentUploadTest.remove(key);
  `),
  "@/lib/dropbox/logging": encoded(`export const logDropboxServerError = (...args) => globalThis.__studentUploadTest.log(...args);`),
};
const cache = new Map();
async function moduleUrl(url) {
  if (url.pathname.endsWith("/lib/dropbox/storage.ts")) return mocks["@/lib/dropbox/storage"];
  if (url.pathname.endsWith("/lib/dropbox/logging.ts")) return mocks["@/lib/dropbox/logging"];
  if (cache.has(url.href)) return cache.get(url.href);
  let source = await readFile(url, "utf8");
  let js = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
    .replace(/import ["']server-only["'];\r?\n/gu, "");
  for (const match of [...js.matchAll(/from ["']([^"']+)["']/gu)]) {
    const name=match[1]; let resolved=mocks[name];
    if(!resolved) resolved=await moduleUrl(name.startsWith("@/") ? new URL("../src/"+name.slice(2)+".ts",import.meta.url) : new URL(name+".ts",url));
    js=js.replace(match[0],`from "${resolved}"`);
  }
  const result=encoded(js); cache.set(url.href,result); return result;
}
const uploads=await import(await moduleUrl(new URL("../src/lib/dropbox/files.ts",import.meta.url)));
const validation=await import(await moduleUrl(new URL("../src/lib/dropbox/validation.ts",import.meta.url)));

function fixture() {
  const state={puts:[],removals:[],created:[],deleted:[],logs:[],putFailure:null,createFailure:null,cleanupFailure:null};
  state.put=async input=>{state.puts.push(input);if(state.putFailure)throw state.putFailure;return {key:input.storageKey};};
  state.create=async input=>{state.created.push(input);if(state.createFailure)throw state.createFailure;return {...input,updatedAt:input.createdAt};};
  state.remove=async key=>{state.removals.push(key);if(state.cleanupFailure)throw state.cleanupFailure;};
  state.deleteMetadata=async id=>{state.deleted.push(id);return true;};
  state.log=(...args)=>state.logs.push(args);
  globalThis.__studentUploadTest=state; return state;
}

function pdf(name="教材.pdf",contents="%PDF-1.4\nStudent file") {return new File([contents],name,{type:"application/pdf"});}

test("valid Unicode upload sends a known-length ArrayBuffer to R2 and preserves metadata",async()=>{
  const f=fixture(),file=pdf(); const result=await uploads.storeDropboxFile({classId:7,studentId:11,file});
  assert.equal(f.puts.length,1); assert.ok(f.puts[0].body instanceof ArrayBuffer);
  assert.equal(f.puts[0].body.byteLength,file.size); assert.equal(f.puts[0].contentType,"application/pdf");
  assert.match(f.puts[0].storageKey,/^dropbox\/7\/11\//); assert.equal(f.created.length,1);
  assert.equal(f.created[0].originalFilename,"教材.pdf"); assert.equal(f.created[0].displayName,"教材.pdf");
  assert.equal(f.created[0].fileSize,file.size); assert.equal(result.originalFilename,"教材.pdf");
});

test("Student Files upload never calls File.stream",async()=>{
  const f=fixture(); let streams=0;
  const file={name:"report.pdf",size:3,type:"application/pdf",arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer,stream(){streams++;throw Error("must not stream");}};
  await uploads.storeDropboxFile({classId:1,studentId:1,file});
  assert.equal(streams,0); assert.ok(f.puts[0].body instanceof ArrayBuffer);
  const source=await readFile(new URL("../src/lib/dropbox/files.ts",import.meta.url),"utf8");
  assert.doesNotMatch(source,/file\.stream\(\)/); assert.match(source,/await file\.arrayBuffer\(\)/);
});

for(const [label,file,code] of [
  ["zero-byte",{name:"empty.pdf",size:0,type:"application/pdf",arrayBuffer:async()=>{throw Error("must not buffer");}},"EMPTY_FILE"],
  ["oversized",{name:"huge.pdf",size:validation.MAX_DROPBOX_FILE_SIZE+1,type:"application/pdf",arrayBuffer:async()=>{throw Error("must not buffer");}},"FILE_TOO_LARGE"],
  ["unsupported",{name:"malware.exe",size:3,type:"application/pdf",arrayBuffer:async()=>{throw Error("must not buffer");}},"DANGEROUS_FILE_TYPE"],
]) test(`${label} files fail before buffering or R2`,async()=>{
  const f=fixture(); await assert.rejects(uploads.storeDropboxFile({classId:1,studentId:1,file}),error=>error.code===code);
  assert.equal(f.puts.length,0); assert.equal(f.created.length,0); assert.equal(f.removals.length,0);
});

test("declared and actual byte-length mismatch fails before R2",async()=>{
  const f=fixture(),file={name:"report.pdf",size:4,type:"application/pdf",arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer};
  await assert.rejects(uploads.storeDropboxFile({classId:1,studentId:1,file}),error=>error.code==="INVALID_FILE_SIZE");
  assert.equal(f.puts.length,0); assert.equal(f.created.length,0);
});

test("R2 failure preserves existing behavior and does not attempt D1 metadata",async()=>{
  const f=fixture(); f.putFailure=Error("R2 unavailable");
  await assert.rejects(uploads.storeDropboxFile({classId:1,studentId:1,file:pdf()}),/R2 unavailable/);
  assert.equal(f.created.length,0); assert.equal(f.removals.length,0);
});

test("D1 failure removes the uploaded R2 object and rethrows",async()=>{
  const f=fixture(); f.createFailure=Error("D1 unavailable");
  await assert.rejects(uploads.storeDropboxFile({classId:1,studentId:1,file:pdf()}),/D1 unavailable/);
  assert.equal(f.puts.length,1); assert.deepEqual(f.removals,[f.puts[0].storageKey]);
});

test("cleanup failure is logged without hiding the D1 error",async()=>{
  const f=fixture(); f.createFailure=Error("D1 unavailable"); f.cleanupFailure=Error("R2 cleanup unavailable");
  await assert.rejects(uploads.storeDropboxFile({classId:1,studentId:1,file:pdf()}),/D1 unavailable/);
  assert.equal(f.removals.length,1); assert.equal(f.logs.length,1); assert.match(f.logs[0][0],/upload cleanup/);
});

test("existing Student Files delete still removes R2 before D1 metadata",async()=>{
  const f=fixture(); assert.equal(await uploads.deleteDropboxFile({id:"file-id",storageKey:"dropbox/1/1/00000000-0000-4000-8000-000000000000"}),true);
  assert.equal(f.removals.length,1); assert.deepEqual(f.deleted,["file-id"]);
});
