import { spawn } from 'node:child_process';

function assert(ok, msg, detail = '') {
  if (!ok) {
    console.error(`FAIL: ${msg}`);
    if (detail) console.error(detail);
    process.exit(1);
  }
  console.log(`✅ ${msg}`);
}

function runSmoke() {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['tsx', 'scripts/e2e_serialized_smoke.ts'], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`serialized smoke exited ${code}\n${stderr || stdout}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

const { stdout } = await runSmoke();
const result = JSON.parse(stdout);

assert(result?.ok === true, 'serialized smoke script คืน ok=true');
assert(result?.checks?.afterIssue?.stock_qty === 0, 'afterIssue stock_qty เป็น 0');
assert(result?.checks?.afterIssue?.transit_qty === 1, 'afterIssue transit_qty เป็น 1');
assert(result?.checks?.afterIssue?.asset_status === 'in_transit', 'afterIssue asset status เป็น in_transit');

assert(result?.checks?.afterFulfill?.transit_qty === 0, 'afterFulfill transit_qty เป็น 0');
assert(result?.checks?.afterFulfill?.asset_status === 'with_customer', 'afterFulfill asset status เป็น with_customer');
assert(result?.checks?.afterFulfill?.customer_inventory === 1, 'afterFulfill customer inventory เป็น 1');

assert(result?.checks?.afterPickup?.transit_qty === 1, 'afterPickup transit_qty เป็น 1');
assert(result?.checks?.afterPickup?.asset_status === 'in_transit', 'afterPickup asset status เป็น in_transit');
assert(result?.checks?.afterPickup?.customer_inventory === 0, 'afterPickup customer inventory เป็น 0');

assert(result?.checks?.final?.quarantine_qty === 1, 'final quarantine_qty เป็น 1');
assert(result?.checks?.final?.transit_qty === 0, 'final transit_qty เป็น 0');
assert(result?.checks?.final?.asset_status === 'quarantine', 'final asset status เป็น quarantine');
assert(result?.checks?.final?.asset_lookup_status === 'quarantine', 'asset lookup สะท้อน quarantine');
assert(Number(result?.checks?.final?.history_rows || 0) >= 1, 'history มีแถวของ asset ทดสอบ');

console.log('✅ serialized regression passed');
