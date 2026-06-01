import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

const getAppUrl = () => process.env.APP_URL || 'http://localhost:3000';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { bookingData, vehicleName, cancelUrl } = req.body ?? {};

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: 'STRIPE_SECRET_KEY is not set' });
    }

    const bookingDataString = JSON.stringify(bookingData || {});
    const description = bookingData?.dropoff && bookingData.dropoff !== 'N/A'
      ? `${bookingData.serviceType?.toUpperCase() || 'SERVICE'} - ${bookingData.pickup} to ${bookingData.dropoff}`
      : `${bookingData?.serviceType?.toUpperCase() || 'SERVICE'} - ${bookingData?.pickup || 'Unknown pickup'}`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'aud',
            product_data: {
              name: `Chauffeur Service: ${vehicleName || 'Booking'}`,
              description,
            },
            unit_amount: Math.max(0, Math.round((Number(bookingData?.price) || 0) * 100)),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${getAppUrl()}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${getAppUrl()}/booking`,
      metadata: {
        bookingDataChunk1: bookingDataString.substring(0, 450),
        bookingDataChunk2: bookingDataString.substring(450, 900),
        bookingDataChunk3: bookingDataString.substring(900, 1350),
        bookingDataChunk4: bookingDataString.substring(1350, 1800),
      },
    });

    return res.status(200).json({ id: session.id, url: session.url });
  } catch (error: any) {
    console.error('Stripe Error:', error);
    return res.status(500).json({ error: error?.message || 'Internal Server Error' });
  }
}
