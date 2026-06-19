import path from 'path';

export default async (req: any, res: any) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { exec } = await import('child_process');
    const scriptPath = path.join(process.cwd(), 'scripts', 'generate-sitemap.ts');

    console.log(`Triggering sitemap script: npx tsx "${scriptPath}"`);

    exec(`npx tsx "${scriptPath}"`, { timeout: 1000 * 60 * 5 }, (error: any, stdout: string, stderr: string) => {
      if (error) {
        console.error('Sitemap generation failed:', error);
        return res.status(500).json({ success: false, error: String(error), stderr });
      }
      console.log('Sitemap generation output:', stdout || stderr);
      return res.status(200).json({ success: true, message: 'Sitemap regenerated', stdout, stderr });
    });
  } catch (err: any) {
    console.error('Error invoking sitemap generator:', err);
    return res.status(500).json({ success: false, error: err?.message || String(err) });
  }
};
