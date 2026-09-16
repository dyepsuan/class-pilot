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
const content = '%PDF-1.4\nPhase 4 local material\n%%EOF';
try {
  const result = await run('INSERT INTO users (email, display_name, auth_id) VALUES (?, ?, ?)', `phase3-${token}@test`, 'Phase 4 fixture', token);
  userId = result.meta.last_row_id;
  studentId = (await run('INSERT INTO students (student_number, first_name, last_name) VALUES (?, ?, ?)', token, 'Phase3', 'Fixture')).meta.last_row_id;
  for (const name of ['A','B','C']) classes.push((await run("INSERT INTO classes (instructor_id, subject_code, subject_name, section, school_year, term) VALUES (?, ?, ?, ?, '2026', '1ST_SEMESTER')",userId, name, name, name)).meta.last_row_id);
  for (const id of classes.slice(0,2)) await run("INSERT INTO enrollments (class_id, student_id, status) VALUES (?, ?, 'ACTIVE')",id,studentId);
  const expires = new Date(Date.now()+3600000).toISOString();
  const studentHash = createHash('sha256').update(token).digest('base64url');
  await run('INSERT INTO student_sessions (id, student_id, session_token_hash, expires_at) VALUES (?, ?, ?, ?)',randomUUID(),studentId,studentHash,expires);
  await run('INSERT INTO auth_sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',randomUUID(),token,studentHash,expires);
  for (const [index,id] of classes.entries()) {
    const form = new FormData(); form.set('class',String(id)); form.set('title',`Phase 4 Class ${index}`); form.set('description','Local HTTP fixture');
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
  const instructorCookie=`class_pilot_session=${token}`;
  const row = () => DB.prepare('SELECT * FROM class_files WHERE id=?').bind(fileIds[0]).first();
  const views = () => DB.prepare('SELECT * FROM class_file_views WHERE class_file_id=? ORDER BY version').bind(fileIds[0]).all();
  const roster = async () => {
    const response=await fetch(`${base}/api/classes/${classes[0]}/class-files/${fileIds[0]}/views`,{headers:{cookie:instructorCookie}});
    assert.equal(response.status,200); assert.match(response.headers.get('cache-control'),/no-store/);
    return (await response.json()).students;
  };
  const instructorPage = async count => {
    const response=await fetch(`${base}/classes/${classes[0]}/dropbox`,{headers:{cookie:instructorCookie}});
    assert.equal(response.status,200); const html=await response.text();
    assert.match(html,new RegExp(`${count}<!-- --> / <!-- -->1<!-- --> viewed`));
    return html;
  };
  let html=await page(classes[0]); assert.match(html,/>NEW</); assert.match(html,/Phase 4 Class 0/);
  assert.equal((await views()).results.length,0);
  await page(classes[1]); assert.equal((await views()).results.length,0);
  for(const key of keys) assert.ok(!html.includes(key));
  await instructorPage(0); assert.equal((await roster())[0].isViewed,0);
  const view=await fetch(`${base}/api/student/class-files/${fileIds[0]}/view?version=99&storageKey=arbitrary`,{headers:{cookie:cookie()}});
  assert.equal(view.status,200); assert.equal(await view.text(),content);
  assert.equal((await views()).results.length,1); assert.equal((await views()).results[0].version,1);
  html=await page(classes[0]); assert.ok(!html.includes('>NEW<'));
  await instructorPage(1);
  const student=(await roster())[0]; assert.equal(student.studentId,studentId); assert.equal(student.isViewed,1); assert.ok(student.lastViewedAt);
  const edited=await fetch(`${base}/api/classes/${classes[0]}/class-files/${fileIds[0]}`,{method:'PATCH',headers:{cookie:instructorCookie,origin:base,'Content-Type':'application/json'},body:JSON.stringify({title:'Edited resource',description:'Metadata only'})});
  assert.equal(edited.status,200); assert.equal((await row()).version,1); await instructorPage(1);
  assert.ok(!(await page(classes[0])).includes('>NEW<'));
  const replacementContent='%PDF-1.4\nPhase 4 replacement\n%%EOF';
  const data=new FormData(); data.set('file',new File([replacementContent],'replacement.pdf',{type:'application/pdf'}));
  const replaced=await fetch(`${base}/api/classes/${classes[0]}/class-files/${fileIds[0]}/replace`,{method:'POST',body:data,headers:{cookie:instructorCookie,origin:base}});
  assert.equal(replaced.status,200); keys.push((await row()).storage_key);
  assert.equal((await row()).version,2); assert.match(await page(classes[0]),/>NEW</);
  await instructorPage(0); assert.equal((await roster())[0].isViewed,0); assert.equal((await roster())[0].lastViewedAt,null);
  assert.equal((await views()).results[0].version,1);
  const download=await fetch(`${base}/api/student/class-files/${fileIds[0]}/download`,{headers:{cookie:cookie()}});
  assert.equal(download.status,200); assert.equal(await download.text(),replacementContent);
  assert.ok(!(await page(classes[0])).includes('>NEW<')); await instructorPage(1);
  assert.deepEqual((await views()).results.map(v=>v.version),[1,2]);
  const first=(await views()).results[1].first_viewed_at;
  await fetch(`${base}/api/student/class-files/${fileIds[0]}/view`,{headers:{cookie:cookie()}});
  assert.equal((await views()).results.length,2); assert.equal((await views()).results[1].first_viewed_at,first);
  assert.match(await page(classes[1]),/>NEW</);
  assert.equal((await DB.prepare('SELECT COUNT(*) n FROM class_file_views WHERE class_file_id=?').bind(fileIds[1]).first()).n,0);
  await run("UPDATE enrollments SET status='DROPPED' WHERE class_id=? AND student_id=?",classes[0],studentId);
  assert.deepEqual(await roster(),[]);
  const droppedPage=await fetch(`${base}/classes/${classes[0]}/dropbox`,{headers:{cookie:instructorCookie}});
  assert.match(await droppedPage.text(),/0<!-- --> \/ <!-- -->0<!-- --> viewed/);
  for(const action of ['view','download']) assert.equal((await fetch(`${base}/api/student/class-files/${fileIds[0]}/${action}`,{headers:{cookie:cookie()}})).status,404);
  assert.equal((await views()).results.length,2);
  assert.equal((await fetch(`${base}/api/classes/${classes[0]}/class-files/${fileIds[0]}/views`,{headers:{cookie:cookie()}})).status,404);
  assert.equal((await fetch(`${base}/api/classes/${classes[2]}/class-files/${fileIds[0]}/views`,{headers:{cookie:instructorCookie}})).status,404);
  await run("UPDATE enrollments SET status='ACTIVE' WHERE class_id=? AND student_id=?",classes[0],studentId);
  assert.match(await page(classes[0],'?section=student'),/Upload/);
  console.log('PASS: local instructor upload; listing/class switching create no rows; NEW before access; View marks v1; repeat preserves first timestamp; server refresh removes NEW; instructor count/details; metadata edit preserves state; replacement resets NEW/count/details while retaining v1; Download marks v2; independent class read state; DROPPED removes current statistics and denies old URLs without erasing history; details authorization; Student Files accessible.');
} finally {
  for(const id of classes) {
    const rows=await DB.prepare('SELECT storage_key FROM class_files WHERE class_id=?').bind(id).all();
    for(const row of rows.results) await DROPBOX_BUCKET.delete(row.storage_key);
    await run('DELETE FROM class_files WHERE class_id=?',id);
  }
  for(const key of keys) await DROPBOX_BUCKET.delete(key);
  if(studentId) {
    await run('DELETE FROM dropbox_files WHERE student_id=?',studentId);
    await run('DELETE FROM student_sessions WHERE student_id=?',studentId);
    await run('DELETE FROM enrollments WHERE student_id=?',studentId);
    await run('DELETE FROM students WHERE id=?',studentId);
  }
  for(const id of classes) await run('DELETE FROM classes WHERE id=?',id);
  if(userId) {await run('DELETE FROM auth_sessions WHERE user_id=?',token); await run('DELETE FROM users WHERE id=?',userId);}
  await proxy.dispose(); console.log('Local fixtures and historical tracking rows cleaned.');
}
