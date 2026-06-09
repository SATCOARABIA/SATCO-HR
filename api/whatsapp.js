// api/whatsapp.js  — Vercel serverless function
// Sends a WhatsApp message to the configured group via Green API.
// Environment variables required in Vercel project settings:
//   GREEN_API_INSTANCE_ID  — your Green API instance ID
//   GREEN_API_TOKEN        — your Green API token
//   WHATSAPP_GROUP_ID      — group chat ID e.g. 120363XXXXXXXXXX@g.us

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const instanceId = process.env.GREEN_API_INSTANCE_ID;
  const token      = process.env.GREEN_API_TOKEN;
  const groupId    = process.env.WHATSAPP_GROUP_ID;

  if (!instanceId || !token || !groupId) {
    return res.status(500).json({
      error: 'WhatsApp not configured — add GREEN_API_INSTANCE_ID, GREEN_API_TOKEN, WHATSAPP_GROUP_ID to Vercel environment variables'
    });
  }

  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  const url = `https://api.green-api.com/waInstance${instanceId}/sendMessage/${token}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: groupId, message }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.message || `Green API error: HTTP ${response.status}`,
        detail: data
      });
    }

    return res.status(200).json({ ok: true, idMessage: data.idMessage });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
