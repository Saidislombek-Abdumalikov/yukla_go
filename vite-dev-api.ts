import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';
import { processTelegramUpdate, wipeBotUser, getInMemoryBotUsers } from './api/_lib/botEngine';
import { ALL_BRANCHES, findBranchById } from './api/_lib/branchesData';
import {
  getCoursesWithUserProgress,
  getCourseLessonsForUser,
  recordUserLessonProgress,
  getStudentsProgressSummary,
  resetStudentProgress,
  addLessonToCourse,
  deleteLesson,
  STORED_COURSES,
  STORED_LESSONS,
  addCourse,
  deleteCourse,
  getCourseAccessList,
  grantCourseAccess,
  revokeCourseAccess,
  hasUserCourseAccess,
  getUserCourseAccessStatus,
  requestCourseAccess,
  wipeAcademyUser,
} from './api/_lib/academyData';

interface DevParcel {
  id: string;
  trackingNumber: string;
  customerCode: string;
  status: 'added' | 'china_warehouse' | 'in_transit' | 'uzbekistan' | 'delivered';
  paymentStatus: 'pending' | 'paid';
  weightKg: number;
  amount: number;
  currency: string;
  chinaDate?: string;
  estimatedArrival?: string;
  cargoSubmittedAt?: string | null;
  deliveryBranchSnapshot?: {
    provider: string;
    branchName: string;
    region: string;
    address: string;
  };
  createdAt: string;
}

// In-memory dev state
let devUser = {
  id: 'usr_dev_100',
  telegramUserId: 99887766,
  customerCode: 'YK-100',
  name: 'Saidislom',
  phone: '+998 90 123 45 67',
  phoneVerified: true,
  status: 'active',
  ofertaAccepted: true,
  defaultDeliveryBranch: {
    provider: 'EMU',
    branchName: 'EMU Chortoq',
    region: 'Namangan viloyati',
    address: 'Mustaqillik ko\'chasi 10',
  },
};

let devUsersList: any[] = [
  devUser,
  {
    id: 'usr_dev_101',
    telegramUserId: 10101010,
    customerCode: 'YK-101',
    name: 'Bobur Mirzo',
    phone: '+998 91 234 56 78',
    phoneVerified: true,
    status: 'active',
    ofertaAccepted: true,
    defaultDeliveryBranch: {
      provider: 'BTS',
      branchName: 'BTS Chorsu Markaz',
      region: 'Namangan viloyati',
      address: 'Namangan sh., Chorsu dahasi, 12-uy',
    },
  },
  {
    id: 'usr_dev_102',
    telegramUserId: 20202020,
    customerCode: 'YK-102',
    name: 'Madina Alimova',
    phone: '+998 93 345 67 89',
    phoneVerified: true,
    status: 'active',
    ofertaAccepted: true,
    defaultDeliveryBranch: {
      provider: 'BTS',
      branchName: 'BTS Chorsu Markaz',
      region: 'Namangan viloyati',
      address: 'Namangan sh., Chorsu dahasi, 12-uy',
    },
  },
  {
    id: 'usr_dev_103',
    telegramUserId: 30303030,
    customerCode: 'YK-103',
    name: 'Jasur Bek',
    phone: '+998 97 456 78 90',
    phoneVerified: true,
    status: 'active',
    ofertaAccepted: true,
    defaultDeliveryBranch: {
      provider: 'BTS',
      branchName: 'BTS Samarqand Markaz',
      region: 'Samarqand viloyati',
      address: 'Mirzo Ulug\'bek ko\'chasi 45',
    },
  },
];

let devRates = {
  pricePerKg: 9.5,
  exchangeRate: 12850,
  supportUsername: 'nothing_related',
};

let devWarehouse = {
  id: 'cp_1',
  internal_name: 'Main China Air Hub',
  receiver_name: 'Yukla Go',
  phone: '13335957161',
  province: '浙江省',
  city: '金华市义乌市',
  warehouse_code: '077库房/70099号',
  address_template: '077库房/70099号 {customer_id}',
  active: true,
};

const devBranches = ALL_BRANCHES.map(b => ({
  id: b.id,
  provider: b.provider,
  branch_name: b.branchName,
  branchName: b.branchName,
  region: b.region,
  address: b.address,
  phone: b.phone,
}));

let devParcels: DevParcel[] = [
  {
    id: 'p_1',
    trackingNumber: 'YT882910291CN',
    customerCode: 'YK-100',
    status: 'in_transit',
    paymentStatus: 'pending',
    weightKg: 3.2,
    amount: 30.40,
    currency: 'USD',
    chinaDate: '28.09.2026',
    estimatedArrival: '05.10.2026',
    cargoSubmittedAt: '2026-09-28T12:00:00.000Z',
    deliveryBranchSnapshot: {
      provider: 'EMU',
      branchName: 'EMU Chortoq',
      region: 'Namangan viloyati',
      address: 'Mustaqillik ko\'chasi 10',
    },
    createdAt: '2026-09-28T10:00:00.000Z',
  },
  {
    id: 'p_2',
    trackingNumber: 'SF992019482CN',
    customerCode: 'YK-100',
    status: 'china_warehouse',
    paymentStatus: 'pending',
    weightKg: 1.5,
    amount: 14.25,
    currency: 'USD',
    chinaDate: '01.10.2026',
    estimatedArrival: '08.10.2026',
    cargoSubmittedAt: null,
    deliveryBranchSnapshot: {
      provider: 'EMU',
      branchName: 'EMU Chortoq',
      region: 'Namangan viloyati',
      address: 'Mustaqillik ko\'chasi 10',
    },
    createdAt: '2026-10-01T08:30:00.000Z',
  },
  {
    id: 'p_3',
    trackingNumber: 'JT382910381CN',
    customerCode: 'YK-101',
    status: 'uzbekistan',
    paymentStatus: 'paid',
    weightKg: 4.8,
    amount: 45.60,
    currency: 'USD',
    chinaDate: '20.09.2026',
    estimatedArrival: '02.10.2026',
    cargoSubmittedAt: '2026-09-20T16:00:00.000Z',
    deliveryBranchSnapshot: {
      provider: 'BTS',
      branchName: 'BTS Chilonzor',
      region: 'Toshkent shahri',
      address: 'Chilonzor 9-mavze, Qatortol 1',
    },
    createdAt: '2026-09-20T14:15:00.000Z',
  },
  {
    id: 'p_4',
    trackingNumber: 'YT771928371CN',
    customerCode: 'YK-102',
    status: 'delivered',
    paymentStatus: 'paid',
    weightKg: 2.1,
    amount: 19.95,
    currency: 'USD',
    chinaDate: '15.09.2026',
    estimatedArrival: '23.09.2026',
    cargoSubmittedAt: '2026-09-15T12:00:00.000Z',
    deliveryBranchSnapshot: {
      provider: 'BTS',
      branchName: 'BTS Chorsu Markaz',
      region: 'Namangan viloyati',
      address: 'Namangan sh., Chorsu dahasi, 12-uy',
    },
    createdAt: '2026-09-15T10:00:00.000Z',
  },
  {
    id: 'p_5',
    trackingNumber: 'SF391820192CN',
    customerCode: 'YK-103',
    status: 'china_warehouse',
    paymentStatus: 'pending',
    weightKg: 5.4,
    amount: 51.30,
    currency: 'USD',
    chinaDate: '01.10.2026',
    estimatedArrival: '08.10.2026',
    cargoSubmittedAt: null,
    deliveryBranchSnapshot: {
      provider: 'BTS',
      branchName: 'BTS Samarqand Markaz',
      region: 'Samarqand viloyati',
      address: 'Mirzo Ulug\'bek ko\'chasi 45',
    },
    createdAt: '2026-10-01T11:00:00.000Z',
  },
  {
    id: 'p_6',
    trackingNumber: 'YT559281729CN',
    customerCode: 'YK-104',
    status: 'in_transit',
    paymentStatus: 'pending',
    weightKg: 1.8,
    amount: 17.10,
    currency: 'USD',
    chinaDate: '29.09.2026',
    estimatedArrival: '06.10.2026',
    cargoSubmittedAt: '2026-09-29T14:00:00.000Z',
    deliveryBranchSnapshot: {
      provider: 'EMU',
      branchName: 'EMU Yunusobod',
      region: 'Toshkent shahri',
      address: 'Yunusobod 4-mavze, 15-uy',
    },
    createdAt: '2026-09-29T09:00:00.000Z',
  },
  {
    id: 'p_7',
    trackingNumber: 'JT920192841CN',
    customerCode: 'YK-105',
    status: 'china_warehouse',
    paymentStatus: 'pending',
    weightKg: 2.6,
    amount: 24.70,
    currency: 'USD',
    chinaDate: '02.10.2026',
    estimatedArrival: '09.10.2026',
    cargoSubmittedAt: null,
    deliveryBranchSnapshot: {
      provider: 'EMU',
      branchName: 'EMU Andijon Markaz',
      region: 'Andijon viloyati',
      address: 'Mashrab ko\'chasi 18',
    },
    createdAt: '2026-10-02T08:00:00.000Z',
  },
  {
    id: 'p_8',
    trackingNumber: 'YT661928301CN',
    customerCode: 'YK-106',
    status: 'uzbekistan',
    paymentStatus: 'pending',
    weightKg: 3.5,
    amount: 33.25,
    currency: 'USD',
    chinaDate: '25.09.2026',
    estimatedArrival: '03.10.2026',
    cargoSubmittedAt: '2026-09-25T10:00:00.000Z',
    deliveryBranchSnapshot: {
      provider: 'BTS',
      branchName: 'BTS Qo\'qon',
      region: 'Farg\'ona viloyati',
      address: 'Turkiston ko\'chasi 54',
    },
    createdAt: '2026-09-25T07:30:00.000Z',
  },
];

async function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => {
      resolve({});
    });
  });
}

function sendJson(res: ServerResponse, status: number, data: any) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.end(JSON.stringify(data));
}

export function devApiPlugin(): Plugin {
  return {
    name: 'dev-api-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url || '';
        const [path, queryString] = rawUrl.split('?');

        if (!path.startsWith('/api/')) {
          return next();
        }

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
          return res.end();
        }

        const params = new URLSearchParams(queryString || '');

        // 1. Auth session
        if (path === '/api/auth/session') {
          const body = (req as any).body || {};
          if (body.adminKey) {
            return sendJson(res, 200, {
              token: 'dev-admin-session-token',
              user: {
                id: 'usr_admin_master',
                telegramUserId: 7232597769,
                customerCode: 'ADMIN',
                name: 'Administrator',
                role: 'super_admin',
              },
            });
          }
          return sendJson(res, 200, {
            token: 'dev-session-token-yk100',
            user: devUser,
          });
        }

        // 2. User profile
        if (path === '/api/user/me') {
          return sendJson(res, 200, devUser);
        }

        // 3. Warehouse address (Dynamic from devWarehouse)
        if (path === '/api/config/warehouse') {
          const region = `${devWarehouse.province} ${devWarehouse.city}`.trim();
          const address = devWarehouse.address_template
            .replace('{warehouse_code}', devWarehouse.warehouse_code)
            .replace('{customer_id}', devUser.customerCode);

          return sendJson(res, 200, {
            receiver: `${devWarehouse.receiver_name} (${devUser.customerCode})`,
            phone: devWarehouse.phone,
            region,
            address,
            customerCode: devUser.customerCode,
          });
        }

        // 4. Shipping rates (Dynamic from devRates)
        if (path === '/api/config/rates') {
          return sendJson(res, 200, {
            pricePerKg: devRates.pricePerKg,
            exchangeRate: devRates.exchangeRate,
          });
        }

        // 5. Branches
        if (path === '/api/branches') {
          const provider = params.get('provider');
          let result = devBranches;
          if (provider) {
            result = result.filter(b => b.provider.toUpperCase() === provider.toUpperCase());
          }
          return sendJson(res, 200, result);
        }

        // 6. User location request
        if (path === '/api/user/location-request' && req.method === 'POST') {
          const body = await readBody(req);
          const found = devBranches.find(b => b.id === body.requestedBranchId);
          if (found) {
            devUser.defaultDeliveryBranch = {
              provider: found.provider,
              branchName: found.branchName,
              region: found.region,
              address: found.address,
            };
          }
          return sendJson(res, 200, {
            success: true,
            message: 'Manzilni o\'zgartirish so\'rovi qabul qilindi',
          });
        }

        // 7. Parcels GET / POST (Customer App)
        if (path === '/api/parcels') {
          if (req.method === 'GET') {
            return sendJson(res, 200, devParcels);
          }

          if (req.method === 'POST') {
            const body = await readBody(req);
            let trackList: string[] = [];
            if (typeof body.trackingNumber === 'string') {
              trackList = [body.trackingNumber];
            } else if (Array.isArray(body.trackingNumbers)) {
              trackList = body.trackingNumbers;
            }

            const cleanTracks = trackList
              .map(t => t.trim().toUpperCase())
              .filter(t => t.length > 0);

            if (cleanTracks.length === 0) {
              return sendJson(res, 400, { error: 'Trek raqamini kiriting' });
            }

            for (const t of cleanTracks) {
              const newParcel: DevParcel = {
                id: `p_dev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                trackingNumber: t,
                customerCode: devUser.customerCode,
                status: 'added',
                paymentStatus: 'pending',
                weightKg: 0,
                amount: 0,
                currency: 'USD',
                chinaDate: new Date().toLocaleDateString('ru-RU'),
                estimatedArrival: 'Aniqlanmoqda',
                cargoSubmittedAt: null,
                deliveryBranchSnapshot: devUser.defaultDeliveryBranch,
                createdAt: new Date().toISOString(),
              };
              devParcels.unshift(newParcel);
            }

            return sendJson(res, 201, {
              success: true,
              message: `${cleanTracks.length} ta trek muvaffaqiyatli qo'shildi`,
              parcels: devParcels,
            });
          }
        }

        // 8. Admin preview endpoints
        if (path.startsWith('/api/admin/')) {
          if (path === '/api/admin/stats') {
            const unsubmittedCount = devParcels.filter(p => !p.cargoSubmittedAt).length;
            return sendJson(res, 200, {
              totalUsers: 142,
              activeParcels: devParcels.filter(p => p.status !== 'delivered').length,
              unsubmittedTracks: unsubmittedCount,
              deliveredParcels: devParcels.filter(p => p.status === 'delivered').length,
              pendingLocationRequests: 2,
            });
          }

          if (path === '/api/admin/users') {
            if (req.method === 'GET') {
              const botUsers = getInMemoryBotUsers().map(bu => ({
                id: bu.id,
                telegramUserId: bu.telegramUserId,
                customerCode: bu.customerCode,
                name: bu.name,
                phone: bu.phone || '-',
                status: 'active',
                onboarding_completed: bu.onboardingCompleted,
                defaultDeliveryBranch: bu.defaultBranch || {
                  provider: 'BTS',
                  branchName: 'Markaziy',
                  region: 'Toshkent',
                  address: 'Markaz',
                },
              }));

              const all = [...devUsersList];
              for (const bu of botUsers) {
                if (!all.some(u => u.customerCode === bu.customerCode || u.telegramUserId === bu.telegramUserId)) {
                  all.push(bu);
                }
              }

              const search = params.get('search');
              if (search) {
                const s = search.toLowerCase();
                return sendJson(res, 200, all.filter(u =>
                  u.name?.toLowerCase().includes(s) ||
                  u.customerCode?.toLowerCase().includes(s) ||
                  u.phone?.toLowerCase().includes(s) ||
                  String(u.telegramUserId).includes(s)
                ));
              }
              return sendJson(res, 200, all);
            }

            if (req.method === 'PATCH') {
              const body = await readBody(req);
              const { userId, status } = body;
              const u = devUsersList.find(item => item.id === userId);
              if (u) u.status = status;
              return sendJson(res, 200, { success: true, message: `Holat yangilandi: ${status}` });
            }

            if (req.method === 'DELETE' || (req.method === 'POST' && path === '/api/admin/users')) {
              const body = req.method === 'POST' ? await readBody(req) : {};
              const targetId = params.get('id') || params.get('userId') || body.userId || body.id;
              const customerCode = params.get('customerCode') || body.customerCode;
              const tgId = params.get('telegramUserId') || body.telegramUserId;

              // Find target user
              const targetUser = devUsersList.find(u =>
                (targetId && u.id === targetId) ||
                (customerCode && u.customerCode.toUpperCase() === String(customerCode).toUpperCase()) ||
                (tgId && String(u.telegramUserId) === String(tgId))
              );

              const wipedCode = targetUser?.customerCode || customerCode;
              const wipedTgId = targetUser?.telegramUserId || tgId;
              const wipedUserId = targetUser?.id || targetId;

              // 1. Remove from devUsersList
              if (wipedUserId || wipedCode) {
                devUsersList = devUsersList.filter(u => u.id !== wipedUserId && u.customerCode !== wipedCode);
              }

              // 2. Wipe all parcels matching customer code
              let deletedParcelsCount = 0;
              if (wipedCode) {
                const initialLen = devParcels.length;
                devParcels = devParcels.filter(p => p.customerCode.toUpperCase() !== String(wipedCode).toUpperCase());
                deletedParcelsCount = initialLen - devParcels.length;
              }

              // 3. Wipe bot session and history
              if (wipedTgId) wipeBotUser(wipedTgId);
              if (wipedCode) wipeBotUser(wipedCode);
              if (wipedUserId) wipeBotUser(wipedUserId);

              // 4. Wipe Academy progress & course access
              if (wipedUserId) wipeAcademyUser(wipedUserId);
              if (wipedCode) wipeAcademyUser(wipedCode);

              return sendJson(res, 200, {
                success: true,
                message: `Mijoz (${wipedCode || wipedUserId}) va uning bot tarixi, ${deletedParcelsCount} ta yuk va dars progressi butunlay o'chirildi (Full Wipe)!`,
                wipedCustomerCode: wipedCode,
                deletedParcelsCount,
              });
            }
          }

          if (path === '/api/admin/parcels') {
            if (req.method === 'GET') {
              let result = devParcels;
              const unsubmitted = params.get('unsubmitted');
              const search = params.get('search');
              const provider = params.get('provider');
              const region = params.get('region');
              const branchId = params.get('branchId');

              if (unsubmitted === 'true') {
                result = result.filter(p => !p.cargoSubmittedAt);
              }
              if (provider && provider !== 'ALL') {
                result = result.filter(p => p.deliveryBranchSnapshot?.provider?.toUpperCase() === provider.toUpperCase());
              }
              if (region && region !== 'ALL') {
                result = result.filter(p => p.deliveryBranchSnapshot?.region?.toLowerCase().includes(region.toLowerCase()));
              }
              if (branchId && branchId !== 'ALL') {
                result = result.filter(p => p.deliveryBranchSnapshot?.branchName?.toLowerCase().includes(branchId.toLowerCase()) || p.deliveryBranchSnapshot?.address?.toLowerCase().includes(branchId.toLowerCase()));
              }
              if (search) {
                const s = search.toLowerCase();
                result = result.filter(p => p.trackingNumber.toLowerCase().includes(s) || p.customerCode.toLowerCase().includes(s));
              }
              return sendJson(res, 200, result);
            }

            // PATCH: Bulk status, payment, mark_submitted, or update weight/amount
            if (req.method === 'PATCH') {
              const body = await readBody(req);
              const { action, parcelIds, value, weightKg, amount } = body;
              if (Array.isArray(parcelIds)) {
                for (const id of parcelIds) {
                  const p = devParcels.find(item => item.id === id);
                  if (p) {
                    if (action === 'status') p.status = value;
                    if (action === 'payment') p.paymentStatus = value;
                    if (action === 'mark_submitted') p.cargoSubmittedAt = new Date().toISOString();
                    if (weightKg !== undefined) {
                      p.weightKg = Number(weightKg);
                      p.amount = Number((p.weightKg * devRates.pricePerKg).toFixed(2));
                    }
                    if (amount !== undefined) p.amount = Number(amount);
                  }
                }
              }
              return sendJson(res, 200, {
                success: true,
                message: 'Yuklar muvaffaqiyatli yangilandi',
                parcels: devParcels,
              });
            }

            // POST: Admin enters / imports tracks for users
            if (req.method === 'POST') {
              const body = await readBody(req);
              const { trackingNumbers, customerCode, status = 'china_warehouse', weightKg = 0, branchId, branch } = body;
              let tracks: string[] = [];
              if (typeof body.trackingNumber === 'string') tracks = [body.trackingNumber];
              else if (Array.isArray(trackingNumbers)) tracks = trackingNumbers;

              const cleanTracks = tracks
                .map(t => t.trim().toUpperCase())
                .filter(t => t.length > 0);

              const chosenBranch = branchId ? findBranchById(branchId) : (branch || null);
              const branchSnapshot = chosenBranch ? {
                provider: chosenBranch.provider,
                branchName: chosenBranch.branchName || chosenBranch.branch_name,
                region: chosenBranch.region,
                address: chosenBranch.address,
              } : devUser.defaultDeliveryBranch;

              let addedCount = 0;
              for (const trk of cleanTracks) {
                if (!devParcels.some(p => p.trackingNumber === trk)) {
                  const weight = Number(weightKg) || 0;
                  const price = Number((weight * devRates.pricePerKg).toFixed(2));
                  devParcels.unshift({
                    id: `p_dev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                    trackingNumber: trk,
                    customerCode: customerCode || devUser.customerCode,
                    status: status as any,
                    paymentStatus: 'pending',
                    weightKg: weight,
                    amount: price,
                    currency: 'USD',
                    chinaDate: new Date().toLocaleDateString('ru-RU'),
                    estimatedArrival: 'Aniqlanmoqda',
                    cargoSubmittedAt: null,
                    deliveryBranchSnapshot: branchSnapshot,
                    createdAt: new Date().toISOString(),
                  });
                  addedCount++;
                }
              }

              return sendJson(res, 201, {
                success: true,
                message: `${addedCount} ta yangi trek kiritildi`,
                parcels: devParcels,
              });
            }
          }

          // Cargo providers (China Warehouse Settings)
          if (path === '/api/admin/cargo-providers') {
            if (req.method === 'GET') {
              return sendJson(res, 200, [devWarehouse]);
            }
            if (req.method === 'PATCH') {
              const body = await readBody(req);
              if (body.receiver_name !== undefined) devWarehouse.receiver_name = body.receiver_name;
              if (body.phone !== undefined) devWarehouse.phone = body.phone;
              if (body.province !== undefined) devWarehouse.province = body.province;
              if (body.city !== undefined) devWarehouse.city = body.city;
              if (body.warehouse_code !== undefined) devWarehouse.warehouse_code = body.warehouse_code;
              if (body.address_template !== undefined) devWarehouse.address_template = body.address_template;
              return sendJson(res, 200, {
                success: true,
                message: 'Xitoy ombor manzili muvaffaqiyatli yangilandi',
                warehouse: devWarehouse,
              });
            }
          }

          if (path === '/api/admin/location-requests') {
            return sendJson(res, 200, []);
          }

          // System Settings (Rates & Support)
          if (path === '/api/admin/settings') {
            if (req.method === 'GET') {
              return sendJson(res, 200, devRates);
            }
            if (req.method === 'PATCH') {
              const body = await readBody(req);
              if (body.pricePerKg !== undefined) devRates.pricePerKg = Number(body.pricePerKg);
              if (body.exchangeRate !== undefined) devRates.exchangeRate = Number(body.exchangeRate);
              if (body.supportUsername !== undefined) devRates.supportUsername = String(body.supportUsername);

              // Recalculate parcel amounts if pricePerKg changed
              devParcels.forEach(p => {
                if (p.weightKg > 0) {
                  p.amount = Number((p.weightKg * devRates.pricePerKg).toFixed(2));
                }
              });

              return sendJson(res, 200, {
                success: true,
                message: 'Tariflar va sozlamalar muvaffaqiyatli saqlandi',
                settings: devRates,
              });
            }
          }

          // Academy Admin
          if (path.startsWith('/api/admin/academy')) {
            const courseId = params.get('courseId') || 'course_cargo_101';
            const action = params.get('action');

            if (req.method === 'GET') {
              if (action === 'access') {
                return sendJson(res, 200, getCourseAccessList(courseId));
              }

              if (action === 'students' || path === '/api/admin/academy/students') {
                const students = [
                  devUser,
                  { id: 'usr_dev_101', name: 'Bobur Mirzo', customerCode: 'YK-101' },
                  { id: 'usr_dev_102', name: 'Madina Alimova', customerCode: 'YK-102' },
                  { id: 'usr_dev_103', name: 'Jasur Bek', customerCode: 'YK-103' },
                ];
                return sendJson(res, 200, getStudentsProgressSummary(students, courseId));
              }

              if (action === 'lessons') {
                const list = STORED_LESSONS.filter(l => l.courseId === courseId).sort((a, b) => a.order - b.order);
                return sendJson(res, 200, list);
              }

              return sendJson(res, 200, { courses: STORED_COURSES, lessons: STORED_LESSONS });
            }

            if (req.method === 'POST') {
              const body = await readBody(req);

              if (body.action === 'create_course') {
                const created = addCourse({
                  title: body.title,
                  description: body.description,
                  icon: body.icon,
                  category: body.category,
                });
                return sendJson(res, 201, { success: true, course: created });
              }

              if (body.action === 'grant_access') {
                const target = body.identifier || body.userId || body.customerCode;
                const result = await grantCourseAccess(target, body.courseId || courseId);
                return sendJson(res, 200, {
                  success: true,
                  message: `${result.item?.name || target} ga darslarni ko'rish uchun ruxsat berildi!`,
                  item: result.item,
                });
              }

              if (body.action === 'revoke_access') {
                const target = body.identifier || body.userId || body.customerCode;
                const result = await revokeCourseAccess(target, body.courseId || courseId);
                return sendJson(res, 200, {
                  success: true,
                  message: 'Ruxsat bekor qilindi',
                  item: result.item,
                });
              }

              if (body.action === 'reset_progress') {
                resetStudentProgress(body.userId, body.courseId);
                return sendJson(res, 200, { success: true, message: 'Talaba progressi qayta boshlandi' });
              }

              if (body.action === 'add_lesson') {
                const created = addLessonToCourse(body.courseId || courseId, {
                  title: body.title,
                  youtubeUrlOrId: body.youtubeUrlOrId,
                  durationSeconds: Number(body.durationSeconds) || 360,
                  description: body.description,
                  order: Number(body.order),
                });
                return sendJson(res, 201, { success: true, lesson: created });
              }
            }

            if (req.method === 'DELETE') {
              const courseIdParam = params.get('courseId');
              if (courseIdParam) {
                deleteCourse(courseIdParam);
                return sendJson(res, 200, { success: true, message: 'Bo\'lim o\'chirildi' });
              }

              const lessonId = params.get('lessonId');
              if (lessonId) {
                deleteLesson(lessonId);
                return sendJson(res, 200, { success: true, message: 'Dars o\'chirildi' });
              }
            }
          }
        }

        // 8.5. Academy Customer Endpoints
        if (path === '/api/academy/courses') {
          const courseId = params.get('courseId');
          if (courseId) {
            const hasAccess = hasUserCourseAccess(devUser.id, courseId);
            const accessStatus = getUserCourseAccessStatus(devUser.id, courseId);
            if (!hasAccess) {
              return sendJson(res, 200, {
                hasAccess: false,
                accessStatus,
                lessons: [],
                message: 'Ushbu kursni ko\'rish uchun administrator ruxsati talab qilinadi.',
              });
            }
            return sendJson(res, 200, {
              hasAccess: true,
              accessStatus: 'granted',
              lessons: getCourseLessonsForUser(devUser.id, courseId),
            });
          }
          return sendJson(res, 200, getCoursesWithUserProgress(devUser.id));
        }

        if (path === '/api/academy/request-access' && req.method === 'POST') {
          const body = await readBody(req);
          const item = await requestCourseAccess(devUser.id, body.courseId || 'course_cargo_101', {
            name: devUser.name,
            customerCode: devUser.customerCode,
            telegramUserId: devUser.telegramUserId,
          });
          return sendJson(res, 200, {
            success: true,
            message: 'So\'rovingiz adminga yuborildi',
            item,
          });
        }

        if (path === '/api/academy/progress' && req.method === 'POST') {
          const body = await readBody(req);
          const result = recordUserLessonProgress(
            devUser.id,
            body.lessonId,
            Number(body.watchedSeconds),
            Boolean(body.completed)
          );
          return sendJson(res, 200, result);
        }

        // 9. Bot Webhook
        if (path === '/api/bot/webhook' && req.method === 'POST') {
          const body = await readBody(req);
          try {
            await processTelegramUpdate(body);
          } catch (err: any) {
            console.error('Bot webhook error:', err.message);
          }
          return sendJson(res, 200, { ok: true });
        }

        // Default response for unmatched /api/*
        return sendJson(res, 404, { error: `Endpoint topilmadi: ${path}` });
      });
    },
  };
}
