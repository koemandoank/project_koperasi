import { Readable } from "stream";
import { google } from "googleapis";

type ServiceAccountCreds = {
  client_email: string;
  private_key: string;
};

function getServiceAccountCreds(): ServiceAccountCreds {
  const jsonEnv = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (jsonEnv) {
    const parsed = JSON.parse(jsonEnv) as ServiceAccountCreds;
    if (!parsed.client_email || !parsed.private_key) {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON tidak lengkap");
    }
    return parsed;
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!email || !privateKey) {
    throw new Error(
      "Kredensial Google Drive belum dikonfigurasi. Set GOOGLE_SERVICE_ACCOUNT_JSON atau GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY di .env"
    );
  }

  return { client_email: email, private_key: privateKey };
}

function getDriveClient() {
  const creds = getServiceAccountCreds();
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });
  return google.drive({ version: "v3", auth });
}

export async function uploadToGoogleDrive(
  folderId: string,
  fileName: string,
  content: Buffer,
  mimeType: string
): Promise<string> {
  const drive = getDriveClient();
  const stream = Readable.from(content);

  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: stream,
    },
    fields: "id",
    supportsAllDrives: true,
  });

  const fileId = response.data.id;
  if (!fileId) {
    throw new Error("Upload ke Google Drive gagal — tidak ada file ID");
  }

  return fileId;
}

export function isGoogleDriveConfigured(): boolean {
  try {
    getServiceAccountCreds();
    return true;
  } catch {
    return false;
  }
}
