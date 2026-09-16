import assert from 'node:assert/strict';
import { getPlatformProxy } from 'wrangler';
import { randomUUID, createHash } from 'node:crypto';
const proxy = await getPlatformProxy({ remoteBindings: false });
const { DB, DROPBOX_BUCKET } = proxy.env;
const run = (sql,...args) => DB.prepare(sql).bind(...args).run();
const token = randomUUID();
let userId, studentId;
const classes = [], fileIds = [], keys = [];
const base = 'http://localhost:3103';
const content = '%PDF-1.4\nPhase 3 local material\n%%EOF';
try {
  const result = await run('INSERT INTO users (email, display_name, auth_id) VALUES (?, ?, ?)', `phase3-${token}@test`, 'Phase 3 fixture', token);
  userId = result.meta.last_row_id;
  studentId = (await run('INSERT INTO students (student_number, first_name, last_name) VALUES (?, ?, ?)', token, 'Phase3', 'Fixture')).meta.last_row_id;
  for (const name of ['A','B','C']) classes.push((await run("INSERT INTO classes (instructor_id, subject_code, subject_name, section, school_year, term) VALUES (?, ?, ?, ?, '2026', '1ST_SEMESTER')",userId, name, name, name)).meta.last_row_id);
  for (const id of classes.slice(0,2)) await run("INSERT INTO enrollments (class_id, student_id, status) VALUES (?, ?, 'ACTIVE')",id,studentId);
  const expires = new Date(Date.now()+3600000).toISOString();
  const studentHash = createHash('sha256').update(token).digest('base64url');
  await run('INSERT INTO student_sessions (id, student_id, session_token_hash, expires_at) VALUES (?, ?, ?, ?)',randomUUID(),studentId,studentHash,expires);
  await run('INSERT INTO auth_sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',randomUUID(),token,studentHash,expires);
  for (const [index,id] of classes.entries()) {
    const form = new FormData(); form.set('class',String(id)); form.set('title',`Phase 3 Class ${index}`); form.set('description','Local HTTP fixture');
    form.set('file',new File([content],`教材-${index}.pdf`,{type:'application/pdf'}));
    const response = await fetch(`${base}/api/classes/${id}/class-files`,{method:'POST',body:form,headers:{cookie:`class_pilot_session=${token}`,origin:base}});
    assert.equal(response.status,200,await response.text());
    const row = await DB.prepare('SELECT id, storage_key FROM class_files WHERE class_id=?').bind(id).first();
    fileIds.push(row.id); keys.push(row.storage_key);
  }
  const cookie = (id=classes[0]) => `class_pilot_student_session=${token}; class_pilot_student_class=${id}`;
  const page = async (id,section='') => {
    const response=await fetch(`${base}/student/dropbox${section}`,{headers:{cookie:cookie(id)}});
    assert.equal(response.status,200); return response.text();
  };
  let html=await page(classes[0]);
  assert.match(html,/Phase 3 Class 0/); assert.ok(!html.includes('Phase 3 Class 1')); assert.ok(!html.includes('StudentDropboxUploader'));
  assert.match(html,/aria-current="page"[^>]*>Class Files/);
  for (const key of keys) assert.ok(!html.includes(key));
  html=await page(classes[1]); assert.match(html,/Phase 3 Class 1/); assert.ok(!html.includes('Phase 3 Class 0'));
  for (const action of ['view','download']) {
    const response=await fetch(`${base}/api/student/class-files/${fileIds[0]}/${action}?storageKey=arbitrary&classId=${classes[2]}`,{headers:{cookie:cookie()}});
    assert.equal(response.status,200); assert.equal(await response.text(),content);
    assert.match(response.headers.get('content-disposition'),action==='view'?/^inline;/:/^attachment;/);
    assert.ok(response.headers.get('content-disposition').includes(encodeURIComponent('教材-0.pdf')));
    assert.match(response.headers.get('cache-control'),/no-store/);
    assert.equal((await fetch(`${base}/api/student/class-files/${fileIds[2]}/${action}`,{headers:{cookie:cookie()}})).status,404);
    assert.equal((await fetch(`${base}/api/student/class-files/${fileIds[0]}/${action}`)).status,404);
  }
  await run("UPDATE enrollments SET status='DROPPED' WHERE class_id=? AND student_id=?",classes[0],studentId);
  html=await page(classes[0]); assert.ok(!html.includes('Phase 3 Class 0'));
  for (const action of ['view','download']) assert.equal((await fetch(`${base}/api/student/class-files/${fileIds[0]}/${action}`,{headers:{cookie:cookie()}})).status,404);
  await run("UPDATE enrollments SET status='ACTIVE' WHERE class_id=? AND student_id=?",classes[0],studentId);
  const studentFileId=randomUUID(), studentKey=`dropbox/${classes[0]}/${studentId}/${randomUUID()}`; keys.push(studentKey);
  await DROPBOX_BUCKET.put(studentKey,new TextEncoder().encode(content),{httpMetadata:{contentType:'application/pdf'}});
  await run('INSERT INTO dropbox_files (id,class_id,student_id,storage_key,original_filename,display_name,mime_type,file_size) VALUES (?,?,?,?,?,?,?,?)',studentFileId,classes[0],studentId,studentKey,'学生.pdf','Student fixture.pdf','application/pdf',Buffer.byteLength(content));
  html=await page(classes[0],'?section=student'); assert.match(html,/Student fixture.pdf/); assert.match(html,/Upload/);
  const download=await fetch(`${base}/api/student/dropbox/${studentFileId}/download`,{headers:{cookie:cookie()}}); assert.equal(download.status,200); assert.equal(await download.text(),content);
  const deletion=await fetch(`${base}/api/student/dropbox/${studentFileId}`,{method:'DELETE',headers:{cookie:cookie(),origin:base}}); assert.equal(deletion.status,200);
  assert.equal(await DB.prepare('SELECT id FROM dropbox_files WHERE id=?').bind(studentFileId).first(),null);
  assert.equal((await DB.prepare('SELECT COUNT(*) n FROM class_file_views WHERE student_id=?').bind(studentId).first()).n,1);
  console.log('PASS: instructor uploads, default student section, two-class cookie scope, View/Download Unicode headers and bytes, unauthorized/unauthenticated denial, old URLs denied after DROPPED, enrollment restored, Student Files listing/download/delete, one version-aware tracking row (Phase 4).');
} finally {
  for (const key of keys) await DROPBOX_BUCKET.delete(key);
  for (const id of classes) await run('DELETE FROM class_files WHERE class_id=?',id);
  if(studentId) {
    await run('DELETE FROM dropbox_files WHERE student_id=?',studentId);
    await run('DELETE FROM student_sessions WHERE student_id=?',studentId);
    await run('DELETE FROM enrollments WHERE student_id=?',studentId);
    await run('DELETE FROM students WHERE id=?',studentId);
  }
  for(const id of classes) { await run('DELETE FROM class_files WHERE class_id=?',id); await run('DELETE FROM classes WHERE id=?',id); }
  if(userId) { await run('DELETE FROM auth_sessions WHERE user_id=?',token); await run('DELETE FROM users WHERE id=?',userId); }
  await proxy.dispose(); console.log('Local fixtures cleaned.');
}
