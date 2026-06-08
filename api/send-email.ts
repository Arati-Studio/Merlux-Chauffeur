import nodemailer from 'nodemailer';

export default async (req: any, res: any) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { to, subject, html } = req.body ?? {};

  if (!process.env.SMTP_HOST || !process.env.SMTP_PORT || !process.env.SMTP_USER || !process.env.SMTP_PASS || !process.env.SMTP_FROM) {
    console.warn('SMTP configuration is missing in environment variables.');
    return res.status(500).json({ error: 'SMTP configuration is missing' });
  }

  if (!to || !subject || !html) {
    return res.status(400).json({ error: 'Missing required fields: to, subject, html' });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10),
      secure: parseInt(process.env.SMTP_PORT, 10) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: Array.isArray(to) ? to.join(',') : to,
      subject,
      html,
    });

    return res.status(200).json({ success: true, messageId: info.messageId });
  } catch (error: any) {
    console.error('Email Send Error:', error?.message || error);
    return res.status(500).json({ error: error?.message || 'Internal Server Error' });
  }
};
