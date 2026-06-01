import twilio from 'twilio';

export default async (req: any, res: any) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { to, message } = req.body ?? {};

  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
    console.warn('Twilio configuration is missing in environment variables.');
    return res.status(500).json({ error: 'Twilio configuration is missing' });
  }

  if (!to || !message) {
    return res.status(400).json({ error: 'Missing required fields: to, message' });
  }

  try {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const response = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to,
    });

    return res.status(200).json({ success: true, sid: response.sid });
  } catch (error: any) {
    if (error.code === 20003) {
      console.error('Twilio Auth Error: Invalid API keys.');
      return res.status(401).json({ error: 'Twilio Authentication Failed' });
    }
    console.error('Twilio SMS Error:', error?.message || error);
    return res.status(500).json({ error: error?.message || 'Internal Server Error' });
  }
};
