import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const sessionId = Array.isArray(req.query.sessionId) ? req.query.sessionId[0] : req.query.sessionId;

  if (!sessionId) {
    return res.status(400).json({ error: 'Missing sessionId parameter' });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return res.status(200).json(session);
  } catch (error: any) {
    console.error('Checkout session retrieve error:', error);
    return res.status(500).json({ error: error?.message || 'Internal Server Error' });
  }
}
