export async function readJsonResponse<T>(response: Response): Promise<T> {
  const body = await response.text();

  if (!body.trim()) {
    throw new Error(response.ok ? "Server returned an empty response" : `Request failed (${response.status})`);
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error(response.ok ? "Server returned invalid JSON" : `Request failed (${response.status})`);
  }
}
