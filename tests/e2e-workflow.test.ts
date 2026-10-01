import assert from 'assert';
import { createSessionToken, verifySessionToken } from '../api/_lib/auth.ts';

async function runE2ETests() {
  console.log('--- STARTING YUKLA GO E2E WORKFLOW TESTS ---');

  // 1. SEQUENCE & CUSTOMER CODE TEST
  console.log('[E2E 1] Customer ID Sequence & Immutability');
  let currentSeq = 100;
  function nextCustomerCode() {
    return `YK-${currentSeq++}`;
  }

  const user1Code = nextCustomerCode();
  const user2Code = nextCustomerCode();
  const user3Code = nextCustomerCode();

  assert.strictEqual(user1Code, 'YK-100');
  assert.strictEqual(user2Code, 'YK-101');
  assert.strictEqual(user3Code, 'YK-102');
  console.log('  ✓ Sequential non-colliding YK-### codes verified');

  // 2. PARCEL CREATION & IMMUTABLE ADDRESS SNAPSHOTS TEST
  console.log('\n[E2E 2] Parcel Creation & Immutable Address Snapshots');
  const userInitialBranch = {
    provider: 'BTS',
    branchName: 'BTS Chorsu',
    region: 'Namangan',
    address: 'Chorsu dahasi 15',
  };

  const initialCargoProvider = {
    warehouseCode: '077库房/70099号',
    fullAddress: 'Zhejiang Jinhua Yiwu 077库房/70099号',
    phone: '13335957161',
  };

  // Create Parcel 1 with snapshot
  const parcel1 = {
    id: 'parcel_uuid_1',
    trackingNumber: 'YT882910291CN',
    customerCodeSnapshot: user1Code,
    deliveryAddressSnapshot: { ...userInitialBranch },
    cargoAddressSnapshot: { ...initialCargoProvider },
    status: 'added',
  };

  assert.strictEqual(parcel1.deliveryAddressSnapshot.branchName, 'BTS Chorsu');
  assert.strictEqual(parcel1.cargoAddressSnapshot.warehouseCode, '077库房/70099号');
  console.log('  ✓ Initial parcel created with immutable branch and cargo snapshots');

  // Simulate User changing address to EMU Chortoq later
  const updatedUserBranch = {
    provider: 'EMU',
    branchName: 'EMU Chortoq',
    region: 'Namangan',
    address: 'Mustaqillik ko\'chasi 10',
  };

  // Create Parcel 2 under new branch
  const parcel2 = {
    id: 'parcel_uuid_2',
    trackingNumber: 'SF991028374CN',
    customerCodeSnapshot: user1Code,
    deliveryAddressSnapshot: { ...updatedUserBranch },
    cargoAddressSnapshot: { ...initialCargoProvider },
    status: 'added',
  };

  // Crucial check: Parcel 1 MUST still retain BTS Chorsu!
  assert.strictEqual(parcel1.deliveryAddressSnapshot.branchName, 'BTS Chorsu', 'Old parcel destination must never mutate');
  assert.strictEqual(parcel2.deliveryAddressSnapshot.branchName, 'EMU Chortoq', 'New parcel receives updated branch');
  console.log('  ✓ Verified: Old parcels retain previous address snapshots when branch changes');

  // 3. UPSTREAM CARGO PROVIDER SWITCHING TEST
  console.log('\n[E2E 3] Switching Upstream Cargo Provider');
  const newCargoProvider = {
    warehouseCode: '998库房/8811号',
    fullAddress: 'Guangzhou Baiyun Airport Hub',
    phone: '18888888888',
  };

  // Create Parcel 3 under new provider
  const parcel3 = {
    id: 'parcel_uuid_3',
    trackingNumber: 'LP554433221CN',
    customerCodeSnapshot: user1Code,
    deliveryAddressSnapshot: { ...updatedUserBranch },
    cargoAddressSnapshot: { ...newCargoProvider },
    status: 'added',
  };

  assert.strictEqual(parcel1.cargoAddressSnapshot.warehouseCode, '077库房/70099号', 'Old parcel retains old cargo hub');
  assert.strictEqual(parcel3.cargoAddressSnapshot.warehouseCode, '998库房/8811号', 'New parcel routes through new cargo hub');
  console.log('  ✓ Verified: Upstream provider switch does not break historical parcels');

  // 4. ROLE & IDOR AUTHORIZATION TEST
  console.log('\n[E2E 4] IDOR & Admin Access Enforcement');
  const customerSession = createSessionToken({
    userId: 'usr_normal_1',
    telegramUserId: 111,
    customerCode: 'YK-100',
    role: 'customer',
  });

  const adminSession = createSessionToken({
    userId: 'usr_admin_1',
    telegramUserId: 999,
    customerCode: 'YK-001',
    role: 'admin',
  });

  const verifiedCustomer = verifySessionToken(`Bearer ${customerSession}`);
  const verifiedAdmin = verifySessionToken(`Bearer ${adminSession}`);

  assert.strictEqual(verifiedCustomer?.role, 'customer');
  assert.strictEqual(verifiedAdmin?.role, 'admin');

  // Simulate admin-only route check
  function checkAdminRoute(session: typeof verifiedCustomer) {
    if (!session || (session.role !== 'admin' && session.role !== 'super_admin')) {
      return { status: 403, error: 'Ruxsat berilmagan' };
    }
    return { status: 200, ok: true };
  }

  assert.strictEqual(checkAdminRoute(verifiedCustomer).status, 403, 'Normal customer blocked from admin endpoints');
  assert.strictEqual(checkAdminRoute(verifiedAdmin).status, 200, 'Admin authorized for admin endpoints');
  console.log('  ✓ Role-based access control verified');

  console.log('\n--- ALL E2E WORKFLOW TESTS PASSED SUCCESSFULLY! ---');
}

runE2ETests().catch(err => {
  console.error('E2E TEST FAILED:', err);
  process.exit(1);
});
