import "server-only";

import type { AuthUser } from "@/lib/auth/session";
import type { InstructorManagedClass } from "@/lib/auth/instructor-class";
import type { ClassFileMetadata, NewClassFileMetadata } from "@/lib/db/class-files";
import { ClassFileOperationError, parseClassFileClassId, validateClassFileMetadata } from "./metadata-validation";
import { generateClassFileStorageKey } from "./storage-key";
import { validateClassFileUpload } from "./validation";

export type ClassFileUpload = {
  name: string;
  size: number;
  type: string;
  arrayBuffer(): Promise<ArrayBuffer>;
};

export type ClassFileOperationsPorts = {
  managedClasses(user: AuthUser): Promise<InstructorManagedClass[]>;
  authorizedFile(id: string, classId: number, user: AuthUser): Promise<ClassFileMetadata | null>;
  put(input: { storageKey: string; body: ArrayBuffer; contentType: string }): Promise<unknown>;
  removeObject(key: string): Promise<void>;
  insert(files: NewClassFileMetadata[]): Promise<void>;
  rollback(ids: string[]): Promise<void>;
  edit(file: ClassFileMetadata, userId: number, metadata: { title: string; description: string | null }): Promise<boolean>;
  replace(file: ClassFileMetadata, userId: number, replacement: {
    originalFilename: string; storageKey: string; mimeType: string; fileSize: number;
  }): Promise<boolean>;
  removeMetadata(file: ClassFileMetadata, userId: number): Promise<boolean>;
  log(context: string, error: unknown): void;
};

export function createClassFileOperations(ports: ClassFileOperationsPorts) {
  function requireInstructor(user: AuthUser) {
    if (user.role !== "INSTRUCTOR") throw new ClassFileOperationError("NOT_FOUND", "File not found.", 404);
  }

  async function authorized(user: AuthUser, classId: number, id: string) {
    requireInstructor(user);
    const file = await ports.authorizedFile(id, classId, user);
    if (!file) throw new ClassFileOperationError("NOT_FOUND", "File not found.", 404);
    return file;
  }

  async function checkedFile(file: ClassFileUpload) {
    const validation = validateClassFileUpload(file);
    if (!validation.ok) {
      throw new ClassFileOperationError(validation.code, validation.message);
    }
    const body = await file.arrayBuffer();
    if (body.byteLength !== file.size) {
      throw new ClassFileOperationError("INVALID_FILE_SIZE", "The file size is invalid.");
    }
    return { body, mimeType: validation.mimeType };
  }

  async function cleanupObject(key: string): Promise<boolean> {
    // Bounded retries handle transient failures. Persistent failures are logged
    // without raw keys; the caller reports cleanup pending rather than undoing
    // a successful metadata mutation.
    for (let attempt = 0; attempt < 3; attempt++) {
      try { await ports.removeObject(key); return true; }
      catch (error) {
        if (attempt === 2) ports.log("[ClassPilot Class File object cleanup error]", error);
      }
    }
    return false;
  }

  return {
    async upload(user: AuthUser, scope: unknown, title: unknown, description: unknown, file: ClassFileUpload) {
      requireInstructor(user);
      const metadata = validateClassFileMetadata(title, description);
      const classId = scope === "all" ? null : parseClassFileClassId(scope);
      if (scope !== "all" && classId === null) {
        throw new ClassFileOperationError("INVALID_CLASS", "Choose a valid class.");
      }
      const managed = await ports.managedClasses(user);
      const targets = scope === "all" ? managed : managed.filter((item) => item.id === classId);
      if (!targets.length) throw new ClassFileOperationError("NOT_FOUND", "Class not found.", 404);
      const { body, mimeType } = await checkedFile(file);
      const records = targets.map((item): NewClassFileMetadata => {
        const id = crypto.randomUUID();
        return { id, classId: item.id, ...metadata, originalFilename: file.name.trim(),
          storageKey: generateClassFileStorageKey(item.id, id), mimeType, fileSize: body.byteLength,
          uploadedBy: user.id };
      });
      const written: string[] = [];
      let attemptedInsert = false;
      try {
        for (const record of records) {
          // Track before writing: a failed response may still have stored an object.
          written.push(record.storageKey);
          await ports.put({ storageKey: record.storageKey, body, contentType: mimeType });
        }
        attemptedInsert = true;
        await ports.insert(records);
      } catch (error) {
        if (attemptedInsert) {
          try { await ports.rollback(records.map((record) => record.id)); }
          catch (rollbackError) {
            ports.log("[ClassPilot Class File upload rollback error]", rollbackError);
            // Keep objects if metadata rollback failed, avoiding broken file rows.
            throw new ClassFileOperationError("ROLLBACK_FAILED",
              "Upload could not be completed. Some class copies may remain; check the class listings before retrying.", 500);
          }
        }
        const cleanups = await Promise.all(written.map(cleanupObject));
        ports.log("[ClassPilot Class File upload error]", error);
        throw new ClassFileOperationError("UPLOAD_FAILED", cleanups.every(Boolean)
          ? "Upload failed. No class copies were kept. Please try again."
          : "Upload failed. File cleanup could not be completed; the issue was logged.", 500);
      }
      return { classIds: targets.map((item) => item.id), count: records.length };
    },

    async edit(user: AuthUser, classId: number, id: string, title: unknown, description: unknown) {
      const file = await authorized(user, classId, id);
      const metadata = validateClassFileMetadata(title, description);
      if (!await ports.edit(file, user.id, metadata)) {
        throw new ClassFileOperationError("CONFLICT", "The file changed or is no longer available. Refresh and try again.", 409);
      }
      return { classIds: [file.classId] };
    },

    async replace(user: AuthUser, classId: number, id: string, replacement: ClassFileUpload) {
      const file = await authorized(user, classId, id);
      const { body, mimeType } = await checkedFile(replacement);
      const key = generateClassFileStorageKey(file.classId, file.id);
      try {
        await ports.put({ storageKey: key, body, contentType: mimeType });
        if (!await ports.replace(file, user.id, { originalFilename: replacement.name.trim(),
          storageKey: key, mimeType, fileSize: body.byteLength })) {
          throw new ClassFileOperationError("CONFLICT", "The file changed. Refresh and try again.", 409);
        }
      } catch (error) {
        await cleanupObject(key);
        throw error;
      }
      const cleanupPending = !await cleanupObject(file.storageKey);
      return { classIds: [file.classId], cleanupPending };
    },

    async delete(user: AuthUser, classId: number, id: string) {
      const file = await authorized(user, classId, id);
      // CAS deletion protects a concurrent replacement; views cascade in D1.
      // Delete metadata first so a storage failure cannot leave a visible broken row.
      if (!await ports.removeMetadata(file, user.id)) {
        throw new ClassFileOperationError("CONFLICT", "The file changed. Refresh and try again.", 409);
      }
      const cleanupPending = !await cleanupObject(file.storageKey);
      return { classIds: [file.classId], cleanupPending };
    },
  };
}
