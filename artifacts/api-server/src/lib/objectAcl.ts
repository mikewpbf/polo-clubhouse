import {
  CopyObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getR2Client } from "./r2Client";

export interface StoredObject {
  bucket: string;
  key: string;
}

const ACL_POLICY_METADATA_KEY = "acl-policy";

// Can be flexibly defined according to the use case.
//
// Examples:
// - USER_LIST: the users from a list stored in the database;
// - EMAIL_DOMAIN: the users whose email is in a specific domain;
// - GROUP_MEMBER: the users who are members of a specific group;
// - SUBSCRIBER: the users who are subscribers of a specific service / content
//   creator.
export enum ObjectAccessGroupType {}

export interface ObjectAccessGroup {
  type: ObjectAccessGroupType;
  // The logic id that identifies qualified group members. Format depends on the
  // ObjectAccessGroupType — e.g. a user-list DB id, an email domain, a group id.
  id: string;
}

export enum ObjectPermission {
  READ = "read",
  WRITE = "write",
}

export interface ObjectAclRule {
  group: ObjectAccessGroup;
  permission: ObjectPermission;
}

// Stored as object custom metadata under "acl-policy" (JSON string).
export interface ObjectAclPolicy {
  owner: string;
  visibility: "public" | "private";
  aclRules?: Array<ObjectAclRule>;
}

function isPermissionAllowed(
  requested: ObjectPermission,
  granted: ObjectPermission,
): boolean {
  if (requested === ObjectPermission.READ) {
    return [ObjectPermission.READ, ObjectPermission.WRITE].includes(granted);
  }
  return granted === ObjectPermission.WRITE;
}

abstract class BaseObjectAccessGroup implements ObjectAccessGroup {
  constructor(
    public readonly type: ObjectAccessGroupType,
    public readonly id: string,
  ) {}

  public abstract hasMember(userId: string): Promise<boolean>;
}

function createObjectAccessGroup(
  group: ObjectAccessGroup,
): BaseObjectAccessGroup {
  switch (group.type) {
    // Implement per access group type, e.g.:
    // case "USER_LIST":
    //   return new UserListAccessGroup(group.id);
    default:
      throw new Error(`Unknown access group type: ${group.type}`);
  }
}

// S3 doesn't support direct metadata update — we have to self-copy with
// MetadataDirective: REPLACE. This preserves the policy contract from the GCS
// implementation.
export async function setObjectAclPolicy(
  objectFile: StoredObject,
  aclPolicy: ObjectAclPolicy,
): Promise<void> {
  const client = getR2Client();
  await client.send(
    new HeadObjectCommand({ Bucket: objectFile.bucket, Key: objectFile.key }),
  );
  await client.send(
    new CopyObjectCommand({
      Bucket: objectFile.bucket,
      Key: objectFile.key,
      CopySource: `${objectFile.bucket}/${encodeURIComponent(objectFile.key)}`,
      Metadata: {
        [ACL_POLICY_METADATA_KEY]: JSON.stringify(aclPolicy),
      },
      MetadataDirective: "REPLACE",
    }),
  );
}

export async function getObjectAclPolicy(
  objectFile: StoredObject,
): Promise<ObjectAclPolicy | null> {
  try {
    const client = getR2Client();
    const result = await client.send(
      new HeadObjectCommand({ Bucket: objectFile.bucket, Key: objectFile.key }),
    );
    const aclPolicy = result.Metadata?.[ACL_POLICY_METADATA_KEY];
    if (!aclPolicy) return null;
    return JSON.parse(aclPolicy);
  } catch {
    return null;
  }
}

export async function canAccessObject({
  userId,
  objectFile,
  requestedPermission,
}: {
  userId?: string;
  objectFile: StoredObject;
  requestedPermission: ObjectPermission;
}): Promise<boolean> {
  const aclPolicy = await getObjectAclPolicy(objectFile);
  if (!aclPolicy) {
    return false;
  }

  if (
    aclPolicy.visibility === "public" &&
    requestedPermission === ObjectPermission.READ
  ) {
    return true;
  }

  if (!userId) {
    return false;
  }

  if (aclPolicy.owner === userId) {
    return true;
  }

  for (const rule of aclPolicy.aclRules || []) {
    const accessGroup = createObjectAccessGroup(rule.group);
    if (
      (await accessGroup.hasMember(userId)) &&
      isPermissionAllowed(requestedPermission, rule.permission)
    ) {
      return true;
    }
  }

  return false;
}
