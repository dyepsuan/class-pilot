import assert from 'node:assert/strict';
import { getPlatformProxy } from 'wrangler';
import { randomUUID, createHash } from 'node:crypto';
const proxy = await getPlatformProxy({ remoteBindings: false });
const { DB, DROPBOX_BUCKET } = proxy.env;
const run = (sql,...args) => DB.prepare(sql).bind(...args).run();
const token = randomUUID();
let userId, studentId, otherUserId; const otherToken=randomUUID();
const classes = [], fileIds = [], keys = [];
const base = 'http://localhost:3103';
const content = '%PDF-1.4\nPhase 5 local material\n%%EOF';
try {
  const result = await run('INSERT INTO users (email, display_name, auth_id) VALUES (?, ?, ?)', `phase3-${token}@test`, 'Phase 5 fixture', token);
  userId = result.meta.last_row_id;
  studentId = (await run('INSERT INTO students (student_number, first_name, last_name) VALUES (?, ?, ?)', token, 'Phase3', 'Fixture')).meta.last_row_id;
  for (const name of ['A','B','C']) classes.push((await run("INSERT INTO classes (instructor_id, subject_code, subject_name, section, school_year, term) VALUES (?, ?, ?, ?, '2026', '1ST_SEMESTER')",userId, name, name, name)).meta.last_row_id);
  for (const id of classes.slice(0,2)) await run("INSERT INTO enrollments (class_id, student_id, status) VALUES (?, ?, 'ACTIVE')",id,studentId);
  const expires = new Date(Date.now()+3600000).toISOString();
  const studentHash = createHash('sha256').update(token).digest('base64url');
  await run('INSERT INTO student_sessions (id, student_id, session_token_hash, expires_at) VALUES (?, ?, ?, ?)',randomUUID(),studentId,studentHash,expires);
  await run('INSERT INTO auth_sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',randomUUID(),token,studentHash,expires);
  for (const [index,id] of classes.entries()) {
    const form = new FormData(); form.set('class',String(id)); form.set('title',`Phase 5 Class ${index}`); form.set('description','Local HTTP fixture');
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
  const dashboard=async (id,expected)=>{
    const response=await fetch(`${base}/student?classId=${classes[2]}&studentId=999`,{headers:{cookie:cookie(id)}});
    assert.equal(response.status,200); const html=await response.text();
    if(expected===0) assert.ok(!html.includes('id="class-files-attention-heading"'));
    else {assert.match(html,new RegExp(`${expected}<!-- --> new class <!-- -->${expected===1?'file':'files'}`)); assert.ok(html.includes('/student/dropbox?section=class'));}
    const dropbox=await page(id); const badgeCount=(dropbox.match(/>NEW</g)||[]).length;
    assert.equal(badgeCount,expected);
    for(const key of keys) assert.ok(!html.includes(key));
    return html;
  };
  const fileRow=id=>DB.prepare('SELECT * FROM class_files WHERE id=?').bind(id).first();
  const studentViews=id=>DB.prepare('SELECT * FROM class_file_views WHERE class_file_id=? ORDER BY version').bind(id).all();
  const roster=async (id=fileIds[0],classId=classes[0],auth=instructorCookie)=>{
    const response=await fetch(`${base}/api/classes/${classId}/class-files/${id}/views`,{headers:{cookie:auth}});
    assert.equal(response.status,200); return (await response.json()).students;
  };
  const instructorPage=async (count,total=1)=>{
    const response=await fetch(`${base}/classes/${classes[0]}/dropbox`,{headers:{cookie:instructorCookie}});
    assert.equal(response.status,200); assert.match(await response.text(),new RegExp(`${count}<!-- --> / <!-- -->${total}<!-- --> viewed`));
  };
  const upload=async(scope,title)=>{
    const form=new FormData(); form.set('class',String(scope)); form.set('title',title); form.set('description','Local regression'); form.set('file',new File([content],'追加教材.pdf',{type:'application/pdf'}));
    const response=await fetch(`${base}/api/classes/${classes[0]}/class-files`,{method:'POST',body:form,headers:{cookie:instructorCookie,origin:base}});
    assert.equal(response.status,200); return response.json();
  };
  const remove=async(id,classId)=>{
    const before=await fileRow(id); keys.push(before.storage_key);
    const response=await fetch(`${base}/api/classes/${classId}/class-files/${id}?storageKey=do-not-delete`,{method:'DELETE',headers:{cookie:instructorCookie,origin:base}});
    if(response.status!==200) throw new Error(`Delete ${id} failed ${response.status}: ${await response.text()}`);
    assert.equal(await fileRow(id),null); assert.equal(await DROPBOX_BUCKET.get(before.storage_key),null);
    assert.equal((await studentViews(id)).results.length,0);
  };
  await dashboard(classes[0],1); assert.equal((await studentViews(fileIds[0])).results.length,0);
  await upload(classes[1],'Other managed class resource 1'); await upload(classes[1],'Other managed class resource 2');
  await dashboard(classes[1],3); await dashboard(classes[0],1);
  for(const action of ['view','download']){
    const response=await fetch(`${base}/api/classes/${classes[0]}/class-files/${fileIds[0]}/${action}`,{headers:{cookie:instructorCookie}});
    assert.equal(response.status,200); assert.equal(await response.text(),content);
    assert.match(response.headers.get('content-disposition'),action==='view'?/^inline;/:/^attachment;/);
    assert.ok(response.headers.get('content-disposition').includes(encodeURIComponent('教材-0.pdf')));
  }
  assert.equal((await studentViews(fileIds[0])).results.length,0);
  assert.equal((await upload('all','All Classes final regression')).count,3);
  const copies=(await DB.prepare('SELECT * FROM class_files WHERE title=? ORDER BY class_id').bind('All Classes final regression').all()).results;
  assert.equal(copies.length,3); assert.equal(new Set(copies.map(f=>f.storage_key)).size,3);
  for(const copy of copies) keys.push(copy.storage_key);
  await dashboard(classes[0],2); await dashboard(classes[1],4);
  assert.equal((await fetch(`${base}/api/student/class-files/${copies[0].id}/view`,{headers:{cookie:cookie()}})).status,200);
  await dashboard(classes[0],1); await dashboard(classes[1],4);
  for(const copy of copies) await remove(copy.id,copy.class_id);
  await dashboard(classes[0],1); await dashboard(classes[1],3);
  otherUserId=(await run('INSERT INTO users(email,display_name,auth_id) VALUES(?,?,?)',`other-${otherToken}@test`,'Other fixture',otherToken)).meta.last_row_id;
  await run('INSERT INTO auth_sessions(id,user_id,token_hash,expires_at) VALUES(?,?,?,?)',randomUUID(),otherToken,createHash('sha256').update(otherToken).digest('base64url'),new Date(Date.now()+3600000).toISOString());
  await run('UPDATE classes SET instructor_id=? WHERE id=?',otherUserId,classes[2]);
  for(const action of ['view','download','views']){
    assert.equal((await fetch(`${base}/api/classes/${classes[0]}/class-files/${fileIds[0]}/${action}`,{headers:{cookie:`class_pilot_session=${otherToken}`}})).status,404);
  }
  const tampered=new FormData(); tampered.set('class',String(classes[2])); tampered.set('title','Unauthorized'); tampered.set('file',new File([content],'a.pdf',{type:'application/pdf'}));
  assert.equal((await fetch(`${base}/api/classes/${classes[0]}/class-files`,{method:'POST',body:tampered,headers:{cookie:instructorCookie,origin:base}})).status,404);
  for(const action of ['view','download']){
    assert.equal((await fetch(`${base}/api/student/class-files/${fileIds[2]}/${action}?classId=${classes[0]}`,{headers:{cookie:cookie()}})).status,404);
    assert.equal((await fetch(`${base}/api/student/class-files/${fileIds[0]}/${action}`)).status,404);
  }
  const view=await fetch(`${base}/api/student/class-files/${fileIds[0]}/view?version=999&storageKey=arbitrary`,{headers:{cookie:cookie()}});
  assert.equal(view.status,200); assert.equal(await view.text(),content); await dashboard(classes[0],0); await instructorPage(1);
  assert.equal((await roster())[0].isViewed,1);
  const edit=await fetch(`${base}/api/classes/${classes[0]}/class-files/${fileIds[0]}`,{method:'PATCH',headers:{cookie:instructorCookie,origin:base,'Content-Type':'application/json'},body:JSON.stringify({title:'Final edited resource',description:'Final edited description'})});
  assert.equal(edit.status,200); assert.equal((await fileRow(fileIds[0])).version,1); await dashboard(classes[0],0); await instructorPage(1);
  const oldKey=(await fileRow(fileIds[0])).storage_key; const replacementContent='%PDF-1.4\nFinal replacement\n%%EOF';
  const replacement=new FormData(); replacement.set('file',new File([replacementContent],'新版.pdf',{type:'application/pdf'}));
  const replaced=await fetch(`${base}/api/classes/${classes[0]}/class-files/${fileIds[0]}/replace`,{method:'POST',body:replacement,headers:{cookie:instructorCookie,origin:base}});
  assert.equal(replaced.status,200); keys.push((await fileRow(fileIds[0])).storage_key); assert.equal((await fileRow(fileIds[0])).version,2); assert.equal(await DROPBOX_BUCKET.get(oldKey),null);
  await dashboard(classes[0],1); await instructorPage(0); assert.equal((await roster())[0].isViewed,0); assert.equal((await studentViews(fileIds[0])).results[0].version,1);
  const download=await fetch(`${base}/api/student/class-files/${fileIds[0]}/download`,{headers:{cookie:cookie()}});
  assert.equal(download.status,200); assert.equal(await download.text(),replacementContent); await dashboard(classes[0],0); await instructorPage(1);
  assert.deepEqual((await studentViews(fileIds[0])).results.map(v=>v.version),[1,2]);
  await remove(fileIds[0],classes[0]); await dashboard(classes[0],0); assert.ok(!(await page(classes[0])).includes('Final edited resource'));
  await dashboard(classes[1],3);
  await run("UPDATE enrollments SET status='DROPPED' WHERE class_id=? AND student_id=?",classes[1],studentId);
  await dashboard(classes[1],0); // Existing context falls back to the remaining active class A.
  for(const action of ['view','download']) assert.equal((await fetch(`${base}/api/student/class-files/${fileIds[1]}/${action}`,{headers:{cookie:cookie(classes[1])}})).status,404);
  await run("UPDATE enrollments SET status='ACTIVE' WHERE class_id=? AND student_id=?",classes[1],studentId); await dashboard(classes[1],3);
  const studentFileId=randomUUID(),studentKey=`dropbox/${classes[0]}/${studentId}/${randomUUID()}`; keys.push(studentKey);
  await DROPBOX_BUCKET.put(studentKey,new TextEncoder().encode(content));
  await run('INSERT INTO dropbox_files(id,class_id,student_id,storage_key,original_filename,display_name,mime_type,file_size) VALUES(?,?,?,?,?,?,?,?)',studentFileId,classes[0],studentId,studentKey,'学生.pdf','Student regression.pdf','application/pdf',Buffer.byteLength(content));
  assert.match(await page(classes[0],'?section=student'),/Student regression.pdf/);
  const existingDownload=await fetch(`${base}/api/student/dropbox/${studentFileId}/download`,{headers:{cookie:cookie()}}); assert.equal(existingDownload.status,200); assert.equal(await existingDownload.text(),content);
  assert.equal((await fetch(`${base}/api/student/dropbox/${studentFileId}`,{method:'DELETE',headers:{cookie:cookie(),origin:base}})).status,200);
  const instructorStudentFiles=await fetch(`${base}/classes/${classes[0]}/dropbox?section=student`,{headers:{cookie:instructorCookie}}); assert.equal(instructorStudentFiles.status,200);
  console.log('PASS: final instructor/student/dashboard lifecycle; 1 vs 3 selected-class counts; exact NEW badge agreement; other managed class and All Classes uploads; independent copies; instructor View/Download; metadata edit; replacement history and statistics; student View/Download; deletion cascades and exact R2 cleanup; DROPPED cookie fallback and old URL denial; unmanaged instructor/other-class/unauthenticated denial; ignored client keys/version/identity; Student Files list/download/delete and instructor tab.');
} finally {
  for(const id of classes){
    const rows=await DB.prepare('SELECT storage_key FROM class_files WHERE class_id=?').bind(id).all();
    for(const row of rows.results) await DROPBOX_BUCKET.delete(row.storage_key);
    await run('DELETE FROM class_files WHERE class_id=?',id);
  }
  for(const key of keys) await DROPBOX_BUCKET.delete(key);
  if(studentId){await run('DELETE FROM dropbox_files WHERE student_id=?',studentId); await run('DELETE FROM student_sessions WHERE student_id=?',studentId); await run('DELETE FROM enrollments WHERE student_id=?',studentId); await run('DELETE FROM students WHERE id=?',studentId);}
  for(const id of classes) await run('DELETE FROM classes WHERE id=?',id);
  if(userId){await run('DELETE FROM auth_sessions WHERE user_id=?',token); await run('DELETE FROM users WHERE id=?',userId);}
  if(otherUserId){await run('DELETE FROM auth_sessions WHERE user_id=?',otherToken); await run('DELETE FROM users WHERE id=?',otherUserId);}
  await proxy.dispose(); console.log('All local fixtures cleaned.');
}
