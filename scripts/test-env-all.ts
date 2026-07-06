async function printKeys() {
  console.log('--- ALL Environment Variable Keys ---');
  for (const key of Object.keys(process.env).sort()) {
    const val = process.env[key] || '';
    console.log(`${key} (length: ${val.length})`);
  }
}
printKeys();
