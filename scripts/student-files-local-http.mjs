import assert from 'node:assert/strict';
import {getPlatformProxy} from 'wrangler';
import {randomUUID,createHash} from 'node:crypto';
const proxy=await getPlatformProxy({remoteBindings:false});const {DB,DROPBOX_BUCKET}=proxy.env;
const run=(sql,...args)=>DB.prepare(sql).bind(...args).run();const token=randomUUID();let userId,studentId,classId,storageKey,fileId;
const base='http://localhost:3103',contents='%PDF-1.4\nKnown length Student Files\n%%EOF';
try{
 userId=(await run('INSERT INTO users(email,display_name,auth_id) VALUES(?,?,?)',`student-files-${token}@test`,'Student Files upload fixture',token)).meta.last_row_id;
 studentId=(await run('INSERT INTO students(student_number,first_name,last_name) VALUES(?,?,?)',token,'Student','Upload')).meta.last_row_id;
 classId=(await run("INSERT INTO classes(instructor_id,subject_code,subject_name,section,school_year,term) VALUES(?,?,?,?,?,'1ST_SEMESTER')",userId,'SF','Student Files','SF','2026')).meta.last_row_id;
 await run("INSERT INTO enrollments(class_id,student_id,status) VALUES(?,?,'ACTIVE')",classId,studentId);
 const hash=createHash('sha256').update(token).digest('base64url'),expires=new Date(Date.now()+3600000).toISOString();
 await run('INSERT INTO student_sessions(id,student_id,session_token_hash,expires_at) VALUES(?,?,?,?)',randomUUID(),studentId,hash,expires);
 const cookie=`class_pilot_student_session=${token}; class_pilot_student_class=${classId}`;
 const form=new FormData();form.set('files',new File([contents],'学生資料.pdf',{type:'application/pdf'}));
 const upload=await fetch(`${base}/api/student/dropbox`,{method:'POST',body:form,headers:{cookie,origin:base}});
 const body=await upload.json();assert.equal(upload.status,200,JSON.stringify(body));assert.equal(body.uploadedCount,1);assert.equal(body.failedCount,0);
 const row=await DB.prepare('SELECT * FROM dropbox_files WHERE class_id=? AND student_id=?').bind(classId,studentId).first();assert.ok(row);fileId=row.id;storageKey=row.storage_key;
 assert.equal(row.original_filename,'学生資料.pdf');assert.equal(row.display_name,'学生資料.pdf');assert.equal(row.file_size,Buffer.byteLength(contents));
 const object=await DROPBOX_BUCKET.get(storageKey);assert.ok(object);assert.equal(await new Response(object.body).text(),contents);
 const page=await fetch(`${base}/student/dropbox?section=student`,{headers:{cookie}});assert.equal(page.status,200);const html=await page.text();assert.match(html,/学生資料\.pdf/);assert.ok(!html.includes(storageKey));
 const download=await fetch(`${base}/api/student/dropbox/${fileId}/download`,{headers:{cookie}});assert.equal(download.status,200);assert.equal(await download.text(),contents);assert.ok(download.headers.get('content-disposition').includes(encodeURIComponent('学生資料.pdf')));
 const deletion=await fetch(`${base}/api/student/dropbox/${fileId}`,{method:'DELETE',headers:{cookie,origin:base}});assert.equal(deletion.status,200);assert.equal(await DB.prepare('SELECT id FROM dropbox_files WHERE id=?').bind(fileId).first(),null);assert.equal(await DROPBOX_BUCKET.get(storageKey),null);
 fileId=undefined;storageKey=undefined;
 console.log('PASS: real Student Files HTTP upload used local R2 without unknown-length failure; DB metadata/listing, Unicode filename, authenticated download, and DB/R2 delete all passed.');
}finally{
 if(classId&&studentId){
  const rows=await DB.prepare('SELECT id,storage_key FROM dropbox_files WHERE class_id=? AND student_id=?').bind(classId,studentId).all();
  for(const row of rows.results)await DROPBOX_BUCKET.delete(row.storage_key);
  await run('DELETE FROM dropbox_files WHERE class_id=? AND student_id=?',classId,studentId);
 }
 if(studentId)await run('DELETE FROM student_sessions WHERE student_id=?',studentId);
 if(classId){await run('DELETE FROM enrollments WHERE class_id=? AND student_id=?',classId,studentId);await run('DELETE FROM classes WHERE id=?',classId);}
 if(studentId){await run('DELETE FROM enrollments WHERE student_id=?',studentId);await run('DELETE FROM students WHERE id=?',studentId);}
 if(userId){await run('DELETE FROM auth_sessions WHERE user_id=?',token);await run('DELETE FROM users WHERE id=?',userId);}
 await proxy.dispose();console.log('Local Student Files fixture cleaned.');
}