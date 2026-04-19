import { adminGraphQL, type ShopifyAdminContext } from "./shopify";

const STAGED_UPLOADS_CREATE = /* GraphQL */ `
  mutation StagedUploads($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets {
        url
        resourceUrl
        parameters { name value }
      }
      userErrors { field message }
    }
  }
`;

const FILE_CREATE = /* GraphQL */ `
  mutation FileCreate($files: [FileCreateInput!]!) {
    fileCreate(files: $files) {
      files { id fileStatus }
      userErrors { field message }
    }
  }
`;

type StagedUploadsData = {
  stagedUploadsCreate: {
    stagedTargets: Array<{
      url: string;
      resourceUrl: string;
      parameters: Array<{ name: string; value: string }>;
    }>;
    userErrors: Array<{ field: string[] | null; message: string }>;
  };
};

type FileCreateData = {
  fileCreate: {
    files: Array<{ id: string; fileStatus: string }>;
    userErrors: Array<{ field: string[] | null; message: string }>;
  };
};

export async function uploadToShopifyFiles(
  ctx: ShopifyAdminContext,
  file: { buffer: Buffer; filename: string; mimeType: string },
): Promise<{ fileId: string }> {
  const staged = await adminGraphQL<StagedUploadsData>(ctx, STAGED_UPLOADS_CREATE, {
    input: [
      {
        resource: "FILE",
        filename: file.filename,
        mimeType: file.mimeType,
        httpMethod: "POST",
        fileSize: String(file.buffer.length),
      },
    ],
  });
  const target = staged.stagedUploadsCreate.stagedTargets[0];
  if (!target) throw new Error("stagedUploadsCreate returned no target");

  const form = new FormData();
  for (const p of target.parameters) form.append(p.name, p.value);
  form.append("file", new Blob([new Uint8Array(file.buffer)], { type: file.mimeType }), file.filename);

  const uploadRes = await fetch(target.url, { method: "POST", body: form });
  if (!uploadRes.ok) {
    throw new Error(`Staged upload failed: ${uploadRes.status} ${await uploadRes.text()}`);
  }

  const created = await adminGraphQL<FileCreateData>(ctx, FILE_CREATE, {
    files: [
      {
        originalSource: target.resourceUrl,
        contentType: file.mimeType.startsWith("image/") ? "IMAGE" : "FILE",
        filename: file.filename,
      },
    ],
  });
  const fileNode = created.fileCreate.files[0];
  if (!fileNode) {
    throw new Error(`fileCreate failed: ${JSON.stringify(created.fileCreate.userErrors)}`);
  }
  return { fileId: fileNode.id };
}
