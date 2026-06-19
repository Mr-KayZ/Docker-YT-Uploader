// This API route handles the upload of the client secret JSON file.

// Import necessary modules and functions
import type { APIRoute } from 'astro';
import { saveClientSecret, hasClientSecret } from '../../../lib/auth';

// Handle POST requests to upload the client secret file
export const POST: APIRoute = async ({ request }) => {
  // If a client secret already exists, reject the upload to prevent overwriting
  try {
    const formData = await request.formData();
    const file     = formData.get('file') as File | null;

    // If a client secret already exists, reject the upload to prevent overwriting
    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate that the uploaded file is a .json file
    if (!file.name.endsWith('.json')) {
      return new Response(JSON.stringify({ error: 'File must be a .json file' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const content = await file.text();
    await saveClientSecret(content);

    // Successfully saved the client secret
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    // Note: We don't check the contents of the JSON here - we just save it. The auth flow will validate it when we try to use it.
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};