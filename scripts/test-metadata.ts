import fetch from 'node-fetch';

async function test() {
  try {
    const res = await fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email', {
      headers: { 'Metadata-Flavor': 'Google' }
    });
    const email = await res.text();
    console.log('Container Service Account Email:', email);
  } catch (err: any) {
    console.error('Failed to get service account email:', err.message);
  }
}

test();
