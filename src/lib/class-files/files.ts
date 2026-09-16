import "server-only";

import { listInstructorManagedClasses } from "@/lib/auth/instructor-class";
import { getAuthorizedInstructorClassFile } from "@/lib/auth/class-files";
import { createClassFileMetadataBatch, removeClassFileUploadMetadata, updateClassFileMetadata,
  replaceClassFileMetadata, deleteClassFileMetadata } from "@/lib/db/class-files";
import { putClassFileObject, deleteClassFileObject } from "./storage";
import { logDropboxServerError } from "@/lib/dropbox/logging";
import { createClassFileOperations } from "./operations";

export const instructorClassFiles = createClassFileOperations({
  managedClasses: listInstructorManagedClasses,
  authorizedFile: getAuthorizedInstructorClassFile,
  put: putClassFileObject,
  removeObject: deleteClassFileObject,
  insert: createClassFileMetadataBatch,
  rollback: removeClassFileUploadMetadata,
  edit: updateClassFileMetadata,
  replace: replaceClassFileMetadata,
  removeMetadata: deleteClassFileMetadata,
  log: logDropboxServerError,
});
