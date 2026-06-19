// app/src/pages/api/setup/credentials.ts
// This API route handles the upload of the client_secret.json file during setup.
// It validates the file and saves it to the server if it's valid.

import type { APIRoute } from 'astro';
import { saveClientSecret } from '../../../lib/auth.js';

const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();
    const file     = formData.get('file') as File | null;

    if (!file)
      return json({ error: 'No file provided.' }, 400);

    if (!file.name.endsWith('.json'))
      return json({ error: 'File must be a .json file.' }, 400);

    // saveClientSecret validates client_id and client_secret before writing
    await saveClientSecret(await file.text());

    return json({ success: true });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return json({ error: message }, 400);
  }
};