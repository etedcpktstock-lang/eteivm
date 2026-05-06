function statusOf(t) {
  return String(t.action_type || t.status || t['สถานะ'] || '').toLowerCase();
}

function shouldHideSupersededPickup(txn, txns) {
  const statusStr = statusOf(txn);
  if (!statusStr.includes('รับคืน')) return false;
  const jobId = String(txn.job_id || txn.jobId || 'NO_JOB');
  const itemId = String(txn.item_id || txn.rowIndex || 'NO_ITEM');
  return txns.some(other => {
    if (other === txn) return false;
    const otherStatus = statusOf(other);
    const otherJobId = String(other.job_id || other.jobId || 'NO_JOB');
    const otherItemId = String(other.item_id || other.rowIndex || 'NO_ITEM');
    return otherJobId === jobId && otherItemId === itemId && (otherStatus.includes('รอตรวจ') || otherStatus.includes('quarantine'));
  });
}

const txns = [
  { id: '1', job_id: 'JOB-1', item_id: 10, action_type: 'รับคืนจากร้าน', quantity: 1 },
  { id: '2', job_id: 'JOB-1', item_id: 10, action_type: 'รอตรวจสอบ', quantity: 1 }
];
const visible = txns.filter(t => !shouldHideSupersededPickup(t, txns));
if (visible.length !== 1 || visible[0].action_type !== 'รอตรวจสอบ') {
  console.error('FAIL: pickup was not hidden after quarantine exists', visible);
  process.exit(1);
}

const pickupOnly = [{ id: '3', job_id: 'JOB-2', item_id: 10, action_type: 'รับคืนจากร้าน', quantity: 1 }];
const visiblePickupOnly = pickupOnly.filter(t => !shouldHideSupersededPickup(t, pickupOnly));
if (visiblePickupOnly.length !== 1) {
  console.error('FAIL: pickup-only item should remain visible', visiblePickupOnly);
  process.exit(1);
}

console.log('repair-management-filter regression assertions passed');
